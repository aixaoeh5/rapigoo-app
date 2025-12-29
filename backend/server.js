const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

console.log('🔄 Iniciando servidor Rapigoo...');

// Cargar variables de entorno
dotenv.config();
console.log('✅ Variables de entorno cargadas');

// Performance middlewares
console.log('🔄 Cargando middlewares...');
const compressionMiddleware = require('./middleware/compression');
console.log('✅ Compression middleware cargado');

const { performanceMonitor, optimizeQueries, resourceLimit, healthCheck } = require('./middleware/performance');
console.log('✅ Performance middlewares cargados');

const { cacheService } = require('./middleware/cache');
console.log('✅ Cache middleware cargado');

const app = express();

// Seguridad básica con Helmet
app.use(helmet());

// Performance monitoring
app.use(performanceMonitor());

// Compression for better performance
app.use(compressionMiddleware);

// Health check endpoint
app.use(healthCheck());

// Query optimization
// TEMPORAL: Comentado para evitar conflictos con Node.js 22+
// app.use(optimizeQueries());

// Resource limiting
app.use(resourceLimit({
  maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  maxMemoryMB: 512,
  maxConcurrent: 100
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutos
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // límite de requests
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting más estricto para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos
  message: 'Demasiados intentos de autenticación, por favor intente más tarde.',
  skipSuccessfulRequests: true,
});

// Aplicar rate limiting
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/merchant/login', authLimiter);
app.use('/api/merchant/register', authLimiter);

// Middleware para parsear JSON con límite de tamaño
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sanitización de datos para prevenir NoSQL injection
// TEMPORAL: Comentado debido a incompatibilidad con Node.js 22+
// TODO: Actualizar a una versión compatible o implementar sanitización manual
// app.use(mongoSanitize({
//   replaceWith: '_',
//   onSanitize: ({ req, key }) => {
//     console.warn(`⚠️  Intento de NoSQL injection bloqueado en ${key}`);
//   }
// }));

// Sanitización manual temporal
app.use((req, res, next) => {
  // Sanitizar body, query y params manualmente
  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Si contiene operadores MongoDB peligrosos
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
          console.warn(`⚠️  Posible NoSQL injection bloqueado: ${key}`);
        } else {
          sanitizeObject(obj[key]);
        }
      }
    }
    return obj;
  };
  
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  
  next();
});

// CORS configuración para desarrollo
const corsOptions = {
  origin: function (origin, callback) {
    // En desarrollo, permitir cualquier origen
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }
    
    // En producción, ser más restrictivo
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.ADMIN_URL || 'http://localhost:3001',
      'http://localhost:19006', // Expo web
      'exp://localhost:19000', // Expo development
    ];
    
    // Permitir requests sin origin (mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Conexión a MongoDB con retry automático y mejor manejo de errores
const connectDB = async (retryCount = 0) => {
  const maxRetries = 3;
  
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 15000,
      maxPoolSize: 15,
      minPoolSize: 2,
      maxIdleTimeMS: 45000,
      waitQueueTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true
    });
    
    console.log('✅ Conectado a MongoDB');
    
    // Manejo de eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error('❌ Error de conexión MongoDB:', err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  Desconectado de MongoDB - Intentando reconectar...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ Reconectado a MongoDB');
    });
    
  } catch (err) {
    console.error(`❌ Error al conectar a MongoDB (intento ${retryCount + 1}/${maxRetries}):`, err.message);
    
    if (retryCount < maxRetries - 1) {
      const delay = Math.pow(2, retryCount) * 2000; // Backoff exponencial
      console.log(`🔄 Reintentando conexión en ${delay/1000} segundos...`);
      
      setTimeout(() => {
        connectDB(retryCount + 1);
      }, delay);
    } else {
      console.log('⚠️  Máximo número de reintentos alcanzado');
      console.log('⚠️  El servidor continuará sin conexión a base de datos');
      console.log('ℹ️  Algunas funcionalidades estarán limitadas');
    }
  }
};

// Intentar conectar a MongoDB pero no detener el servidor si falla
connectDB();

// Middleware para logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas de autenticación para usuarios normales
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Rutas para comerciantes
const merchantRoutes = require('./routes/merchantRoutes');
app.use('/api/merchant', merchantRoutes);

