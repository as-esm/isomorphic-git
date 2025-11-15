import { detectObjectFormat, getOidLength, validateOid, type ObjectFormat } from '../../src/utils/detectObjectFormat.ts'
import type { FsClient } from 'isomorphic-git/models'

/**
 * Helper to get object format from a fixture
 */
export async function getFixtureObjectFormat(
  fs: FsClient,
  gitdir: string
): Promise<ObjectFormat> {
  return await detectObjectFormat(fs, gitdir)
}

/**
 * Helper to get expected OID length for a fixture
 */
export async function getFixtureOidLength(
  fs: FsClient,
  gitdir: string
): Promise<number> {
  const format = await detectObjectFormat(fs, gitdir)
  return getOidLength(format)
}

/**
 * Helper to validate an OID matches the fixture's format
 */
export async function validateFixtureOid(
  fs: FsClient,
  gitdir: string,
  oid: string
): Promise<boolean> {
  const format = await detectObjectFormat(fs, gitdir)
  return validateOid(oid, format)
}

/**
 * Test helper that runs a test for both SHA-1 and SHA-256 if applicable
 * @param testFn - Test function that receives objectFormat parameter
 */
export function testBothFormats(
  testFn: (objectFormat: ObjectFormat) => Promise<void> | void
) {
  return async () => {
    // Run test with SHA-1 (default)
    await testFn('sha1')
    
    // Note: SHA-256 tests would require SHA-256 fixtures
    // For now, we'll skip SHA-256 tests unless fixtures are available
    // This can be enabled later when SHA-256 fixtures are created
  }
}

