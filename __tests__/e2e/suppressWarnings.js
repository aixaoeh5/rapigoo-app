// Suppress Jest warnings for E2E tests
process.env.SUPPRESS_JEST_WARNINGS = 'true';

// Set Node environment to test
process.env.NODE_ENV = 'test';

// Suppress other common warnings
process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';