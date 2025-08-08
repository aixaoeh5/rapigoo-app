// Servidor mínimo para pruebas de navegación GPS
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 5000;

// Datos mock para pruebas
const mockUsers = {
  'carlos.delivery@rapigoo.com': {
    id: '507f1f77bcf86cd799439011',
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

function generateToken(user) {
  // Token mock simple para pruebas
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 horas
  };
  
  return 'mock_token_' + Buffer.from(JSON.stringify(payload)).toString('base64');
}

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function jsonResponse(res, statusCode, data) {
  corsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const pathname = parsedUrl.pathname;

  console.log(`📡 ${method} ${pathname}`);
  
  // Log especial para delivery assign
  if (pathname === '/api/delivery/assign' && method === 'POST') {
    console.log('🚚 ¡Petición de assign detectada! Procesando...');
  }

  // Manejar CORS preflight
  if (method === 'OPTIONS') {
    corsHeaders(res);
    res.writeHead(200);
    res.end();
    return;
  }

  // Obtener body para POST/PUT requests
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};

      // Rutas de autenticación
      if (pathname === '/api/auth/login/delivery' && method === 'POST') {
        const { email, password } = data;
        console.log('🚚 Login delivery:', email);

        const user = mockUsers[email];
        if (user && password === '123456') { // Password mock para pruebas
          const token = generateToken(user);
          jsonResponse(res, 200, {
            success: true,
            message: 'Login exitoso',
            data: {
              token,
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone
              }
            }
          });
        } else {
          jsonResponse(res, 401, {
            success: false,
            error: { message: 'Credenciales inválidas' }
          });
        }
        return;
      }

      // Deliveries activos
      if (pathname === '/api/delivery/active' && method === 'GET') {
        jsonResponse(res, 200, {
          success: true,
          data: { deliveries: mockDeliveries }
        });
        return;
      }

      // Pedidos cercanos
      if (pathname === '/api/delivery/nearby-orders' && method === 'GET') {
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

        jsonResponse(res, 200, {
          success: true,
          data: { orders: mockOrders }
        });
        return;
      }

      // Asignar delivery
      if (pathname === '/api/delivery/assign' && method === 'POST') {
        console.log('🚚 POST /api/delivery/assign recibido');
        console.log('📦 Body:', data);
        console.log('🔐 Headers:', req.headers);
        
        jsonResponse(res, 200, {
          success: true,
          message: 'Delivery asignado exitosamente',
          data: { deliveryTracking: mockDeliveries[0] }
        });
        return;
      }

      // Actualizar ubicación
      if (pathname.startsWith('/api/delivery/') && pathname.endsWith('/location') && method === 'PUT') {
        jsonResponse(res, 200, {
          success: true,
          message: 'Ubicación actualizada exitosamente'
        });
        return;
      }

      // Actualizar estado
      if (pathname.startsWith('/api/delivery/') && pathname.endsWith('/status') && method === 'PUT') {
        jsonResponse(res, 200, {
          success: true,
          message: 'Estado actualizado exitosamente'
        });
        return;
      }

      // Health check
      if (pathname === '/api/health' && method === 'GET') {
        jsonResponse(res, 200, {
          status: 'OK',
          message: 'Servidor mock funcionando',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Ruta no encontrada
      jsonResponse(res, 404, {
        success: false,
        error: { message: 'Ruta no encontrada' }
      });

    } catch (error) {
      console.error('❌ Error:', error);
      jsonResponse(res, 500, {
        success: false,
        error: { message: 'Error interno del servidor' }
      });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor mock ejecutándose en el puerto ${PORT}`);
  console.log(`📡 Disponible en: http://localhost:${PORT}`);
  console.log(`🔗 Para React Native: http://10.0.0.198:${PORT}`);
  console.log('');
  console.log('📋 Rutas disponibles:');
  console.log('  POST /api/auth/login/delivery');
  console.log('  GET  /api/delivery/active');
  console.log('  GET  /api/delivery/nearby-orders');
  console.log('  POST /api/delivery/assign');
  console.log('  PUT  /api/delivery/:id/location');
  console.log('  PUT  /api/delivery/:id/status');
  console.log('  GET  /api/health');
  console.log('');
  console.log('🔑 Credenciales de prueba:');
  console.log('  Email: carlos.delivery@rapigoo.com');
  console.log('  Password: 123456');
});

server.timeout = 30000;