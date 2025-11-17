import type { GitHttpRequest, GitHttpResponse, HttpClient } from '../../src/git/remote/GitRemoteHTTP.ts'
import { uploadPack } from '../../src/commands/uploadPack.ts'
import { listRefs } from '../../src/git/refs/listRefs.ts'
import { resolveRef, readSymbolicRef } from '../../src/git/refs/readRef.ts'
import { normalizeFs } from '../../src/utils/normalizeFs.ts'
import { writeRefsAdResponse } from '../../src/wire/writeRefsAdResponse.ts'
import { parseUploadPackRequest } from '../../src/wire/parseUploadPackRequest.ts'
import { parseReceivePackResponse } from '../../src/wire/parseReceivePackResponse.ts'
import { writeReceivePackRequest } from '../../src/wire/writeReceivePackRequest.ts'
import { _pack } from '../../src/commands/pack.ts'
import { listObjects } from '../../src/commands/listObjects.ts'
import { listCommitsAndTags } from '../../src/commands/listCommitsAndTags.ts'
import { hasObject } from '../../src/git/objects/hasObject.ts'
import { readObject } from '../../src/git/objects/readObject.ts'
import { parse as parseTag } from '../../src/core-utils/parsers/Tag.ts'
import { GitPktLine } from '../../src/models/GitPktLine.ts'
import { GitSideBand } from '../../src/models/GitSideBand.ts'
import { collect } from '../../src/utils/collect.ts'
import { fromValue } from '../../src/utils/fromValue.ts'
import { makeFixture } from './fixture.ts'
import { join } from '../../src/utils/join.ts'
import type { ServerRef } from '../../src/git/refs/types.ts'

/**
 * Mock HTTP server that handles requests directly without using a port.
 * Routes requests to git repositories based on URL patterns.
 */
export class MockHttpServer {
  private repositories: Map<string, { fs: any; gitdir: string }> = new Map()

  /**
   * Register a git repository for serving
   * @param name - Repository name (e.g., 'test-listServerRefs')
   * @param fs - File system client
   * @param gitdir - Git directory path
   */
  async registerRepository(name: string, fs: any, gitdir: string): Promise<void> {
    this.repositories.set(name, { fs, gitdir })
  }

  /**
   * Register a repository from a fixture
   * @param fixtureName - Fixture name (e.g., 'test-listServerRefs')
   */
  async registerFixture(fixtureName: string): Promise<void> {
    const { fs, gitdir } = await makeFixture(fixtureName)
    this.repositories.set(fixtureName, { fs, gitdir })
  }

  /**
   * Parse URL to extract repository name and path
   */
  private parseUrl(url: string): { repoName: string; path: string; query: Record<string, string> } | null {
    // Match patterns like:
    // http://localhost:8888/test-listServerRefs.git/info/refs?service=git-upload-pack
    // http://localhost:8888/test-listServerRefs.git/git-upload-pack
    // http://localhost/test-listServerRefs.git/info/refs
    
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter(p => p)
    
    if (pathParts.length === 0) return null
    
    // First part should be the repository name (with or without .git suffix)
    let repoName = pathParts[0]
    if (repoName.endsWith('.git')) {
      repoName = repoName.slice(0, -4)
    }
    
    // Rest of the path
    const path = pathParts.slice(1).join('/')
    
    // Parse query string
    const query: Record<string, string> = {}
    urlObj.searchParams.forEach((value, key) => {
      query[key] = value
    })
    
    return { repoName, path, query }
  }

