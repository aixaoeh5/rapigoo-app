module.exports = function(api) {
  api.cache(true);
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    presets: [
      'babel-preset-expo'
    ],
    plugins: [
      'react-native-reanimated/plugin',
      ...(isProduction ? [
        // Production optimizations
        ['babel-plugin-transform-remove-console', {
          exclude: ['error', 'warn'] // Keep important logs
        }],
        // Dead code elimination
        'babel-plugin-minify-dead-code-elimination',
        // Constant folding for better minification
        'babel-plugin-minify-constant-folding',
        // Remove unused imports
        'babel-plugin-transform-remove-undefined'
      ] : [])
    ],
    env: {
      production: {
        plugins: [
          'transform-remove-console'
        ]
      }
    }
  };
};