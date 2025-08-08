const express = require('express');
const DeliveryTracking = require('../models/DeliveryTracking');
const Order = require('../models/Order');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { cachePresets, invalidateCache } = require('../middleware/cache');
const { securityMonitoring } = require('../middleware/monitoring');
const routeOptimizationService = require('../services/routeOptimizationService');
const Joi = require('joi');
const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verifyToken);

// Esquemas de validación
const assignDeliverySchema = Joi.object({
  orderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  deliveryPersonId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
});

const updateLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  accuracy: Joi.number().min(0).optional(),
  altitude: Joi.number().optional(),
  altitudeAccuracy: Joi.number().optional(),
  heading: Joi.number().min(0).max(360).optional(),
  speed: Joi.number().min(0).optional()
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery', 'delivered', 'cancelled').required(),
  notes: Joi.string().max(500).optional(),
  location: updateLocationSchema.optional()
});

const completeDeliverySchema = Joi.object({
  notes: Joi.string().max(1000).optional(),
  photo: Joi.string().uri().optional(),
  signature: Joi.string().optional()
});

// POST /api/delivery/assign - Asignar delivery a un pedido (solo comerciantes)
router.post('/assign', invalidateCache(['api:delivery:*', 'api:orders:*']), async (req, res) => {
  try {
    const { error, value } = assignDeliverySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    let { orderId, deliveryPersonId } = value;

    // Verificar que el usuario es comerciante o delivery
    if (req.user.role !== 'merchant' && req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los comerciantes y delivery persons pueden asignar deliveries',
          code: 'ACCESS_DENIED'
        }
      });
    }
    
    // Si es delivery person, asignar a sí mismo
    if (req.user.role === 'delivery') {
      deliveryPersonId = req.user.id;
    }

    // Verificar que el pedido existe y pertenece al comerciante
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Verificar acceso según el rol
    if (req.user.role === 'merchant') {
      // Los comerciantes solo pueden asignar sus propios pedidos
      if (order.merchantId.toString() !== req.user.id) {
        securityMonitoring.suspiciousActivity(req, 'Unauthorized delivery assignment attempt');
        return res.status(403).json({
          success: false,
          error: {
            message: 'No tienes acceso a este pedido',
            code: 'ACCESS_DENIED'
          }
        });
      }
    } else if (req.user.role === 'delivery') {
      // Los delivery persons pueden tomar pedidos que estén listos y sin asignar
      if (order.deliveryPersonId) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Este pedido ya tiene un delivery asignado',
            code: 'DELIVERY_ALREADY_ASSIGNED'
          }
        });
      }
    }

    // Verificar que el pedido está listo para delivery
    if (!['ready', 'assigned'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'El pedido no está listo para asignar delivery',
          code: 'INVALID_ORDER_STATUS'
        }
      });
    }

    // Verificar que el delivery person existe y es delivery
    const deliveryPerson = await User.findById(deliveryPersonId);
    if (!deliveryPerson || deliveryPerson.role !== 'delivery') {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Persona de delivery no encontrada',
          code: 'DELIVERY_PERSON_NOT_FOUND'
        }
      });
    }

    // Verificar que no existe un tracking activo para este pedido
    const existingTracking = await DeliveryTracking.findOne({ orderId });
    if (existingTracking && existingTracking.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Este pedido ya tiene un delivery asignado',
          code: 'DELIVERY_ALREADY_ASSIGNED'
        }
      });
    }

    // Obtener información del comerciante para pickup location
    const merchant = await User.findById(order.merchantId);
    const pickupCoordinates = merchant.business?.coordinates || [0, 0];
    const deliveryCoordinates = order.deliveryInfo.coordinates;

    // Crear o actualizar delivery tracking
    let deliveryTracking;
    if (existingTracking) {
      deliveryTracking = existingTracking;
      deliveryTracking.status = 'assigned';
      deliveryTracking.deliveryPersonId = deliveryPersonId;
      deliveryTracking.isLive = true;
    } else {
      deliveryTracking = new DeliveryTracking({
        orderId,
        deliveryPersonId,
        status: 'assigned',
        pickupLocation: {
          coordinates: pickupCoordinates,
          address: merchant.business?.address || 'Dirección del comerciante'
        },
        deliveryLocation: {
          coordinates: deliveryCoordinates,
          address: `${order.deliveryInfo.address.street}, ${order.deliveryInfo.address.city}`
        },
        isLive: true
      });
    }

    await deliveryTracking.save();

    // Actualizar el pedido
    order.deliveryPersonId = deliveryPersonId;
    if (order.status === 'ready') {
      await order.updateStatus('assigned', 'Delivery asignado');
    }

    // Populate para respuesta
    await deliveryTracking.populate([
      { path: 'orderId', select: 'orderNumber total' },
      { path: 'deliveryPersonId', select: 'name phone' }
    ]);

    res.json({
      success: true,
      message: 'Delivery asignado exitosamente',
      data: {
        deliveryTracking
      }
    });

  } catch (error) {
    console.error('Error assigning delivery:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// PUT /api/delivery/:id/location - Actualizar ubicación del delivery
router.put('/:id/location', invalidateCache(['api:delivery:*']), async (req, res) => {
  try {
    const { error, value } = updateLocationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Datos de ubicación inválidos',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const deliveryTracking = await DeliveryTracking.findById(req.params.id);
    if (!deliveryTracking) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tracking de delivery no encontrado',
          code: 'DELIVERY_TRACKING_NOT_FOUND'
        }
      });
    }

    // Solo el delivery person puede actualizar su ubicación
    if (deliveryTracking.deliveryPersonId.toString() !== req.user.id) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized delivery location update attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este delivery',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Solo se puede actualizar la ubicación si el delivery está activo
    if (!deliveryTracking.isLive) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Este delivery no está activo',
          code: 'DELIVERY_NOT_ACTIVE'
        }
      });
    }

    // Actualizar ubicación
    await deliveryTracking.updateLocation(value);

    res.json({
      success: true,
      message: 'Ubicación actualizada exitosamente',
      data: {
        currentLocation: deliveryTracking.currentLocation,
        status: deliveryTracking.status,
        currentETA: deliveryTracking.currentETA,
        distanceToPickup: deliveryTracking.distanceToPickup,
        distanceToDelivery: deliveryTracking.distanceToDelivery
      }
    });

  } catch (error) {
    console.error('Error updating delivery location:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// PUT /api/delivery/:id/status - Actualizar estado del delivery
router.put('/:id/status', invalidateCache(['api:delivery:*', 'api:orders:*']), async (req, res) => {
  try {
    const { error, value } = updateStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { status, notes, location } = value;

    const deliveryTracking = await DeliveryTracking.findById(req.params.id);
    if (!deliveryTracking) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tracking de delivery no encontrado',
          code: 'DELIVERY_TRACKING_NOT_FOUND'
        }
      });
    }

    // Solo el delivery person puede actualizar el estado
    if (deliveryTracking.deliveryPersonId.toString() !== req.user.id) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized delivery status update attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este delivery',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Actualizar estado
    await deliveryTracking.updateStatus(status, notes, location);

    // Actualizar estado del pedido si es necesario
    const order = await Order.findById(deliveryTracking.orderId);
    if (order) {
      switch (status) {
        case 'picked_up':
          if (order.status === 'assigned') {
            await order.updateStatus('picked_up', 'Pedido recogido por el delivery');
          }
          break;
        case 'delivered':
          if (order.status !== 'delivered') {
            await order.updateStatus('delivered', 'Pedido entregado');
          }
          break;
      }
    }

    // Populate para respuesta
    await deliveryTracking.populate([
      { path: 'orderId', select: 'orderNumber total status' },
      { path: 'deliveryPersonId', select: 'name phone' }
    ]);

    res.json({
      success: true,
      message: 'Estado del delivery actualizado exitosamente',
      data: {
        deliveryTracking
      }
    });

  } catch (error) {
    console.error('Error updating delivery status:', error);
    
    if (error.message.includes('Cannot transition')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INVALID_STATUS_TRANSITION'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// POST /api/delivery/:id/complete - Completar delivery
router.post('/:id/complete', invalidateCache(['api:delivery:*', 'api:orders:*']), async (req, res) => {
  try {
    const { error, value } = completeDeliverySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const deliveryTracking = await DeliveryTracking.findById(req.params.id);
    if (!deliveryTracking) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tracking de delivery no encontrado',
          code: 'DELIVERY_TRACKING_NOT_FOUND'
        }
      });
    }

    // Solo el delivery person puede completar el delivery
    if (deliveryTracking.deliveryPersonId.toString() !== req.user.id) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized delivery completion attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este delivery',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Completar delivery
    await deliveryTracking.completeDelivery(value);

    // Actualizar pedido a entregado
    const order = await Order.findById(deliveryTracking.orderId);
    if (order && order.status !== 'delivered') {
      await order.updateStatus('delivered', 'Pedido entregado exitosamente');
    }

    // Populate para respuesta
    await deliveryTracking.populate([
      { path: 'orderId', select: 'orderNumber total status' },
      { path: 'deliveryPersonId', select: 'name phone' }
    ]);

    res.json({
      success: true,
      message: 'Delivery completado exitosamente',
      data: {
        deliveryTracking
      }
    });

  } catch (error) {
    console.error('Error completing delivery:', error);
    
    if (error.message.includes('Cannot complete delivery')) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INVALID_DELIVERY_STATUS'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/delivery/active - Obtener deliveries activos del usuario
router.get('/active', cachePresets.static, async (req, res) => {
  try {
    let deliveries;

    if (req.user.role === 'delivery') {
      // Delivery person ve sus deliveries activos
      deliveries = await DeliveryTracking.findActiveDeliveries(req.user.id);
    } else if (req.user.role === 'merchant') {
      // Comerciante ve deliveries de sus pedidos
      const orders = await Order.find({ merchantId: req.user.id }).select('_id');
      const orderIds = orders.map(order => order._id);
      
      deliveries = await DeliveryTracking.find({
        orderId: { $in: orderIds },
        status: { $in: ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'] }
      })
      .populate('orderId', 'orderNumber total status')
      .populate('deliveryPersonId', 'name phone')
      .sort({ createdAt: -1 });
    } else {
      // Cliente ve delivery de sus pedidos
      const orders = await Order.find({ customerId: req.user.id }).select('_id');
      const orderIds = orders.map(order => order._id);
      
      deliveries = await DeliveryTracking.find({
        orderId: { $in: orderIds },
        status: { $in: ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'] }
      })
      .populate('orderId', 'orderNumber total status')
      .populate('deliveryPersonId', 'name phone')
      .sort({ createdAt: -1 });
    }

    res.json({
      success: true,
      data: {
        deliveries
      }
    });

  } catch (error) {
    console.error('Error fetching active deliveries:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/delivery/order/:orderId - Obtener tracking por pedido
router.get('/order/:orderId', cachePresets.static, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Verificar que el pedido existe
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Verificar acceso al pedido
    const hasAccess = order.customerId.toString() === req.user.id ||
                      order.merchantId.toString() === req.user.id ||
                      (order.deliveryPersonId && order.deliveryPersonId.toString() === req.user.id);

    if (!hasAccess) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized delivery tracking access attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este pedido',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const deliveryTracking = await DeliveryTracking.findByOrder(orderId);

    if (!deliveryTracking) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'No se encontró tracking para este pedido',
          code: 'DELIVERY_TRACKING_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: {
        deliveryTracking
      }
    });

  } catch (error) {
    console.error('Error fetching delivery tracking:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/delivery/:id - Obtener detalles de un delivery específico
router.get('/:id', cachePresets.static, async (req, res) => {
  try {
    const deliveryTracking = await DeliveryTracking.findById(req.params.id)
      .populate('orderId', 'orderNumber total status customerId merchantId')
      .populate('deliveryPersonId', 'name phone email');

    if (!deliveryTracking) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tracking de delivery no encontrado',
          code: 'DELIVERY_TRACKING_NOT_FOUND'
        }
      });
    }

    // Verificar acceso
    const hasAccess = deliveryTracking.deliveryPersonId._id.toString() === req.user.id ||
                      deliveryTracking.orderId.customerId.toString() === req.user.id ||
                      deliveryTracking.orderId.merchantId.toString() === req.user.id;

    if (!hasAccess) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized delivery tracking access attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este delivery',
          code: 'ACCESS_DENIED'
        }
      });
    }

    res.json({
      success: true,
      data: {
        deliveryTracking
      }
    });

  } catch (error) {
    console.error('Error fetching delivery tracking:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/delivery/stats/delivery-person - Estadísticas del delivery person
router.get('/stats/delivery-person', async (req, res) => {
  try {
    // Solo delivery persons pueden ver sus estadísticas
    if (req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los delivery persons pueden ver estas estadísticas',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const { startDate, endDate } = req.query;
    const dateRange = {};
    
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const stats = await DeliveryTracking.getDeliveryStats(req.user.id, dateRange);

    res.json({
      success: true,
      data: {
        stats: stats[0] || {
          totalDeliveries: 0,
          completedDeliveries: 0,
          cancelledDeliveries: 0,
          totalDistance: 0,
          averageTime: 0,
          onTimeDeliveries: 0,
          completionRate: 0,
          onTimeRate: 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching delivery stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/delivery/nearby-orders - Pedidos cercanos para delivery
router.get('/nearby-orders', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query; // radius en km
    
    if (req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        error: { message: 'Solo delivery persons pueden ver pedidos cercanos' }
      });
    }

    // Buscar pedidos ready sin delivery asignado cerca de la ubicación
    const nearbyOrders = await Order.aggregate([
      {
        $match: {
          status: 'ready',
          deliveryPersonId: { $exists: false }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $match: {
          'merchant.business.coordinates': {
            $geoWithin: {
              $centerSphere: [[parseFloat(longitude), parseFloat(latitude)], radius / 6371]
            }
          }
        }
      },
      {
        $project: {
          orderNumber: 1,
          total: 1,
          customerInfo: 1,
          deliveryInfo: 1,
          merchant: { $arrayElemAt: ['$merchant', 0] },
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json({
      success: true,
      data: { orders: nearbyOrders }
    });

  } catch (error) {
    console.error('Error fetching nearby orders:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Error interno del servidor' }
    });
  }
});

// POST /api/delivery/batch-location-update - Actualización por lotes de ubicación
router.post('/batch-location-update', verifyToken, async (req, res) => {
  try {
    const { locations } = req.body;
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Se requiere un array de ubicaciones' }
      });
    }

    // Validar que el usuario sea delivery
    if (req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        error: { message: 'Solo delivery persons pueden actualizar ubicación' }
      });
    }

    // Buscar delivery tracking activo del usuario
    const activeDelivery = await DeliveryTracking.findOne({
      deliveryPersonId: req.user.id,
      isLive: true
    });

    if (!activeDelivery) {
      return res.status(404).json({
        success: false,
        error: { message: 'No hay delivery activo para este usuario' }
      });
    }

    // Procesar ubicaciones por lotes
    const processedLocations = [];
    
    for (const location of locations) {
      if (location.accuracy && location.accuracy <= 100) { // Filtro de precisión
        processedLocations.push({
          coordinates: [location.longitude, location.latitude],
          accuracy: location.accuracy,
          speed: location.speed || 0,
          heading: location.heading || 0,
          timestamp: location.timestamp || new Date().toISOString()
        });
      }
    }

    if (processedLocations.length > 0) {
      // Actualizar con la ubicación más reciente
      const latestLocation = processedLocations[processedLocations.length - 1];
      
      activeDelivery.currentLocation = latestLocation;
      activeDelivery.locationHistory.push(...processedLocations);
      
      // Mantener solo las últimas 100 ubicaciones en el historial
      if (activeDelivery.locationHistory.length > 100) {
        activeDelivery.locationHistory = activeDelivery.locationHistory.slice(-100);
      }
      
      await activeDelivery.save();
      
      // Emitir actualización en tiempo real
      req.app.get('io').emit('delivery_location_updated', {
        orderId: activeDelivery.orderId,
        deliveryPersonId: activeDelivery.deliveryPersonId,
        location: latestLocation
      });
    }

    res.json({
      success: true,
      message: `${processedLocations.length} ubicaciones procesadas`,
      data: { processedCount: processedLocations.length }
    });

  } catch (error) {
    console.error('Error in batch location update:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Error interno del servidor' }
    });
  }
});

// POST /api/delivery/:id/route-optimization - Optimización de ruta
router.post('/:id/route-optimization', async (req, res) => {
  try {
    const { waypoints, optimize = true } = req.body;
    
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return res.status(400).json({
        success: false,
        error: { message: 'Se requieren al menos 2 waypoints' }
      });
    }

    const deliveryTracking = await DeliveryTracking.findById(req.params.id);
    if (!deliveryTracking) {
      return res.status(404).json({
        success: false,
        error: { message: 'Delivery tracking no encontrado' }
      });
    }

    // Verificar acceso
    if (deliveryTracking.deliveryPersonId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: { message: 'No tienes acceso a este delivery' }
      });
    }

    // Usar el servicio de optimización de rutas
    const formattedWaypoints = waypoints.map(wp => ({
      lat: wp.latitude,
      lng: wp.longitude,
      address: wp.address || `${wp.latitude}, ${wp.longitude}`
    }));

    const optimizedRoute = await routeOptimizationService.optimizeRoute(
      formattedWaypoints,
      { optimize, mode: 'driving' }
    );
    
    res.json({
      success: true,
      data: { route: optimizedRoute }
    });

  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Error optimizando ruta' }
    });
  }
});

// Función auxiliar para calcular distancia (ya existe en el frontend, duplicamos aquí)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

module.exports = router;