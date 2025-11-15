export default function commonConfig(outputName) {
  return {
    modulePathIgnorePatterns: ['<rootDir>/website', '<rootDir>/tests'],
    // Jest runs remaining JS tests in __tests__/ directory
    // TypeScript tests in tests/ use Node test runner
    testRegex: '/__tests__/(http/|snapshot/|server-only\\.)?test-[^\\/]+\\.js',
    moduleNameMapper: {
      '^isomorphic-git$': '<rootDir>/src',
      '^isomorphic-git/http$': '<rootDir>/http/node',
      '^isomorphic-git/(.+)$': '<rootDir>/src/$1',
    },
    collectCoverageFrom: ['src/*.js', 'src/**/*.js', 'src/**/*.ts'],
    coverageReporters: ['lcov', 'cobertura'],
    reporters: [
      'default',
      [
        'jest-junit',
        {
          outputDirectory: 'junit',
          outputName: `${outputName}.xml`,
        },
      ],
    ],
  }
}
