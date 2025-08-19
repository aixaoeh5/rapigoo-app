const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Suprimir warnings específicos de Expo Go en desarrollo
if (global.__DEV__) {
  const ignorePatterns = [
    'expo-notifications: Android Push notifications',
    'remote notifications',
    'removed from Expo Go',
    'functionality provided by expo-notifications was removed',
    'Use a development build instead of Expo Go',
  ];
  
  // Configurar LogBox para ignorar estos warnings si está disponible
  try {
    const { LogBox } = require('react-native');
    if (LogBox && LogBox.ignoreLogs) {
      LogBox.ignoreLogs(ignorePatterns);
    }
  } catch (e) {
    // LogBox no disponible, continuar silenciosamente
  }
}

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

// Bundle optimization
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    mangle: {
      keep_fnames: true,
    },
    output: {
      ascii_only: true,
      quote_keys: false,
      wrap_iife: true,
    },
    sourceMap: {
      includeSources: false,
    },
    toplevel: false,
    compress: {
      reduce_funcs: false,
    },
  },
};

// Asset optimization
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  'webp', // Add WebP support for better compression
];

// Tree shaking for better bundle size
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;