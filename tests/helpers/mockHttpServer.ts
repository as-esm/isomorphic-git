import type { GitHttpRequest, GitHttpResponse, HttpClient } from '../../src/git/remote/GitRemoteHTTP.ts'
import { uploadPack } from '../../src/commands/uploadPack.ts'
import { listRefs } from '../../src/git/refs/listRefs.ts'
import { resolveRef } from '../../src/git/refs/readRef.ts'
import { writeRefsAdResponse } from '../../src/wire/writeRefsAdResponse.ts'
import { GitPktLine } from '../../src/models/GitPktLine.ts'
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
        const headTarget = await resolveRef({ fs, gitdir, ref: 'HEAD', depth: 2 })
        if (headTarget !== headOid && headTarget.startsWith('refs/')) {
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
          try {
            const symrefTarget = await resolveRef({ fs, gitdir, ref: fullRef, depth: 2 })
            if (symrefTarget !== oid && symrefTarget.startsWith('refs/')) {
              symrefs[fullRef] = symrefTarget
            }
          } catch {
            // Not a symref
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
      
      // First line: version 2
      response.push(GitPktLine.encode('version 2\n'))
      
      // Capability lines
      for (const cap of capabilities) {
        response.push(GitPktLine.encode(`${cap}\n`))
      }
      
      // Empty line to end capabilities
      response.push(GitPktLine.encode('\n'))
      
      const body = fromValue(response)
      
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
      service,
      capabilities,
      refs,
      symrefs,
    })
    
    const body = fromValue([Buffer.from(await collect(response))])
    
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
    
    if (service === 'git-upload-pack' && requestBody) {
      // Check if this is a protocol v2 ls-refs request
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
          const response: Buffer[] = []
          for (const [ref, oid] of filteredRefs) {
            const attrs: string[] = []
            if (symrefs && symrefsMap[ref]) {
              attrs.push(`symref-target:${symrefsMap[ref]}`)
            }
            // TODO: Handle peelTags for annotated tags
            const line = `${oid} ${ref}${attrs.length > 0 ? ' ' + attrs.join(' ') : ''}\n`
            response.push(GitPktLine.encode(line))
          }
          response.push(GitPktLine.flush())
          
          const body = fromValue(response)
          
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
      } catch {
        // If parsing fails, fall through to default handling
      }
      
      // Default upload-pack response (protocol v1 or packfile request)
      const body = fromValue([
        Buffer.from('0008NAK\n'),
      ])
      
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

