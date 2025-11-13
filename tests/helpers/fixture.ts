import { makeNodeFixture } from '../../__tests__/__helpers__/FixtureFS/makeNodeFixture.js'
import type { FsClient } from 'isomorphic-git/models'
import type * as fs from 'fs'

export interface TestFixture {
  _fs: typeof fs
  fs: FsClient
  dir: string
  gitdir: string
}

/**
 * Creates a test fixture for Node.js test runner
 * @param fixtureName - Name of the fixture directory
 * @returns Promise resolving to fixture with fs, dir, and gitdir
 */
export async function makeFixture(fixtureName: string): Promise<TestFixture> {
  const fixture = await makeNodeFixture(fixtureName)
  // FileSystem implements FsClient interface, but TypeScript needs explicit cast
  return {
    ...fixture,
    fs: fixture.fs as FsClient,
  }
}

