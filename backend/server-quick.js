const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' })); // Permitir todo en desarrollo
app.use(express.json());

// Mock user data
const mockUser = {
  _id: '689e8e656f6a650af09b91cb',
  name: 'Test User',
  email: 'test@example.com',
  password: '$2a$10$YourHashedPasswordHere', // password123
  role: 'cliente',
  isVerified: true
};

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'API Rapigoo (Quick Server)',
    version: '1.0.0',
    status: 'active'
  });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  console.log('🔐 Login attempt:', req.body);
  
  const { email, password } = req.body;
  
  // Simple validation
  if (!email || !password) {
    return res.status(400).json({ 
      message: 'Email y contraseña son requeridos' 
    });
  }
  
  // Mock authentication
  if (email === 'test@example.com' && password === 'password123') {
    const token = jwt.sign(
      { id: mockUser._id }, 
      process.env.JWT_SECRET || 'secret123', 
      { expiresIn: '7d' }
    );
    
    return res.status(200).json({
      token,
      user: {
        id: mockUser._id,
        name: mockUser.name,
        role: mockUser.role
      }
    });
  }
  
  // Invalid credentials
  return res.status(400).json({ 
    message: 'Email o contraseña incorrectos' 
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Quick Server corriendo en http://0.0.0.0:${PORT}`);
  console.log(`📱 Accesible desde cualquier dispositivo en la red`);
  console.log(`🔗 Endpoints disponibles:`);
  console.log(`   - POST http://172.26.236.81:${PORT}/api/auth/login (WSL)`);
  console.log(`   - POST http://10.0.0.198:${PORT}/api/auth/login (Windows IP)`);
  console.log(`   - GET  http://172.26.236.81:${PORT}/api/health`);
  console.log(`\n🔑 Credenciales de prueba:`);
  console.log(`   Email: test@example.com`);
  console.log(`   Password: password123`);
  
  // Configurar port forwarding WSL -> Windows
  console.log(`\n🔧 Para acceso desde dispositivo físico:`);
  console.log(`   1. Ejecuta en PowerShell (como administrador):`);
  console.log(`      netsh interface portproxy add v4tov4 listenport=${PORT} listenaddress=10.0.0.198 connectport=${PORT} connectaddress=172.26.236.81`);
  console.log(`   2. O usa ngrok: ngrok http ${PORT}`);
  console.log(`   3. Verifica firewall Windows permite puerto ${PORT}`);
});