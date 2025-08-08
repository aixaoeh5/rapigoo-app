const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Resolver configuration for React Native compatibility
config.resolver.alias = {
  ...config.resolver.alias,
  'crypto': 'react-native-crypto',
  'stream': 'readable-stream',
  'buffer': '@craftzdog/react-native-buffer',
};

config.resolver.fallback = {
  ...config.resolver.fallback,
  'crypto': require.resolve('react-native-crypto'),
  'stream': require.resolve('readable-stream'),
  'buffer': require.resolve('@craftzdog/react-native-buffer'),
  'timers': require.resolve('timers-browserify'),
  'http': false,
  'https': false,
  'fs': false,
  'net': false,
  'path': false,
  'assert': false,
  'constants': false,
  'os': false,
  'zlib': false,
  'querystring': false,
  'url': false,
  'util': false,
};

module.exports = config;