  /**
   * Get all refs from a repository
   */
  private async getAllRefs(repo: { fs: any; gitdir: string }): Promise<{ refs: Record<string, string>; symrefs: Record<string, string> }> {
    const { fs, gitdir } = repo
    const refs: Record<string, string> = {}
    const symrefs: Record<string, string> = {}
    
    // Add HEAD
    try {
      const headOid = await resolveRef({ fs, gitdir, ref: 'HEAD' })
      refs.HEAD = headOid
      try {
        const headTarget = await readSymbolicRef({ fs, gitdir, ref: 'HEAD' })
        if (headTarget && headTarget.startsWith('refs/')) {
          symrefs.HEAD = headTarget
        }
      } catch {
        // HEAD might not be a symref
      }
    } catch {
      // HEAD might not exist
    }
    
    // List all refs
    try {
      const refList = await listRefs({
        fs,
        gitdir,
        filepath: 'refs',
      })
      
      // Add all other refs
      for (const ref of refList) {
        const fullRef = `refs/${ref}`
        try {
          const oid = await resolveRef({ fs, gitdir, ref: fullRef })
          refs[fullRef] = oid
          
          // Check if it's a symref (for protocol v2)
          // Try readSymbolicRef first, but also try reading the file directly as fallback
          try {
            let symrefTarget = await readSymbolicRef({ fs, gitdir, ref: fullRef })
            if (!symrefTarget) {
              // Fallback: read the file directly
              try {
                const normalizedFs = normalizeFs(fs)
                const refPath = join(gitdir, fullRef)
                const content = await normalizedFs.read(refPath, 'utf8')
                if (content && typeof content === 'string' && content.trim().startsWith('ref: ')) {
                  symrefTarget = content.trim().slice('ref: '.length).trim()
                }
              } catch {
                // File doesn't exist or can't be read
              }
            }
            if (symrefTarget && symrefTarget.startsWith('refs/')) {
              symrefs[fullRef] = symrefTarget
            }
          } catch {
            // Not a symref
          }
          
          // If it's a tag, add peeled ref (^{} suffix) for tag peeling
          if (fullRef.startsWith('refs/tags/')) {
            try {
              const cache: Record<string, unknown> = {}
              const { type, object } = await readObject({ fs, cache, gitdir, oid, format: 'content' })
              if (type === 'tag') {
                const tag = parseTag(object as Buffer)
                // Add peeled tag ref with ^{} suffix
                refs[`${fullRef}^{}`] = tag.object
              }
            } catch {
              // Not a tag object or can't read it, skip peeling
            }
          }
        } catch {
          // Skip refs that can't be resolved
        }
      }
    } catch {
      // No refs directory
    }
    
    return { refs, symrefs }
  }

  /**
   * Handle /info/refs request (refs advertisement)
   */
  private async handleInfoRefs(
    repo: { fs: any; gitdir: string },
    service: string,
    protocolVersion: 1 | 2 = 1
  ): Promise<GitHttpResponse> {
    const { fs, gitdir } = repo
    
    if (protocolVersion === 2) {
      // Protocol v2 - return version and capabilities in pkt-line format
      const capabilities = ['ls-refs', 'fetch']
      const response: Buffer[] = []
      
      // First line: version 2 (without trailing newline, GitPktLine.encode handles it)
      response.push(GitPktLine.encode('version 2'))
      
      // Capability lines (without trailing newline, GitPktLine.encode handles it)
      for (const cap of capabilities) {
        response.push(GitPktLine.encode(cap))
      }
      
      // Flush packet to end capabilities list
      response.push(GitPktLine.flush())
      
      // Create async iterable from array of buffers
      // Arrays are iterable, so getIterator should handle them automatically
      // But we need an async iterable, so use async generator
      // Protocol v1 collects into single buffer, but pkt-line format requires separate packets
      // So we yield each buffer individually
      const body = (async function* () {
        for (const buf of response) {
          yield buf
        }
      })()
      
      return {
        url: '',
        method: 'GET',
        statusCode: 200,
        statusMessage: 'OK',
        headers: {
          'content-type': `application/x-${service}-advertisement`,
        },
        body,
      }
    }
    
    // Protocol v1 - use writeRefsAdResponse to generate refs advertisement
    const { refs, symrefs } = await this.getAllRefs(repo)
    
    // Protocol v1 only reports HEAD symref, not others
    const protocolV1Symrefs: Record<string, string> = {}
    if (symrefs.HEAD) {
      protocolV1Symrefs.HEAD = symrefs.HEAD
    }
    
    const capabilities = [
      'thin-pack',
      'side-band',
      'side-band-64k',
      'shallow',
      'deepen-since',
      'deepen-not',
      'allow-tip-sha1-in-want',
      'allow-reachable-sha1-in-want',
    ]
    
    const response = await writeRefsAdResponse({
      capabilities,
      refs,
      symrefs: protocolV1Symrefs,
    })
    
    // Protocol v1 requires "# service=git-upload-pack\n" as first line, then flush
    // writeRefsAdResponse doesn't include this, so we prepend it
    const fullResponse: Buffer[] = []
    fullResponse.push(GitPktLine.encode(`# service=${service}\n`))
    fullResponse.push(GitPktLine.flush())
    fullResponse.push(...response)
    
    // Create async iterable from array of buffers
    const body = (async function* () {
      for (const buf of fullResponse) {
        yield buf
      }
    })()
    
    return {
      url: '',
      method: 'GET',
      statusCode: 200,
      statusMessage: 'OK',
      headers: {
        'content-type': `application/x-${service}-advertisement`,
      },
      body,
    }
  }

