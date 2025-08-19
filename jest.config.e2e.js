module.exports = {
  displayName: 'E2E Tests',
  testMatch: ['**/__tests__/e2e/**/*.test.js'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/e2e/testSetup.js'],
  testTimeout: 180000, // 3 minutes per test for slower Windows setup
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  verbose: true,
  collectCoverage: false, // Coverage not meaningful for E2E tests
  
  // Suppress Mongoose Jest warnings
  setupFiles: ['<rootDir>/__tests__/e2e/suppressWarnings.js'],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/__tests__/e2e/globalSetup.js',
  globalTeardown: '<rootDir>/__tests__/e2e/globalTeardown.js',
  
  // Custom test reporting
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './__tests__/reports',
      filename: 'e2e-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Rapigoo E2E Test Report'
    }],
    ['jest-junit', {
      outputDirectory: './__tests__/reports',
      outputName: 'e2e-test-results.xml',
      suiteName: 'Rapigoo E2E Tests'
    }]
  ],
  
  // Module path mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@backend/(.*)$': '<rootDir>/backend/$1',
    '^@components/(.*)$': '<rootDir>/components/$1'
  },
  
  // Test patterns to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/build/',
    '/dist/'
  ],
  
  // Transform configuration
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Environment variables for testing
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  }
};