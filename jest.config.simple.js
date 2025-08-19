module.exports = {
  displayName: 'Simple E2E Tests',
  testMatch: ['**/__tests__/e2e/quickTest.test.js'],
  testEnvironment: 'node',
  testTimeout: 30000,
  verbose: true,
  collectCoverage: false,
  
  // Minimal setup
  setupFiles: ['<rootDir>/__tests__/e2e/suppressWarnings.js']
};