  /**
   * Handle service request (upload-pack, receive-pack)
   */
  private async handleService(
    repo: { fs: any; gitdir: string },
    service: string,
    requestBody?: AsyncIterableIterator<Uint8Array>
  ): Promise<GitHttpResponse> {
    const { fs, gitdir } = repo
    
    if (service === 'git-upload-pack') {
      // Check if this is a protocol v2 ls-refs request
      if (requestBody) {
        try {
          const bodyBuffer = Buffer.from(await collect(requestBody))
          
          // Parse pkt-line format
          const read = GitPktLine.streamReader(fromValue([bodyBuffer]))
          const lines: string[] = []
          let line: Buffer | null | true
          while (true) {
            line = await read()
            if (line === true) break
            if (line === null) continue
            lines.push(line.toString('utf8').replace(/\n$/, ''))
          }
          
          // Check for protocol v2 ls-refs command
          if (lines.some(l => l.includes('command=ls-refs'))) {
            // Parse the request to extract prefix, symrefs, peelTags
            let prefix: string | undefined
            let symrefs = false
            let peelTags = false
            
            for (const line of lines) {
              if (line.startsWith('ref-prefix ')) {
                prefix = line.substring('ref-prefix '.length).trim()
              } else if (line === 'symrefs') {
                symrefs = true
              } else if (line === 'peel') {
                peelTags = true
              }
            }
            
            // Get refs based on prefix
            const { refs, symrefs: symrefsMap } = await this.getAllRefs(repo)
            
            // Filter by prefix if specified
            let filteredRefs = Object.entries(refs)
            if (prefix) {
              filteredRefs = filteredRefs.filter(([ref]) => ref.startsWith(prefix))
            }
            
            // Build protocol v2 ls-refs response
            // Always include at least the flush packet, even if no refs match
            const response: Buffer[] = []
            for (const [ref, oid] of filteredRefs) {
              // Skip peeled tag refs (^{} suffix) - they're handled separately
              if (ref.endsWith('^{}')) {
                continue
              }
              
              const attrs: string[] = []
              if (symrefs && symrefsMap[ref]) {
                attrs.push(`symref-target:${symrefsMap[ref]}`)
              }
              
              // Handle peelTags for annotated tags
              if (peelTags && ref.startsWith('refs/tags/') && refs[`${ref}^{}`]) {
                attrs.push(`peeled:${refs[`${ref}^{}`]}`)
              }
              
              const line = `${oid} ${ref}${attrs.length > 0 ? ' ' + attrs.join(' ') : ''}\n`
              response.push(GitPktLine.encode(line))
            }
            // Always add flush packet, even if no refs (empty response is valid)
            response.push(GitPktLine.flush())
            
            // Create async iterable from array of buffers
            // fromValue only handles single values, so we need to create an async generator
            const body = (async function* () {
              for (const buf of response) {
                yield buf
              }
            })()
            
            return {
              url: '',
              method: 'POST',
              statusCode: 200,
              statusMessage: 'OK',
              headers: {
                // Protocol v2 ls-refs responses use -result, not -advertisement
                'content-type': `application/x-${service}-result`,
              },
              body,
            }
          }
        } catch {
          // If parsing fails, fall through to default handling
        }
      }
      
      // Handle upload-pack request (fetch) - generate packfile
      if (!requestBody) {
        const body = fromValue([GitPktLine.encode('NAK\n')])
        return {
          url: '',
          method: 'POST',
          statusCode: 200,
          statusMessage: 'OK',
          headers: {
            'content-type': `application/x-${service}-result`,
          },
          body,
        }
      }
      
      try {
        const request = await parseUploadPackRequest(requestBody)
        const cache: Record<string, unknown> = {}
        
        // Determine which objects to send
        const objectsToSend = new Set<string>()
        
        // Add all wanted objects and their dependencies
        for (const want of request.wants) {
          const objects = await listObjects({ fs, cache, gitdir, oids: [want] })
          for (const oid of objects) {
            objectsToSend.add(oid)
          }
        }
        
        // Remove objects that client already has
        for (const have of request.haves) {
          if (await hasObject({ fs, cache, gitdir, oid: have })) {
            // Client has this commit, remove it and its ancestors from objectsToSend
            const haveObjects = await listObjects({ fs, cache, gitdir, oids: [have] })
            for (const oid of haveObjects) {
              objectsToSend.delete(oid)
            }
          }
        }
        
        // Generate packfile
        console.log(`[DEBUG mockHttpServer] Objects to send: ${objectsToSend.size} objects`)
        if (objectsToSend.size > 0) {
          console.log(`[DEBUG mockHttpServer] First few objects:`, Array.from(objectsToSend).slice(0, 5))
        }
        const packfileChunks = await _pack({
          fs,
          cache,
          gitdir,
          oids: Array.from(objectsToSend),
        })
        
        // Build response with ACK and packfile
        const response: Buffer[] = []
        
        // Send ACK for first want
        if (request.wants.length > 0) {
          response.push(GitPktLine.encode(`ACK ${request.wants[0]}\n`))
        } else {
          response.push(GitPktLine.encode('NAK\n'))
        }
        
        // Send packfile using side-band-64k encoding
        // Combine packfile chunks into single buffer
        const packfileBuffer = Buffer.concat(packfileChunks)
        
        // Split packfile into chunks and encode with side-band
        const CHUNK_SIZE = 65519 // side-band-64k max data per packet
        for (let i = 0; i < packfileBuffer.length; i += CHUNK_SIZE) {
          const chunk = packfileBuffer.slice(i, i + CHUNK_SIZE)
          // Side-band byte 1 = packfile data
          const sidebandChunk = Buffer.concat([Buffer.from([1]), chunk])
          response.push(GitPktLine.encode(sidebandChunk))
        }
        
        // Add flush packet at the end
        response.push(GitPktLine.flush())
        
        // Create async iterable from array of buffers (fromValue only handles single values)
        const body = (async function* () {
          for (const buf of response) {
            yield buf
          }
        })()
        
        return {
          url: '',
          method: 'POST',
          statusCode: 200,
          statusMessage: 'OK',
          headers: {
            'content-type': `application/x-${service}-result`,
          },
          body,
        }
      } catch (err) {
        // Error generating packfile - return NAK
        const body = fromValue([GitPktLine.encode('NAK\n')])
        return {
          url: '',
          method: 'POST',
          statusCode: 200,
          statusMessage: 'OK',
          headers: {
            'content-type': `application/x-${service}-result`,
          },
          body,
        }
      }
    }
    
    if (service === 'git-receive-pack') {
      // Handle receive-pack request (push)
      if (!requestBody) {
        // Create async iterable from single buffer
        const body = (async function* () {
          yield GitPktLine.encode('unpack ok\n')
          yield GitPktLine.flush()
        })()
        return {
          url: '',
          method: 'POST',
          statusCode: 200,
          statusMessage: 'OK',
          headers: {
            'content-type': `application/x-${service}-result`,
          },
          body,
        }
      }
      
      try {
        // Parse the request to get ref updates
        // The request format is: pkt-line ref updates, flush packet, then raw packfile
        const bodyBuffer = Buffer.from(await collect(requestBody))
        
        // Use GitPktLine.streamReader to properly parse pkt-lines
        // This will correctly handle the flush packet (0000) and stop there
        const bodyStream = (async function* () {
          yield bodyBuffer
        })()
        
        const read = GitPktLine.streamReader(bodyStream)
        const triplets: Array<{ oldoid: string; oid: string; ref: string }> = []
        let line: Buffer | null | true
        
        // Read ref updates until we hit the flush packet
        while (true) {
          line = await read()
          if (line === true) break // End of stream
          if (line === null) break // Flush packet (0000) - end of ref updates section
          
          const lineStr = line.toString('utf8').trim()
          if (lineStr === '') continue
          
          // Parse ref update line: oldoid oid ref\x00 capabilities
          // The format is: "oldoid oid ref\x00 capabilities" or "oldoid oid ref"
          const nullIndex = lineStr.indexOf('\x00')
          const refLine = nullIndex >= 0 ? lineStr.substring(0, nullIndex) : lineStr
          
          const refParts = refLine.split(' ')
          if (refParts.length >= 3) {
            // Everything after the second space is the ref name
            const ref = refParts.slice(2).join(' ').trim()
            triplets.push({
              oldoid: refParts[0].trim(),
              oid: refParts[1].trim(),
              ref: ref,
            })
          }
        }
        
        // Update refs in repository
        const result: Buffer[] = []
        result.push(GitPktLine.encode('unpack ok\n'))
        
        for (const triplet of triplets) {
          try {
            // Update the ref
            const refPath = join(gitdir, triplet.ref)
            // Ensure parent directory exists
            const refDir = refPath.substring(0, refPath.lastIndexOf('/'))
            try {
              await fs.mkdir(refDir, { recursive: true })
            } catch {
              // Directory might already exist
            }
            await fs.write(refPath, `${triplet.oid}\n`)
            result.push(GitPktLine.encode(`ok ${triplet.ref}`))
          } catch (err) {
            result.push(GitPktLine.encode(`ng ${triplet.ref} ${String(err)}`))
          }
        }
        
        result.push(GitPktLine.flush())
        
        // Create async iterable from array of buffers
        // fromValue only handles single values, so we need to create an async generator
        const body = (async function* () {
          for (const buf of result) {
            yield buf
          }
        })()
        
        return {
          url: '',
          method: 'POST',
          statusCode: 200,
          statusMessage: 'OK',
          headers: {
            'content-type': `application/x-${service}-result`,
          },
          body,
        }
      } catch (err) {
        // Error processing push
        // Create async iterable from single buffer
        const body = (async function* () {
          yield GitPktLine.encode(`unpack error: ${String(err)}`)
          yield GitPktLine.flush()
        })()
        return {
          url: '',
          method: 'POST',
          statusCode: 200,
          statusMessage: 'OK',
          headers: {
            'content-type': `application/x-${service}-result`,
          },
          body,
        }
      }
    }
    
    // Default response for other services
    const body = fromValue([])
    return {
      url: '',
      method: 'POST',
      statusCode: 200,
      statusMessage: 'OK',
      headers: {
        'content-type': `application/x-${service}-result`,
      },
      body,
    }
  }

