module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/integration'],
  setupFilesAfterEnv: ['<rootDir>/tests/mocks/chromeMock.js'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.js$': 'babel-jest'
  },
  moduleNameMapper: {
    '^@common/(.*)$': '<rootDir>/features/common/$1',
    '^@tracker/(.*)$': '<rootDir>/features/tracker/$1',
    '^@dashboard/(.*)$': '<rootDir>/features/dashboard/$1',
    '\\.(css|less|scss)$': '<rootDir>/tests/mocks/styleMock.js',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  reporters: [
    "default",
    ["jest-html-reporter", {
      "pageTitle": "Test Report",
      "outputPath": "test-report.html"
    }]
  ]
};
