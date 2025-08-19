const express = require('express');
const DeliveryTracking = require('../models/DeliveryTracking');
const Order = require('../models/Order');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { cachePresets, invalidateCache } = require('../middleware/cache');
const { securityMonitoring } = require('../middleware/monitoring');
const { validateDeliveryData } = require('../middleware/deliveryDataValidation');
const routeOptimizationService = require('../services/routeOptimizationService');
const Joi = require('joi');
const router = express.Router();

// Aplicar autenticación y validación a todas las rutas
router.use(verifyToken);
router.use(validateDeliveryData);

// GET /api/delivery/test-history - Endpoint de prueba para debug
router.get('/test-history', async (req, res) => {
  console.log('🧪 TEST /api/delivery/test-history - Usuario:', {
    id: req.user?.id,
    role: req.user?.role,
    headers: req.headers.authorization ? 'Token presente' : 'Sin token'
  });
  
  res.json({
    success: true,
    message: 'Endpoint de prueba funcionando',
    user: {
      id: req.user?.id,
      role: req.user?.role
    },
    timestamp: new Date().toISOString()
  });
});

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
  location: updateLocationSchema.optional().allow(null)
}).options({ stripUnknown: true });

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
    const pickupCoordinates = merchant.business?.location?.coordinates || merchant.business?.coordinates || [0, 0];
    const deliveryCoordinates = order.deliveryInfo?.coordinates || order.deliveryInfo?.address?.coordinates || [0, 0];

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

    // Usar transacción para asegurar atomicidad en la asignación de delivery
    const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Verificar que no haya sido asignado a otro delivery en el interim
        const currentOrder = await Order.findById(orderId).session(session);
        if (currentOrder.deliveryPersonId && currentOrder.deliveryPersonId.toString() !== deliveryPersonId) {
          throw new Error('Order already assigned to another delivery person');
        }
        
        // Guardar el tracking
        await deliveryTracking.save({ session });
        
        // Actualizar el pedido
        currentOrder.deliveryPersonId = deliveryPersonId;
        if (currentOrder.status === 'ready') {
          await currentOrder.updateStatus('assigned', 'Delivery asignado');
        } else {
          await currentOrder.save({ session });
        }
        
        console.log(`✅ Delivery ${deliveryPersonId} asignado atómicamente al pedido ${orderId}`);
      });
    } finally {
      await session.endSession();
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
    
    // Manejar errores específicos de doble asignación
    if (error.message.includes('already assigned to another delivery person')) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Este pedido ya fue asignado a otro delivery person',
          code: 'ORDER_ALREADY_ASSIGNED'
        }
      });
    }
    
    // Manejar errores de transacción
    if (error.errorLabels && error.errorLabels.includes('TransientTransactionError')) {
      return res.status(503).json({
        success: false,
        error: {
          message: 'Servicio temporalmente no disponible. Intenta nuevamente.',
          code: 'TRANSACTION_ERROR',
          retryable: true
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

    // Actualizar ubicación con operación atómica
    const operationId = `location_${Date.now()}_${req.user.id}`;
    const updatedTracking = await deliveryTracking.updateLocation(value, operationId);
    
    console.log('📍 Ubicación actualizada exitosamente:', {
      operationId,
      status: updatedTracking.status,
      location: updatedTracking.currentLocation
    });

    res.json({
      success: true,
      message: 'Ubicación actualizada exitosamente',
      data: {
        currentLocation: updatedTracking.currentLocation,
        status: updatedTracking.status,
        currentETA: updatedTracking.currentETA,
        distanceToPickup: updatedTracking.distanceToPickup,
        distanceToDelivery: updatedTracking.distanceToDelivery,
        operationId: operationId
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
    console.log('🚚 Status update request received:');
    console.log('  - Delivery ID:', req.params.id);
    console.log('  - Request body:', JSON.stringify(req.body, null, 2));
    console.log('  - User:', req.user?.id, req.user?.role);
    
    // Obtener el estado actual antes de intentar actualizar
    const currentDelivery = await DeliveryTracking.findById(req.params.id);
    console.log('  - Current delivery status:', currentDelivery?.status);
    console.log('  - Attempted transition:', `${currentDelivery?.status} → ${req.body.status}`);
    
    const { error, value } = updateStatusSchema.validate(req.body);
    if (error) {
      console.error('❌ Status update validation failed:', {
        deliveryId: req.params.id,
        userId: req.user?.id,
        originalPayload: req.body,
        validationErrors: error.details
      });
      
      return res.status(400).json({
        success: false,
        error: {
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            receivedValue: detail.context?.value
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

    // Verificar ubicación para estados de llegada
    const ARRIVAL_THRESHOLD = 0.2; // 200 metros
    const arrivalStates = ['at_pickup', 'at_delivery'];
    
    if (arrivalStates.includes(status)) {
      if (!location || !location.latitude || !location.longitude) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Se requiere ubicación actual para marcar llegada',
            code: 'LOCATION_REQUIRED'
          }
        });
      }
      
      // Calcular distancia al destino correspondiente
      const targetLocation = status === 'at_pickup' 
        ? deliveryTracking.pickupLocation 
        : deliveryTracking.deliveryLocation;
      
      if (!targetLocation || !targetLocation.coordinates) {
        console.error('❌ No target location found for arrival verification');
        return res.status(500).json({
          success: false,
          error: {
            message: 'No se pudo verificar la ubicación de destino',
            code: 'TARGET_LOCATION_ERROR'
          }
        });
      }
      
      // Debug: Verificar formato de coordenadas
      console.log('🔍 Debug coordenadas:', {
        'currentLocation (lat, lon)': [location.latitude, location.longitude],
        'targetLocation.coordinates (lon, lat)': targetLocation.coordinates,
        'targetLocation completo': targetLocation
      });
      
      // Calcular distancia
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        targetLocation.coordinates[1], // latitude (segundo elemento en GeoJSON)
        targetLocation.coordinates[0]  // longitude (primer elemento en GeoJSON)
      );
      
      console.log(`📍 Verificación de llegada:`, {
        status: status,
        'currentLocation [lon, lat]': [location.longitude, location.latitude],
        'targetLocation [lon, lat]': targetLocation.coordinates,
        'distance': `${distance.toFixed(3)}km (${(distance * 1000).toFixed(0)}m)`,
        'threshold': `${ARRIVAL_THRESHOLD}km (${ARRIVAL_THRESHOLD * 1000}m)`,
        'isWithinRange': distance <= ARRIVAL_THRESHOLD,
        'cálculo detallado': {
          'lat1 (current)': location.latitude,
          'lon1 (current)': location.longitude,
          'lat2 (target)': targetLocation.coordinates[1],
          'lon2 (target)': targetLocation.coordinates[0]
        }
      });
      
      if (distance > ARRIVAL_THRESHOLD) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Debes estar a menos de ${ARRIVAL_THRESHOLD * 1000} metros del destino para marcar llegada. Distancia actual: ${(distance * 1000).toFixed(0)} metros`,
            code: 'TOO_FAR_FROM_DESTINATION',
            details: {
              currentDistance: distance * 1000, // en metros
              maxDistance: ARRIVAL_THRESHOLD * 1000, // en metros
              targetLocation: status === 'at_pickup' ? 'punto de recogida' : 'punto de entrega'
            }
          }
        });
      }
    }

    // ========== VALIDACIONES DE ESTADO (ANTES DE ACTUALIZAR) ==========
    
    // Verificar que el delivery no trate de cambiar manualmente desde at_pickup
    if (deliveryTracking.status === 'at_pickup') {
      // Si está en at_pickup, no puede cambiar manualmente a ningún estado
      // Solo el comerciante puede confirmar y cambiar a picked_up
      return res.status(400).json({
        success: false,
        error: {
          message: 'Has llegado al local. Espera a que el comerciante confirme la entrega del pedido.',
          code: 'WAITING_MERCHANT_CONFIRMATION',
          details: {
            currentStatus: 'at_pickup',
            attemptedStatus: status,
            requiredAction: 'El comerciante debe confirmar la entrega del pedido para continuar'
          }
        }
      });
    }

    // Verificar transiciones inválidas comunes
    if (status === 'heading_to_pickup' && deliveryTracking.status === 'at_pickup') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Ya has llegado al local. No puedes volver al estado anterior.',
          code: 'INVALID_BACKWARD_TRANSITION',
          details: {
            currentStatus: 'at_pickup',
            attemptedStatus: status,
            suggestion: 'Espera la confirmación del comerciante'
          }
        }
      });
    }

    // Verificar transiciones válidas según el modelo
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

    const allowedTransitions = validTransitions[deliveryTracking.status] || [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Transición inválida: no puedes cambiar de '${deliveryTracking.status}' a '${status}'`,
          code: 'INVALID_STATUS_TRANSITION',
          details: {
            currentStatus: deliveryTracking.status,
            attemptedStatus: status,
            allowedTransitions: allowedTransitions,
            suggestion: allowedTransitions.length > 0 ? 
              `Estados válidos: ${allowedTransitions.join(', ')}` : 
              'No hay transiciones permitidas desde este estado'
          }
        }
      });
    }

    // ========== ACTUALIZACIÓN DE ESTADO ==========
    
    // Actualizar estado con operación atómica
    const operationId = `status_${Date.now()}_${req.user.id}`;
    const updateLocation = location && typeof location === 'object' ? location : undefined;
    const updatedTracking = await deliveryTracking.updateStatus(status, notes, updateLocation, operationId);
    
    console.log('🚚 Estado actualizado exitosamente:', {
      operationId,
      previousStatus: deliveryTracking.status,
      newStatus: status,
      trackingId: deliveryTracking._id
    });

    // Actualizar estado del pedido si es necesario
    const order = await Order.findById(updatedTracking.orderId);
    if (order) {
      switch (status) {
        case 'delivered':
          if (order.status !== 'delivered') {
            await order.updateStatus('delivered', 'Pedido entregado');
            // Actualizar estadísticas del merchant cuando se entrega el pedido
            await Order.updateMerchantStats(order._id);
          }
          break;
      }
    }

    // Populate para respuesta
    await updatedTracking.populate([
      { path: 'orderId', select: 'orderNumber total status' },
      { path: 'deliveryPersonId', select: 'name phone' }
    ]);

    res.json({
      success: true,
      message: 'Estado del delivery actualizado exitosamente',
      data: {
        deliveryTracking: updatedTracking,
        operationId: operationId
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

    // Completar delivery con operación atómica
    const operationId = `complete_${Date.now()}_${req.user.id}`;
    const completedTracking = await deliveryTracking.completeDelivery(value, operationId);

    // Actualizar pedido a entregado
    const order = await Order.findById(completedTracking.orderId);
    if (order && order.status !== 'delivered') {
      await order.updateStatus('delivered', 'Pedido entregado exitosamente');
      // Actualizar estadísticas del merchant cuando se entrega el pedido
      await Order.updateMerchantStats(order._id);
    }

    // Populate para respuesta
    await completedTracking.populate([
      { path: 'orderId', select: 'orderNumber total status' },
      { path: 'deliveryPersonId', select: 'name phone' }
    ]);

    res.json({
      success: true,
      message: 'Delivery completado exitosamente',
      data: {
        deliveryTracking: completedTracking,
        operationId: operationId
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

// GET /api/delivery/:id/status - Obtener estado actual sin cambios
router.get('/:id/current-status', async (req, res) => {
  try {
    const deliveryTracking = await DeliveryTracking.findById(req.params.id)
      .populate('orderId', 'orderNumber total status')
      .populate('deliveryPersonId', 'name phone');

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
    if (deliveryTracking.deliveryPersonId._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este delivery',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Determinar qué acciones puede realizar el delivery
    const canUpdateStatus = !['at_pickup', 'delivered', 'cancelled'].includes(deliveryTracking.status);
    const nextPossibleActions = getNextPossibleActions(deliveryTracking.status);
    const isWaitingMerchant = deliveryTracking.status === 'at_pickup';

    res.json({
      success: true,
      data: {
        deliveryTracking,
        permissions: {
          canUpdateStatus,
          isWaitingMerchant,
          nextPossibleActions
        }
      }
    });

  } catch (error) {
    console.error('Error fetching delivery status:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// Función auxiliar para determinar acciones posibles
function getNextPossibleActions(currentStatus) {
  const actions = {
    assigned: ['heading_to_pickup'],
    heading_to_pickup: ['Esperar llegada automática'],
    at_pickup: ['Esperar confirmación del comerciante'],
    picked_up: ['heading_to_delivery'],
    heading_to_delivery: ['Esperar llegada automática'],
    at_delivery: ['delivered'],
    delivered: [],
    cancelled: []
  };
  return actions[currentStatus] || [];
}

// GET /api/delivery/pending-pickup - Obtener deliveries esperando confirmación del comerciante
router.get('/pending-pickup', async (req, res) => {
  try {
    if (req.user.role !== 'comerciante' && req.user.role !== 'merchant') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los comerciantes pueden ver deliveries pendientes',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Buscar pedidos del comerciante que están en at_pickup
    const orders = await Order.find({ merchantId: req.user.id }).select('_id');
    const orderIds = orders.map(order => order._id);
    
    const pendingDeliveries = await DeliveryTracking.find({
      orderId: { $in: orderIds },
      status: 'at_pickup'
    })
    .populate('orderId', 'orderNumber total items')
    .populate('deliveryPersonId', 'name phone')
    .sort({ createdAt: -1 });

    console.log(`🏪 Encontrados ${pendingDeliveries.length} deliveries esperando confirmación para comerciante ${req.user.id}`);

    const formattedDeliveries = pendingDeliveries.map(delivery => ({
      _id: delivery._id,
      status: delivery.status,
      arrivedAt: delivery.pickupLocation.arrivedAt,
      deliveryPerson: {
        name: delivery.deliveryPersonId?.name || 'Delivery',
        phone: delivery.deliveryPersonId?.phone || 'N/A'
      },
      order: {
        _id: delivery.orderId._id,
        orderNumber: delivery.orderId.orderNumber,
        total: delivery.orderId.total,
        itemsCount: delivery.orderId.items?.length || 0
      },
      waitingTime: delivery.pickupLocation.arrivedAt ? 
        Math.round((new Date() - delivery.pickupLocation.arrivedAt) / 60000) : 0, // en minutos
      canConfirm: true
    }));

    res.json({
      success: true,
      data: {
        pendingDeliveries: formattedDeliveries,
        count: formattedDeliveries.length
      }
    });

  } catch (error) {
    console.error('Error fetching pending deliveries:', error);
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
      .populate({
        path: 'orderId',
        select: 'orderNumber total status customerId merchantId',
        populate: [
          {
            path: 'customerId',
            select: 'name phone email'
          },
          {
            path: 'merchantId',
            select: 'name business',
            populate: {
              path: 'business',
              select: 'businessName'
            }
          }
        ]
      })
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
      .populate({
        path: 'orderId',
        select: 'orderNumber total status customerId merchantId',
        populate: [
          {
            path: 'customerId',
            select: 'name phone email'
          },
          {
            path: 'merchantId',
            select: 'name business',
            populate: {
              path: 'business',
              select: 'businessName'
            }
          }
        ]
      })
      .populate('deliveryPersonId', 'name phone')
      .sort({ createdAt: -1 });
    }

    // Filter out deliveries with invalid orderId references to prevent frontend crashes
    const validDeliveries = deliveries.filter(delivery => {
      if (!delivery.orderId) {
        console.error(`❌ Filtering out delivery ${delivery._id} with null orderId`);
        return false;
      }
      return true;
    });

    if (deliveries.length !== validDeliveries.length) {
      console.warn(`⚠️ Filtered out ${deliveries.length - validDeliveries.length} invalid deliveries from response`);
    }

    res.json({
      success: true,
      data: {
        deliveries: validDeliveries
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

// GET /api/delivery/orders/available - Pedidos disponibles para tomar
router.get('/orders/available', async (req, res) => {
  try {
    console.log('🚚 Solicitando pedidos disponibles para delivery');
    
    // Buscar pedidos con status 'preparing' o 'ready' que no tengan delivery asignado
    const availableOrders = await Order.find({
      status: { $in: ['preparing', 'ready'] },
      $or: [
        { deliveryPersonId: null },
        { deliveryPersonId: { $exists: false } }
      ]
    })
    .populate('customerId', 'name phone')
    .populate('merchantId', 'name business.businessName business.address business.phone business.location business.pickupAddress business.coordinates')
    .sort({ createdAt: -1 })
    .limit(20);

    console.log(`🚚 Encontrados ${availableOrders.length} pedidos disponibles`);

    // Formatear respuesta
    const formattedOrders = availableOrders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      total: order.total || 0,
      items: order.items || [],
      status: order.status,
      customerInfo: {
        name: order.customerId?.name || 'Cliente',
        phone: order.customerId?.phone || 'N/A'
      },
      deliveryInfo: {
        address: order.deliveryInfo?.address || {},
        coordinates: order.deliveryInfo?.coordinates || [],
        instructions: order.deliveryInfo?.instructions || ''
      },
      merchantInfo: {
        name: order.merchantId?.business?.businessName || order.merchantId?.name || 'Comerciante',
        phone: order.merchantId?.business?.phone || '',
        address: order.merchantId?.business?.address || '',
        location: order.merchantId?.business?.location || null,
        coordinates: order.merchantId?.business?.location?.coordinates || order.merchantId?.business?.coordinates || null,
        pickupAddress: order.merchantId?.business?.pickupAddress || {},
        fullPickupAddress: order.merchantId?.business?.pickupAddress?.street ? 
          `${order.merchantId.business.pickupAddress.street}, ${order.merchantId.business.pickupAddress.city}` :
          order.merchantId?.business?.address || 'Dirección no disponible'
      },
      createdAt: order.createdAt
    }));

    res.json({
      success: true,
      orders: formattedOrders
    });

  } catch (error) {
    console.error('Error fetching available orders:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/delivery/stats - Estadísticas generales de delivery
router.get('/stats', async (req, res) => {
  try {
    // Solo delivery persons pueden ver sus estadísticas
    if (req.user && req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los delivery persons pueden ver estas estadísticas',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Por ahora retornar estadísticas básicas
    res.json({
      success: true,
      data: {
        totalDeliveries: 0,
        completedDeliveries: 0,
        activeDeliveries: 0,
        earnings: 0,
        averageRating: 0
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

// POST /api/delivery/:id/merchant-confirm-pickup - Comerciante confirma entrega al delivery
router.post('/:id/merchant-confirm-pickup', invalidateCache(['api:delivery:*', 'api:orders:*']), async (req, res) => {
  try {
    console.log('🏪 Merchant confirm pickup request received:');
    console.log('  - Delivery ID:', req.params.id);
    console.log('  - User:', req.user?.id, req.user?.role);

    const deliveryTracking = await DeliveryTracking.findById(req.params.id).populate('orderId');
    if (!deliveryTracking) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Tracking de delivery no encontrado',
          code: 'DELIVERY_TRACKING_NOT_FOUND'
        }
      });
    }

    // Verificar que el usuario es el comerciante del pedido
    if (req.user.role !== 'comerciante' && req.user.role !== 'merchant') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los comerciantes pueden confirmar la recogida',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Verificar que el pedido pertenece al comerciante
    if (deliveryTracking.orderId.merchantId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este pedido',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Verificar que el delivery está en el estado correcto
    if (deliveryTracking.status !== 'at_pickup') {
      return res.status(400).json({
        success: false,
        error: {
          message: `No se puede confirmar recogida. Estado actual: ${deliveryTracking.status}. Debe estar en 'at_pickup'`,
          code: 'INVALID_STATUS'
        }
      });
    }

    // Actualizar a picked_up y luego automáticamente a heading_to_delivery
    const operationId = `merchant_confirm_${Date.now()}_${req.user.id}`;
    const updatedTracking = await deliveryTracking.updateStatus(
      'picked_up', 
      'Comerciante confirmó entrega al delivery', 
      null, 
      operationId
    );

    // Inmediatamente cambiar a heading_to_delivery (dirigirse al cliente)
    const headingOperationId = `auto_heading_${Date.now()}_${req.user.id}`;
    await updatedTracking.updateStatus(
      'heading_to_delivery',
      'Dirigiéndose al cliente para entrega',
      null,
      headingOperationId
    );

    // Actualizar estado del pedido
    const order = await Order.findById(updatedTracking.orderId);
    if (order) {
      if (order.status !== 'picked_up') {
        await order.updateStatus('picked_up', 'Pedido recogido por el delivery');
      }
      // Luego actualizar a in_transit
      if (order.status !== 'in_transit') {
        await order.updateStatus('in_transit', 'Pedido en camino al cliente');
      }
    }

    console.log('🏪 Comerciante confirmó recogida exitosamente:', {
      operationId,
      deliveryId: deliveryTracking._id,
      newStatus: 'picked_up'
    });

    // Populate para respuesta
    await updatedTracking.populate([
      { path: 'orderId', select: 'orderNumber total status' },
      { path: 'deliveryPersonId', select: 'name phone' }
    ]);

    res.json({
      success: true,
      message: 'Recogida confirmada exitosamente',
      data: {
        deliveryTracking: updatedTracking,
        operationId: operationId
      }
    });

  } catch (error) {
    console.error('Error confirming merchant pickup:', error);
    
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

// POST /api/delivery/orders/:orderId/accept - Aceptar un pedido disponible
router.post('/orders/:orderId/accept', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Verificar que el usuario es delivery
    if (req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los delivery persons pueden aceptar pedidos',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Verificar que el pedido existe y está disponible
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

    // Verificar que el pedido no tiene delivery asignado
    if (order.deliveryPersonId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Este pedido ya tiene un delivery asignado',
          code: 'DELIVERY_ALREADY_ASSIGNED'
        }
      });
    }

    // Verificar que el pedido está en estado válido para asignar
    if (!['preparing', 'ready'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Este pedido no está disponible para asignar',
          code: 'INVALID_ORDER_STATUS'
        }
      });
    }

    // Obtener información del comerciante para pickup location
    const merchant = await User.findById(order.merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Comerciante no encontrado',
          code: 'MERCHANT_NOT_FOUND'
        }
      });
    }

    // Obtener coordenadas del comerciante
    const pickupCoordinates = merchant.business?.location?.coordinates || merchant.business?.coordinates || [0, 0];
    const deliveryCoordinates = order.deliveryInfo?.coordinates || order.deliveryInfo?.address?.coordinates || [0, 0];

    // Crear delivery tracking
    const deliveryTracking = new DeliveryTracking({
      orderId,
      deliveryPersonId: req.user.id,
      status: 'assigned',
      pickupLocation: {
        coordinates: pickupCoordinates,
        address: merchant.business?.address || merchant.business?.pickupAddress?.street || 'Dirección del comerciante'
      },
      deliveryLocation: {
        coordinates: deliveryCoordinates,
        address: order.deliveryInfo?.address ? 
          `${order.deliveryInfo.address.street}, ${order.deliveryInfo.address.city}` : 
          'Dirección de entrega'
      },
      isLive: true
    });

    await deliveryTracking.save();

    // Actualizar el pedido
    order.deliveryPersonId = req.user.id;
    if (order.status === 'preparing' || order.status === 'ready') {
      await order.updateStatus('assigned', 'Delivery asignado');
    }

    // Populate para respuesta
    await deliveryTracking.populate([
      { path: 'orderId', select: 'orderNumber total' },
      { path: 'deliveryPersonId', select: 'name phone' }
    ]);

    res.json({
      success: true,
      message: 'Pedido aceptado exitosamente',
      tracking: deliveryTracking
    });

  } catch (error) {
    console.error('Error accepting order:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/delivery/history - Historial de entregas del delivery (DEBE ir ANTES de /:id)
router.get('/history', async (req, res) => {
  try {
    console.log('📋 GET /api/delivery/history - Usuario:', {
      id: req.user?.id,
      role: req.user?.role,
      query: req.query
    });

    // Solo delivery persons pueden ver su historial
    if (req.user.role !== 'delivery') {
      console.log('❌ Acceso denegado - rol:', req.user.role);
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los delivery persons pueden ver su historial',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const deliveryPersonId = req.user.id;
    
    console.log('📋 GET /api/delivery/history - Params:', {
      deliveryPersonId,
      status,
      page,
      limit
    });

    // Construir query
    const query = { deliveryPersonId };
    if (status && status !== 'all') {
      query.status = status;
    }

    // Obtener entregas del delivery person
    const deliveries = await DeliveryTracking.find(query)
      .populate({
        path: 'orderId',
        select: 'orderNumber total items customerInfo merchantId createdAt',
        populate: {
          path: 'merchantId',
          select: 'name business.businessName business.address'
        }
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    console.log(`📦 Entregas encontradas: ${deliveries.length}`);

    // Formatear datos para el frontend
    const formattedDeliveries = deliveries.map(delivery => ({
      _id: delivery._id,
      status: delivery.status,
      createdAt: delivery.createdAt,
      completedAt: delivery.completedAt,
      estimatedDeliveryTime: delivery.estimatedDeliveryTime,
      actualDeliveryTime: delivery.actualDeliveryTime,
      distance: delivery.distance,
      order: delivery.orderId ? {
        _id: delivery.orderId._id,
        orderNumber: delivery.orderId.orderNumber,
        total: delivery.orderId.total,
        customerInfo: delivery.orderId.customerInfo,
        merchantName: delivery.orderId.merchantId?.business?.businessName || 
                     delivery.orderId.merchantId?.name || 'Comerciante',
        merchantAddress: delivery.orderId.merchantId?.business?.address || 'Dirección no disponible',
        itemsCount: delivery.orderId.items?.length || 0
      } : null,
      earnings: delivery.earnings || (delivery.orderId?.total ? Math.round(delivery.orderId.total * 0.1) : 0),
      isActive: ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'].includes(delivery.status)
    }));

    // Separar entregas activas de historial
    const activeDeliveries = formattedDeliveries.filter(d => d.isActive);
    const historyDeliveries = formattedDeliveries.filter(d => !d.isActive);

    res.json({
      success: true,
      data: {
        activeDeliveries,
        historyDeliveries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: deliveries.length,
          hasMore: deliveries.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching delivery history:', error);
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
// NOTA: Esta ruta debe estar AL FINAL de todas las rutas específicas
router.get('/:id', cachePresets.static, async (req, res) => {
  try {
    // Validar que el parámetro id es un ObjectId válido
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'ID de delivery inválido',
          code: 'INVALID_DELIVERY_ID'
        }
      });
    }

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

// GET /api/delivery/stats - Obtener estadísticas del delivery actual
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 GET /api/delivery/stats - Obteniendo estadísticas del delivery');
    
    // Verificar que el usuario sea delivery
    if (req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los deliveries pueden ver estas estadísticas',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Obtener el usuario delivery con estadísticas
    const delivery = await User.findById(req.user.id);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Usuario delivery no encontrado',
          code: 'DELIVERY_NOT_FOUND'
        }
      });
    }

    // Inicializar delivery object si no existe
    if (!delivery.delivery) {
      delivery.delivery = {};
    }

    // Inicializar estadísticas si no existen
    if (!delivery.delivery.deliveryStats) {
      delivery.delivery.deliveryStats = {
        totalDeliveries: 0,
        completedDeliveries: 0,
        cancelledDeliveries: 0,
        averageRating: 0,
        totalEarnings: 0
      };
      await delivery.save();
    }

    // Calcular estadísticas adicionales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
    thisWeek.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // Contar entregas por periodo
    const [todayDeliveries, weekDeliveries, monthDeliveries, activeDeliveries] = await Promise.all([
      Order.countDocuments({
        deliveryPersonId: req.user.id,
        status: 'delivered',
        deliveredAt: { $gte: today }
      }),
      Order.countDocuments({
        deliveryPersonId: req.user.id,
        status: 'delivered',
        deliveredAt: { $gte: thisWeek }
      }),
      Order.countDocuments({
        deliveryPersonId: req.user.id,
        status: 'delivered',
        deliveredAt: { $gte: thisMonth }
      }),
      Order.countDocuments({
        deliveryPersonId: req.user.id,
        status: { $in: ['assigned', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'] }
      })
    ]);

    // Calcular tasa de éxito
    const successRate = delivery.delivery.deliveryStats.totalDeliveries > 0 
      ? ((delivery.delivery.deliveryStats.completedDeliveries / delivery.delivery.deliveryStats.totalDeliveries) * 100).toFixed(1)
      : 0;

    // Calcular ganancias promedio por entrega
    const averageEarningsPerDelivery = delivery.delivery.deliveryStats.completedDeliveries > 0
      ? (delivery.delivery.deliveryStats.totalEarnings / delivery.delivery.deliveryStats.completedDeliveries).toFixed(2)
      : 0;

    res.json({
      success: true,
      data: {
        // Estadísticas principales
        totalDeliveries: delivery.delivery.deliveryStats.totalDeliveries,
        completedDeliveries: delivery.delivery.deliveryStats.completedDeliveries,
        cancelledDeliveries: delivery.delivery.deliveryStats.cancelledDeliveries,
        successRate: parseFloat(successRate),
        
        // Ganancias
        totalEarnings: delivery.delivery.deliveryStats.totalEarnings,
        averageEarningsPerDelivery: parseFloat(averageEarningsPerDelivery),
        
        // Rating
        averageRating: delivery.delivery.deliveryStats.averageRating,
        
        // Estadísticas por periodo
        todayDeliveries,
        weekDeliveries,
        monthDeliveries,
        
        // Entregas activas
        activeDeliveries,
        
        // Estado del delivery
        isAvailable: delivery.delivery?.isAvailable || true,
        vehicleType: delivery.delivery?.vehicleType || 'motocicleta'
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas del delivery:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

module.exports = router;