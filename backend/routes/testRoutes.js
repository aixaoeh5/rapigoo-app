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

// POST /api/test/delivery-transition - Simular transición de delivery para testing
router.post('/delivery-transition', devOnly, async (req, res) => {
  try {
    const { deliveryId, newStatus, notes = 'Test transition' } = req.body;

    if (!deliveryId || !newStatus) {
      return res.status(400).json({
        success: false,
        error: 'deliveryId y newStatus son requeridos'
      });
    }

    console.log('🧪 TEST: Simulando transición de delivery:', {
      deliveryId,
      newStatus,
      notes
    });

    // Simular la validación que hacemos en delivery routes
    const DeliveryTracking = require('../models/DeliveryTracking');
    const delivery = await DeliveryTracking.findById(deliveryId);
    
    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery tracking no encontrado'
      });
    }

    console.log('🧪 TEST: Estado actual:', delivery.status);
    console.log('🧪 TEST: Transición intentada:', `${delivery.status} → ${newStatus}`);

    // Verificar transiciones válidas
    const validTransitions = {
      assigned: ['heading_to_pickup', 'cancelled'],
      heading_to_pickup: ['at_pickup', 'cancelled'],
      at_pickup: ['picked_up', 'cancelled'],
      picked_up: ['heading_to_delivery', 'at_delivery', 'cancelled'],
      heading_to_delivery: ['at_delivery', 'cancelled'],
      at_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };

    const allowedTransitions = validTransitions[delivery.status] || [];
    const isValidTransition = allowedTransitions.includes(newStatus);

    res.json({
      success: true,
      data: {
        currentStatus: delivery.status,
        attemptedStatus: newStatus,
        isValidTransition,
        allowedTransitions,
        message: isValidTransition ? 
          'Transición válida' : 
          `Transición inválida: ${delivery.status} → ${newStatus}`
      }
    });

  } catch (error) {
    console.error('🧪 TEST: Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;