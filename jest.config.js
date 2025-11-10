import os from 'os'

// // Use 'export default' instead of 'module.exports'
// export default {
//   // Use a preset designed for ESM and TypeScript/JavaScript
//   // This will handle transforming TypeScript-in-ESM correctly.
//   // preset: 'ts-jest/presets/default-esm',
//   transform: {}, // Not transform
//   modulePathIgnorePatterns: ['<rootDir>/website'],
//   // cjs tests __tests__
//   testRegex: '/out/(server-only\\.)?test-[^\\/]+\\.js',
//   moduleNameMapper: {
//     // This mapping tells Jest to resolve imports for 'isomorphic-git' to your source.
//     // The '^(\\.{1,2}/.*)\\.js$': '$1' part is crucial for resolving imports with .js extensions.
//     '^isomorphic-git$': '<rootDir>/src/index.ts',
//     '^isomorphic-git/http$': '<rootDir>/src/http/node/index.js',
//     '^isomorphic-git/(.+)$': '<rootDir>/src/$1',
//     '^(\\.{1,2}/.*)\\.js$': '$1',
//   },
//   collectCoverageFrom: ['src/*.js', 'src/**/*.js'], // 'src/*.ts', 'src/**/*.ts'
//   testEnvironment: 'node',
//   reporters: [
//     'default',
//     [
//       'jest-junit',
//       {
//         outputDirectory: 'junit',
//         // The template literal syntax remains the same
//         outputName: `TESTS-node-${process.version}-${
//           process.platform
//         }-${os.release()}.xml`,
//       },
//     ],
//   ],
//   coverageReporters: ['lcov', 'cobertura'],
// }

export default {
  // --- KEY CHANGES ---

  // 1. Disable ALL transformations.
  // This tells Jest to pass all files (js, ts, etc.) directly to the Node.js runtime.
  transform: {},

  // 2. Tell Jest's resolver to recognize .ts files.
  // This is crucial so that when a file imports './foo.ts', Jest knows it's a valid module.
  moduleFileExtensions: ['js', 'ts', 'json', 'node'],

  // --------------------

  // This still points to your pre-built ESM test files.
  testRegex: '/out__tests__/(server-only\\.)?test-[^\\/]+\\.js',

  // This is still essential. It tells Jest where to find the source .ts files.
  // moduleNameMapper: {
  //   '^isomorphic-git$': '<rootDir>/src/index.ts',
  //   '^isomorphic-git/http$': '<rootDir>/http/node/index.js',
  //   '^isomorphic-git/(.+)$': '<rootDir>/src/$1',
  //   '^(\\.{1,2}/.*)\\.js$': '$1',
  // },

  // The rest of your configuration is correct.
  modulePathIgnorePatterns: ['<rootDir>/website'],
  collectCoverageFrom: ['src/*.js', 'src/**/*.js'],
  testEnvironment: 'node',
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'junit',
        outputName: `TESTS-node-${process.version}-${process.platform}-${os.release()}.xml`,
      },
    ],
  ],
  coverageReporters: ['lcov', 'cobertura'],
}