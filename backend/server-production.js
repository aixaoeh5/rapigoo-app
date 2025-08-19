const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

console.log('🔄 Iniciando servidor Rapigoo (Producción)...');

// Cargar variables de entorno
dotenv.config();
console.log('✅ Variables de entorno cargadas');

const app = express();

// Seguridad básica con Helmet
app.use(helmet());

// CORS configuración para producción
const corsOptions = {
  origin: function (origin, callback) {
    // En producción, ser más restrictivo
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.ADMIN_URL || 'http://localhost:3001',
      'http://localhost:19006', // Expo web
      'exp://localhost:19000', // Expo development
    ];
    
    // Permitir requests sin origin (mobile apps)
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

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiados intentos de autenticación, por favor intente más tarde.',
  skipSuccessfulRequests: true,
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Middleware para parsear JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Conexión a MongoDB
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
  } catch (err) {
    console.error(`❌ Error al conectar a MongoDB (intento ${retryCount + 1}/${maxRetries}):`, err.message);
    
    if (retryCount < maxRetries - 1) {
      const delay = Math.pow(2, retryCount) * 2000;
      console.log(`🔄 Reintentando conexión en ${delay/1000} segundos...`);
      
      setTimeout(() => {
        connectDB(retryCount + 1);
      }, delay);
    } else {
      console.log('⚠️ Máximo número de reintentos alcanzado');
      process.exit(1);
    }
  }
};

connectDB();

// Middleware para logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rutas de autenticación
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Rutas para comerciantes
const merchantRoutes = require('./routes/merchantRoutes');
app.use('/api/merchant', merchantRoutes);

// Rutas para servicios
const serviceRoutes = require('./routes/services');
app.use('/api/services', serviceRoutes);

// Rutas para categorías
const categoryRoutes = require('./routes/categoryRoutes');
app.use('/api/categories', categoryRoutes);

// Rutas para carrito
const cartRoutes = require('./routes/cartRoutes');
app.use('/api/cart', cartRoutes);

// Rutas para pedidos - CRITICAL for order flow
const orderRoutes = require('./routes/orderRoutes');
app.use('/api/orders', orderRoutes);

// Rutas de búsqueda
const searchRoutes = require('./routes/searchRoutes');
app.use('/api/search', searchRoutes);

// Rutas para favoritos
const favoritesRoutes = require('./routes/favoritesRoutes');
app.use('/api/favorites', favoritesRoutes);

// Rutas para notificaciones
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', notificationRoutes);

// CRITICAL: Delivery routes for complete flow
const deliveryRoutes = require('./routes/deliveryRoutes');
app.use('/api/delivery', deliveryRoutes);

// Rutas para chat
const chatRoutes = require('./routes/chatRoutes');
app.use('/api/chat', chatRoutes);

// Rutas para reviews
const reviewRoutes = require('./routes/reviewRoutes');
app.use('/api/reviews', reviewRoutes);

// Rutas para categorías del sistema
const systemCategoryRoutes = require('./routes/systemCategoryRoutes');
app.use('/api/system-categories', systemCategoryRoutes);

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    message: 'API Rapigoo (Producción)',
    version: '1.0.0',
    status: 'active',
    endpoints: [
      '/api/auth',
      '/api/merchant', 
      '/api/orders',
      '/api/delivery',
      '/api/health'
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
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Error interno del servidor',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor de producción corriendo en http://${HOST}:${PORT}`);
  console.log(`📱 Accesible desde dispositivos en la red local`);
  console.log(`🔒 Modo: ${process.env.NODE_ENV || 'production'}`);
  
  // Mostrar endpoints críticos
  console.log('📋 Endpoints críticos disponibles:');
  console.log(`   - POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   - GET  http://localhost:${PORT}/api/delivery/active`);
  console.log(`   - POST http://localhost:${PORT}/api/orders`);
  console.log(`   - GET  http://localhost:${PORT}/api/health`);
});

// Inicializar WebSocket server para real-time updates
const socketService = require('./services/socketService');
socketService.initialize(server);

// Timeout para conexiones
server.timeout = 30000;

// Manejo de señales para cierre graceful
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
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
  mongoose.connection.close().then(() => {
    console.log('Conexión a MongoDB cerrada');
    process.exit(0);
  }).catch(err => {
    console.error('Error cerrando MongoDB:', err);
    process.exit(1);
  });
});

module.exports = app;