// Rutas para servicios de comerciantes
const serviceRoutes = require('./routes/services');
app.use('/api/services', serviceRoutes);

// Rutas para categorías de comerciantes
const categoryRoutes = require('./routes/categoryRoutes');
app.use('/api/categories', categoryRoutes);

// Rutas para carrito de compras
const cartRoutes = require('./routes/cartRoutes');
app.use('/api/cart', cartRoutes);

// Rutas para pedidos (version simplificada para MVP)
const orderRoutes = require('./routes/orderRoutes');
app.use('/api/orders', orderRoutes);

// Rutas para búsqueda
const searchRoutes = require('./routes/searchRoutes');
app.use('/api/search', searchRoutes);

// Rutas para favoritos
const favoritesRoutes = require('./routes/favoritesRoutes');
app.use('/api/favorites', favoritesRoutes);

// Rutas para notificaciones
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

// Rutas para pagos
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);

// Rutas para delivery tracking
const deliveryRoutes = require('./routes/deliveryRoutes');
app.use('/api/delivery', deliveryRoutes);

// Rutas para chat
const chatRoutes = require('./routes/chatRoutes');
app.use('/api/chat', chatRoutes);

// Rutas para reviews
const reviewRoutes = require('./routes/reviewRoutes');
app.use('/api/reviews', reviewRoutes);

// Rutas para IA y extracción de direcciones (temporalmente deshabilitado)
// const aiRoutes = require('./routes/aiRoutes');
// app.use('/api/ai', aiRoutes);

// Rutas para categorías del sistema
const systemCategoryRoutes = require('./routes/systemCategoryRoutes');
app.use('/api/system-categories', systemCategoryRoutes);

// Rutas de prueba (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  const testRoutes = require('./routes/testRoutes');
  app.use('/api/test', testRoutes);
  console.log('🧪 Rutas de prueba habilitadas en /api/test');
}

// Ruta de prueba con información limitada
app.get('/', (req, res) => {
  res.json({
    message: 'API Rapigoo',
    version: '1.0.0',
    status: 'active'
  });
});

// Ruta base para API - Missing endpoint that was causing 404s
app.get('/api', (req, res) => {
  res.json({
    message: 'Rapigoo API',
    version: '1.0.0',
    status: 'online',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/auth',
      '/api/merchant', 
      '/api/services',
      '/api/categories',
      '/api/cart',
      '/api/orders',
      '/api/search',
      '/api/favorites',
      '/api/notifications',
      '/api/payments',
      '/api/delivery',
      '/api/chat',
      '/api/reviews'
    ]
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path
  });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // No exponer detalles de errores en producción
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Error interno del servidor',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Manejo de señales para cierre graceful
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  
  // Cerrar conexiones de forma ordenada
  try {
    await cacheService.disconnect();
    console.log('Cache desconectado');
  } catch (error) {
    console.error('Error cerrando cache:', error);
  }
  
  mongoose.connection.close().then(() => {
    console.log('Conexión a MongoDB cerrada');
    process.exit(0);
  }).catch(err => {
    console.error('Error cerrando MongoDB:', err);
    process.exit(1);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT recibido. Cerrando servidor...');
  
  try {
    await cacheService.disconnect();
    console.log('Cache desconectado');
  } catch (error) {
    console.error('Error cerrando cache:', error);
  }
  
  mongoose.connection.close().then(() => {
    console.log('Conexión a MongoDB cerrada');
    process.exit(0);
  }).catch(err => {
    console.error('Error cerrando MongoDB:', err);
    process.exit(1);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Escuchar en todas las interfaces
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor corriendo en http://${HOST}:${PORT}`);
  console.log(`📱 Accesible desde dispositivos en la red local`);
  console.log(`🔒 Modo: ${process.env.NODE_ENV || 'development'}`);
  
  // Mostrar IPs disponibles
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  console.log('📡 IPs disponibles:');
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(networkInterface => {
      if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
        console.log(`   - http://${networkInterface.address}:${PORT}/api`);
      }
    });
  });
});

// Inicializar WebSocket server
const socketService = require('./services/socketService');
socketService.initialize(server);

// Timeout para conexiones
server.timeout = 30000; // 30 segundos

module.exports = app;