const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const User = require('../models/User');

// Modelo para tokens de dispositivos
const DeviceToken = require('../models/DeviceToken');

// Esquemas de validación
const registerDeviceSchema = Joi.object({
  deviceToken: Joi.string().required().messages({
    'any.required': 'El token del dispositivo es requerido'
  }),
  platform: Joi.string().valid('ios', 'android').required().messages({
    'any.required': 'La plataforma es requerida',
    'any.only': 'Plataforma debe ser ios o android'
  }),
  deviceInfo: Joi.object({
    model: Joi.string().optional(),
    version: Joi.string().optional(),
    appVersion: Joi.string().optional()
  }).optional()
});

const preferencesSchema = Joi.object({
  orderUpdates: Joi.boolean().default(true),
  promotions: Joi.boolean().default(true),
  newMerchants: Joi.boolean().default(true),
  sound: Joi.boolean().default(true),
  vibrate: Joi.boolean().default(true),
  quiet_hours: Joi.object({
    enabled: Joi.boolean().default(false),
    start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
  }).optional()
});

const sendNotificationSchema = Joi.object({
  title: Joi.string().required().max(100),
  message: Joi.string().required().max(500),
  data: Joi.object().optional(),
  userIds: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).optional(),
  merchantIds: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).optional(),
  broadcast: Joi.boolean().default(false),
  category: Joi.string().valid('order', 'promotion', 'system', 'merchant').default('system'),
  scheduledFor: Joi.date().optional()
});

