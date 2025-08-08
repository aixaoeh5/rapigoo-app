// Servidor simplificado con dependencias mínimas
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

console.log('🔄 Iniciando servidor Rapigoo simplificado...');

// Cargar variables de entorno
dotenv.config();

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Datos mock para desarrollo
const mockUsers = {
  'carlos.delivery@rapigoo.com': {
    _id: '507f1f77bcf86cd799439011',
    name: 'Carlos Delivery',
    email: 'carlos.delivery@rapigoo.com',
    role: 'delivery',
    phone: '+1234567890'
  }
};

const mockDeliveries = [
  {
    _id: '507f1f77bcf86cd799439012',
    orderId: '507f1f77bcf86cd799439013',
    deliveryPersonId: '507f1f77bcf86cd799439011',
    status: 'assigned',
    pickupLocation: {
      coordinates: [-69.5, -18.5],
      address: 'Restaurante El Sabor, Avenida Principal 123'
    },
    deliveryLocation: {
      coordinates: [-69.51, -18.51],
      address: 'Casa del Cliente, Calle Secundaria 456'
    },
    isLive: true,
    currentLocation: {
      coordinates: [-69.5, -18.5],
      timestamp: new Date().toISOString()
    }
  }
];

// Token simple para desarrollo
function generateToken(user) {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24)
  };
  return 'dev_token_' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

// Middleware simple de autenticación
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('🔐 Auth header:', authHeader);
  
  if (!authHeader) {
    console.log('❌ No authorization header');
    return res.status(401).json({
      success: false,
      error: { message: 'Token requerido' }
    });
  }
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  console.log('🔑 Token extracted:', token?.substring(0, 20) + '...');
  
  if (!token) {
    console.log('❌ No token found');
    return res.status(401).json({
      success: false,
      error: { message: 'Token requerido' }
    });
  }

  try {
    if (token.startsWith('dev_token_') || token.startsWith('mock_token_')) {
      const tokenData = token.replace('dev_token_', '').replace('mock_token_', '');
      const payload = JSON.parse(Buffer.from(tokenData, 'base64').toString());
      console.log('✅ Token decoded:', payload);
      req.user = payload;
      next();
    } else {
      console.log('❌ Token format not recognized:', token.substring(0, 10));
      throw new Error('Token inválido');
    }
  } catch (error) {
    console.log('❌ Token decode error:', error.message);
    return res.status(401).json({
      success: false,
      error: { message: 'Token inválido: ' + error.message }
    });
  }
}

// Rutas de autenticación
app.post('/api/auth/login/delivery', (req, res) => {
  const { email, password } = req.body;
  console.log('🚚 Login delivery:', email);

  const user = mockUsers[email];
  if (user && password === '123456') {
    const token = generateToken(user);
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        }
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: { message: 'Credenciales inválidas' }
    });
  }
});

// Rutas de delivery (con autenticación)
app.get('/api/delivery/active', verifyToken, (req, res) => {
  res.json({
    success: true,
    data: { deliveries: mockDeliveries }
  });
});

app.get('/api/delivery/nearby-orders', verifyToken, (req, res) => {
  const mockOrders = [
    {
      _id: '507f1f77bcf86cd799439013',
      orderNumber: 'RG001',
      total: 25.50,
      customerInfo: { name: 'Juan Pérez' },
      deliveryInfo: {
        address: 'Calle Secundaria 456, Ciudad'
      },
      merchant: {
        business: {
          name: 'Restaurante El Sabor',
          address: 'Avenida Principal 123'
        }
      }
    }
  ];

  res.json({
    success: true,
    data: { orders: mockOrders }
  });
});

app.post('/api/delivery/assign', (req, res) => {
  console.log('🚚 Assign delivery request:', req.body);
  console.log('🔐 Headers:', req.headers);
  console.log('👤 User from token:', req.user || 'No user (auth disabled)');
  
  const { orderId, deliveryPersonId } = req.body;
  
  // Validaciones básicas
  if (!orderId || !deliveryPersonId) {
    console.log('❌ Missing required fields:', { orderId, deliveryPersonId });
    return res.status(400).json({
      success: false,
      error: { message: 'orderId y deliveryPersonId son requeridos' }
    });
  }
  
  console.log('✅ Assigning delivery:', { orderId, deliveryPersonId, userId: req.user?.id || 'no-auth' });
  
  res.json({
    success: true,
    message: 'Delivery asignado exitosamente',
    data: { deliveryTracking: mockDeliveries[0] }
  });
});

app.put('/api/delivery/:id/location', verifyToken, (req, res) => {
  console.log('📍 Actualizando ubicación:', req.params.id, req.body);
  res.json({
    success: true,
    message: 'Ubicación actualizada exitosamente'
  });
});

app.put('/api/delivery/:id/status', verifyToken, (req, res) => {
  console.log('📊 Actualizando estado:', req.params.id, req.body);
  res.json({
    success: true,
    message: 'Estado actualizado exitosamente'
  });
});

app.post('/api/delivery/:id/route-optimization', verifyToken, (req, res) => {
  const { waypoints } = req.body;
  console.log('🗺️ Optimizando ruta:', req.params.id, waypoints?.length, 'waypoints');
  
  res.json({
    success: true,
    data: {
      route: {
        totalDistance: 5000, // 5km
        totalDuration: 900, // 15 minutos
        optimized: true,
        method: 'mock'
      }
    }
  });
});

app.post('/api/delivery/batch-location-update', verifyToken, (req, res) => {
  const { locations } = req.body;
  console.log('📍 Batch location update:', locations?.length, 'locations');
  
  res.json({
    success: true,
    message: `${locations?.length || 0} ubicaciones procesadas`,
    data: { processedCount: locations?.length || 0 }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor funcionando',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test endpoint sin autenticación para debug
app.post('/api/delivery/assign-test', (req, res) => {
  console.log('🧪 Test assign (sin auth):', req.body);
  console.log('🧪 Headers:', req.headers);
  
  res.json({
    success: true,
    message: 'Test assign exitoso - sin autenticación',
    data: { deliveryTracking: mockDeliveries[0] }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    success: false,
    error: { message: 'Error interno del servidor' }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Ruta no encontrada' }
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Rapigoo ejecutándose en puerto ${PORT}`);
  console.log(`📡 Local: http://localhost:${PORT}`);
  console.log(`🔗 React Native: http://10.0.0.198:${PORT}`);
  console.log('');
  console.log('📋 Rutas API disponibles:');
  console.log('  POST /api/auth/login/delivery');
  console.log('  GET  /api/delivery/active');
  console.log('  GET  /api/delivery/nearby-orders');
  console.log('  POST /api/delivery/assign');
  console.log('  PUT  /api/delivery/:id/location');
  console.log('  PUT  /api/delivery/:id/status');
  console.log('  POST /api/delivery/:id/route-optimization');
  console.log('  POST /api/delivery/batch-location-update');
  console.log('  GET  /api/health');
  console.log('');
  console.log('🔑 Credenciales de prueba:');
  console.log('  Email: carlos.delivery@rapigoo.com');
  console.log('  Password: 123456');
  console.log('');
  console.log('✅ Servidor listo para navegación GPS!');
});

module.exports = app;