  /**
   * Handle HTTP request
   */
  async handleRequest(request: GitHttpRequest): Promise<GitHttpResponse> {
    const parsed = this.parseUrl(request.url)
    
    if (!parsed) {
      return {
        url: request.url,
        method: request.method || 'GET',
        statusCode: 404,
        statusMessage: 'Not Found',
        headers: {},
        body: fromValue([Buffer.from('Repository not found\n')]),
      }
    }
    
    const { repoName, path, query } = parsed
    const repo = this.repositories.get(repoName)
    
    if (!repo) {
      return {
        url: request.url,
        method: request.method || 'GET',
        statusCode: 404,
        statusMessage: 'Not Found',
        headers: {},
        body: fromValue([Buffer.from(`Repository ${repoName} not found\n`)]),
      }
    }
    
    // Handle /info/refs endpoint
    if (path === 'info/refs') {
      const service = query.service || 'git-upload-pack'
      // Protocol version can be specified in query string or default to 1
      // If version=2 is in query, use protocol v2, otherwise v1
      const protocolVersion = (query.version === '2' || request.headers?.['git-protocol'] === 'version=2') ? 2 : 1
      return this.handleInfoRefs(repo, service, protocolVersion as 1 | 2)
    }
    
    // Handle service endpoints (git-upload-pack, git-receive-pack)
    if (path === 'git-upload-pack' || path === 'git-receive-pack') {
      const service = path
      return this.handleService(repo, service, request.body)
    }
    
    // Unknown path
    return {
      url: request.url,
      method: request.method || 'GET',
      statusCode: 404,
      statusMessage: 'Not Found',
      headers: {},
      body: fromValue([Buffer.from('Path not found\n')]),
    }
  }

  /**
   * Create an HttpClient that uses this mock server
   */
  createClient(): HttpClient {
    return {
      request: async (req: GitHttpRequest): Promise<GitHttpResponse> => {
        return this.handleRequest(req)
      },
    }
  }
}

/**
 * Create a mock HTTP server instance
 */
export function createMockHttpServer(): MockHttpServer {
  return new MockHttpServer()
}

/**
 * Helper function to create a mock HTTP client for a fixture
 * @param fixtureName - Name of the fixture to use
 * @returns HttpClient that routes to the fixture repository
 */
export async function createMockHttpClient(fixtureName: string): Promise<HttpClient> {
  const server = createMockHttpServer()
  await server.registerFixture(fixtureName)
  return server.createClient()
}