// Registrar token de dispositivo
const registerDevice = async (req, res) => {
  try {
    const { error, value } = registerDeviceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const userId = req.user.id;
    const { deviceToken, platform, deviceInfo } = value;

    // Buscar o crear registro de dispositivo
    let device = await DeviceToken.findOne({ deviceToken });

    if (device) {
      // Actualizar dispositivo existente
      device.userId = userId;
      device.platform = platform;
      device.deviceInfo = deviceInfo || device.deviceInfo;
      device.isActive = true;
      device.lastUpdated = new Date();
      await device.save();
    } else {
      // Crear nuevo registro
      device = new DeviceToken({
        userId,
        deviceToken,
        platform,
        deviceInfo,
        isActive: true
      });
      await device.save();
    }

    // Desactivar otros tokens del mismo usuario en la misma plataforma
    await DeviceToken.updateMany(
      { 
        userId, 
        platform, 
        deviceToken: { $ne: deviceToken },
        isActive: true 
      },
      { isActive: false }
    );

    res.json({
      success: true,
      message: 'Dispositivo registrado exitosamente',
      deviceId: device._id
    });

  } catch (error) {
    console.error('Error registrando dispositivo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Actualizar preferencias de notificaciones
const updatePreferences = async (req, res) => {
  try {
    const { error, value } = preferencesSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const userId = req.user.id;

    const updateResult = await User.updateOne(
      { _id: userId },
      { 
        $set: { 'notificationPreferences': value }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se pudieron actualizar las preferencias'
      });
    }

    res.json({
      success: true,
      message: 'Preferencias actualizadas exitosamente',
      preferences: value
    });

  } catch (error) {
    console.error('Error actualizando preferencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener preferencias de notificaciones
const getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('notificationPreferences');
    
    const defaultPreferences = {
      orderUpdates: true,
      promotions: true,
      newMerchants: true,
      sound: true,
      vibrate: true,
      quiet_hours: {
        enabled: false,
        start: '22:00',
        end: '07:00'
      }
    };

    const preferences = user?.notificationPreferences || defaultPreferences;

    res.json({
      success: true,
      preferences
    });

  } catch (error) {
    console.error('Error obteniendo preferencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener historial de notificaciones del usuario
const getNotificationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // En un escenario real, tendrías una colección de notificaciones
    // Por ahora, simular respuesta vacía
    const notifications = [];
    const total = 0;

    res.json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Marcar notificación como leída
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    // En un escenario real, actualizarías el estado en la base de datos
    // Por ahora, simular éxito
    
    res.json({
      success: true,
      message: 'Notificación marcada como leída',
      notificationId
    });

  } catch (error) {
    console.error('Error marcando como leída:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Desregistrar dispositivo
const unregisterDevice = async (req, res) => {
  try {
    const { deviceToken } = req.body;
    const userId = req.user.id;

    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        error: 'Token del dispositivo requerido'
      });
    }

    const updateResult = await DeviceToken.updateOne(
      { userId, deviceToken },
      { isActive: false, unregisteredAt: new Date() }
    );

    res.json({
      success: true,
      message: 'Dispositivo desregistrado exitosamente',
      updated: updateResult.modifiedCount > 0
    });

  } catch (error) {
    console.error('Error desregistrando dispositivo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de notificaciones (admin)
const getNotificationStats = async (req, res) => {
  try {
    const [
      totalDevices,
      activeDevices,
      iosDevices,
      androidDevices,
      recentRegistrations
    ] = await Promise.all([
      DeviceToken.countDocuments(),
      DeviceToken.countDocuments({ isActive: true }),
      DeviceToken.countDocuments({ platform: 'ios', isActive: true }),
      DeviceToken.countDocuments({ platform: 'android', isActive: true }),
      DeviceToken.countDocuments({ 
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
    ]);

    res.json({
      success: true,
      stats: {
        totalDevices,
        activeDevices,
        devicesByPlatform: {
          ios: iosDevices,
          android: androidDevices
        },
        recentRegistrations
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Función auxiliar para enviar notificaciones push (integrar con servicio como FCM/APNs)
const sendPushNotification = async (deviceTokens, notification) => {
  // Aquí integrarías con Firebase Cloud Messaging, Apple Push Notification service, etc.
  console.log('📤 Enviando notificación push:', {
    tokens: deviceTokens.length,
    title: notification.title,
    message: notification.message
  });
  
  // Simulación - en producción usar FCM SDK o similar
  return {
    success: true,
    sent: deviceTokens.length,
    failed: 0
  };
};

// Enviar notificación personalizada (admin/system)
const sendCustomNotification = async (req, res) => {
  try {
    const { error, value } = sendNotificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const { title, message, data, userIds, merchantIds, broadcast, category } = value;

    let targetQuery = { isActive: true };

    if (broadcast) {
      // Enviar a todos los dispositivos activos
    } else if (userIds && userIds.length > 0) {
      targetQuery.userId = { $in: userIds };
    } else if (merchantIds && merchantIds.length > 0) {
      targetQuery.userId = { $in: merchantIds };
    } else {
      return res.status(400).json({
        success: false,
        error: 'Debe especificar destinatarios o usar broadcast'
      });
    }

    // Obtener tokens de dispositivos
    const devices = await DeviceToken.find(targetQuery).select('deviceToken platform');
    
    if (devices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se encontraron dispositivos de destino'
      });
    }

    // Enviar notificaciones
    const tokens = devices.map(device => device.deviceToken);
    const result = await sendPushNotification(tokens, {
      title,
      message,
      data: { ...data, category }
    });

    res.json({
      success: true,
      message: 'Notificaciones enviadas',
      sent: result.sent,
      failed: result.failed,
      totalTargets: devices.length
    });

  } catch (error) {
    console.error('Error enviando notificación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Rutas públicas (con autenticación)
router.post('/register', verifyToken, registerDevice);
router.put('/preferences', verifyToken, updatePreferences);
router.get('/preferences', verifyToken, getPreferences);
router.get('/history', verifyToken, getNotificationHistory);
router.put('/read/:notificationId', verifyToken, markAsRead);
router.post('/unregister', verifyToken, unregisterDevice);

// Rutas administrativas
router.get('/admin/stats', getNotificationStats);
router.post('/admin/send', sendCustomNotification);

module.exports = router;