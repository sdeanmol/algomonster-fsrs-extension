module.exports = {
  testEnvironment: 'jsdom',
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/integration'],
  setupFilesAfterEnv: ['<rootDir>/tests/mocks/chromeMock.js'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/tests/mocks/styleMock.js'
  },
  reporters: [
    "default",
    ["jest-html-reporter", {
      "pageTitle": "Test Report",
      "outputPath": "test-report.html"
    }]
  ]
};
