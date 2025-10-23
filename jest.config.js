module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.minimal.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/backend/',
    '/android/',
    '/ios/'
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@expo|expo|@react-navigation|react-native-vector-icons|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|react-native-maps|@react-native-async-storage|react-native-status-bar-height)/)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@api/(.*)$': '<rootDir>/api/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@hooks/(.*)$': '<rootDir>/hooks/$1',
  },
  collectCoverageFrom: [
    'components/**/*.{js,jsx}',
    'api/**/*.{js,jsx}',
    'utils/**/*.{js,jsx}',
    'services/**/*.{js,jsx}',
    'hooks/**/*.{js,jsx}',
    '!components/**/*.test.{js,jsx}',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!App.js',
    '!index.js',
    '!metro.config.js',
    '!babel.config.js'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: [
    '**/__tests__/**/*.(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)'
  ]
};