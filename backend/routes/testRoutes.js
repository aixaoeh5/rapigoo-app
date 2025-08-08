/**
 * Rutas de prueba para verificar configuración del sistema
 * Solo disponibles en modo desarrollo
 */

const express = require('express');
const router = express.Router();
const emailService = require('../utils/emailService');
const User = require('../models/User');

// Middleware para solo permitir en desarrollo
const devOnly = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ 
      message: 'Endpoints de prueba solo disponibles en desarrollo' 
    });
  }
  next();
};

// Estado del servicio de email
router.get('/email-status', devOnly, (req, res) => {
  const status = emailService.getStatus();
  res.json({
    timestamp: new Date().toISOString(),
    emailService: status,
    environment: process.env.NODE_ENV,
    hasMongoUri: !!process.env.MONGO_URI,
    hasJwtSecret: !!process.env.JWT_SECRET,
    backendPort: process.env.PORT || 5000
  });
});

// Probar envío de email de verificación
router.post('/test-verification-email', devOnly, async (req, res) => {
  const { email = 'test@example.com', name = 'Usuario Test' } = req.body;
  
  try {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const result = await emailService.sendVerificationCode(email, code, name);
    
    res.json({
      success: true,
      message: 'Email de prueba enviado',
      testCode: result.code, // Solo en desarrollo
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al enviar email de prueba',
      error: error.message
    });
  }
});

// Probar envío de email de recuperación
router.post('/test-reset-email', devOnly, async (req, res) => {
  const { email = 'test@example.com' } = req.body;
  
  try {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const result = await emailService.sendPasswordResetCode(email, code);
    
    res.json({
      success: true,
      message: 'Email de recuperación de prueba enviado',
      testCode: result.code, // Solo en desarrollo
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al enviar email de recuperación de prueba',
      error: error.message
    });
  }
});

// Listar usuarios de prueba
router.get('/test-users', devOnly, async (req, res) => {
  try {
    const users = await User.find({
      email: { $in: ['cliente@test.com', 'comerciante@test.com', 'admin@test.com'] }
    }).select('-password -verificationCode');
    
    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isVerified: user.isVerified,
        status: user.status,
        businessName: user.business?.businessName || null,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios de prueba',
      error: error.message
    });
  }
});

// Crear usuarios de prueba desde API
router.post('/create-test-users', devOnly, async (req, res) => {
  try {
    const { createTestUsers } = require('../scripts/createTestUsers');
    await createTestUsers();
    
    res.json({
      success: true,
      message: 'Usuarios de prueba creados/actualizados exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear usuarios de prueba',
      error: error.message
    });
  }
});

module.exports = router;