/**
 * Configuración para ambiente de desarrollo
 * Facilita el desarrollo sin necesidad de servicios externos
 */

module.exports = {
  // Email
  EMAIL_MODE: process.env.EMAIL_MODE || 'console', // 'console' o 'real'
  SHOW_VERIFICATION_CODES: true,
  
  // Base de datos
  MONGO_OPTIONS: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  
  // JWT
  JWT_EXPIRES_IN: '7d',
  
  // Logs
  LOG_LEVEL: 'debug',
  
  // CORS
  CORS_ORIGINS: [
    'http://localhost:19006',
    'http://localhost:8081',
    'exp://192.168.1.100:8081',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  
  // Rate limiting
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutos
  RATE_LIMIT_MAX: 100, // máximo de requests
  
  // Uploads
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  
  // Modo desarrollo
  IS_DEVELOPMENT: true,
  SKIP_EMAIL_VERIFICATION: false, // true para saltar verificación
  DEFAULT_USER_PASSWORD: 'test123', // para usuarios de prueba
  
  // Seeds y datos de prueba
  ENABLE_SEED_ROUTES: true,
  
  // Debugging
  SHOW_STACK_ERRORS: true,
  PRETTY_LOGS: true
};