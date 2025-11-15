import { clone } from 'isomorphic-git'
import http from './src/http/node/index.ts'
import { join } from 'node:path'
import * as fs from 'fs'
import { normalizeFs } from './src/utils/normalizeFs.ts'

async function testClone() {
  const dir = '/tmp/gitlab-test-clone'
  const gitdir = join(dir, '.git')
  
  // Use normalizeFs to create a compatible FsClient from node:fs
  const fsClient = normalizeFs(fs as any)
  
  // Ensure directory exists
  await fsClient.mkdir(dir, true)
  
  console.log('Cloning GitLab repository...')
  await clone({
    fs: fsClient as any,
    http,
    dir,
    gitdir,
    depth: 1,
    singleBranch: true,
    url: 'https://gitlab.com/gitlab-org/gitlab-test.git',
  })
  
  console.log('Clone completed successfully!')
  console.log(`Repository cloned to: ${dir}`)
  console.log(`Git directory: ${gitdir}`)
}

testClone().catch(console.error)

