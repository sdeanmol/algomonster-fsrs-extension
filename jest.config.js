module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'features/**/*.{ts,js}',
    'content/**/*.{ts,js}',
    'background/**/*.{ts,js}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!features/common/marked.min.js'
  ],
  coverageThreshold: {
    global: {
      statements: 65,
      branches: 55,
      functions: 65,
      lines: 65
    },
    './features/tracker/scheduler/fsrsScheduler.ts': {
      lines: 90,
      statements: 90
    },
    './features/tracker/scheduler/fsrsOptimizerFast.ts': {
      lines: 95,
      statements: 95
    },
    './features/dashboard/analytics/memory/confidenceBand.ts': {
      lines: 90,
      statements: 90
    },
    './features/dashboard/analytics/memory/predictionComparison.ts': {
      lines: 90,
      statements: 90
    },
    './features/dashboard/analytics/memory/futureMemorySimulation.ts': {
      lines: 90,
      statements: 90
    }
  },
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/integration'],
  setupFilesAfterEnv: ['<rootDir>/tests/mocks/chromeMock.js'],
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'esnext'
      },
      diagnostics: {
        ignoreCodes: [1343]
      },
      babelConfig: {
        plugins: [require.resolve('./tests/mocks/importMetaPlugin.js')]
      }
    }],
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@napi-rs|@emnapi)/)'
  ],
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
