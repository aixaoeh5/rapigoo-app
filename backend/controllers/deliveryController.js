const User = require('../models/User');
const Order = require('../models/Order');
const DeliveryTracking = require('../models/DeliveryTracking');
const DeliveryAssignmentService = require('../services/DeliveryAssignmentService');
const NotificationService = require('../services/pushNotificationService');

// Obtener pedidos disponibles para delivery
const getAvailableOrders = async (req, res) => {
  try {
    const deliveryId = req.userId;
    
    // Verificar que es un delivery aprobado
    const delivery = await User.findById(deliveryId);
    if (!delivery || delivery.role !== 'delivery' || delivery.deliveryStatus !== 'aprobado') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para ver pedidos de delivery'
      });
    }

    const deliveryLocation = delivery.delivery.workZone.center;
    const workRadius = delivery.delivery.workZone.radius;

    // Buscar pedidos listos sin delivery asignado
    const availableOrders = await Order.find({
      status: 'ready',
      assignedDelivery: { $exists: false }
    })
    .populate('merchantId', 'business.businessName business.address business.phone business.location')
    .populate('customerId', 'name phone')
    .select('orderNumber total deliveryAddress customerAddress deliveryInstructions createdAt estimatedDeliveryTime')
    .sort({ createdAt: 1 })
    .limit(50); // Buscar más pedidos para filtrar por distancia

    // Calcular distancia y filtrar por zona de trabajo del delivery
    const ordersWithDistance = availableOrders
      .map(order => {
        const merchantCoords = order.merchantId.business?.location?.coordinates || [0, 0];
        const distance = DeliveryAssignmentService.calculateDistance(deliveryLocation, merchantCoords);
        
        return {
          ...order.toObject(),
          distanceToPickup: parseFloat(distance.toFixed(2)),
          estimatedPickupTime: new Date(Date.now() + (distance / 25) * 60 * 60 * 1000), // 25 km/h promedio
          estimatedEarning: Math.round(order.total * 0.1) // 10% comisión estimada
        };
      })
      .filter(order => order.distanceToPickup <= workRadius) // Filtrar por radio de trabajo
      .sort((a, b) => a.distanceToPickup - b.distanceToPickup) // Ordenar por proximidad
      .slice(0, 20); // Limitar a 20 pedidos más cercanos

    res.json({
      success: true,
      orders: ordersWithDistance,
      deliveryLocation: {
        coordinates: deliveryLocation,
        workRadius: workRadius
      }
    });

  } catch (error) {
    console.error('Error obteniendo pedidos disponibles:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Aceptar un pedido
const acceptOrder = async (req, res) => {
  try {
    const deliveryId = req.userId;
    const { orderId } = req.params;

    // Verificar que el delivery está disponible
    const delivery = await User.findById(deliveryId);
    if (!delivery || delivery.role !== 'delivery' || !delivery.delivery.isAvailable) {
      return res.status(400).json({
        success: false,
        error: 'Delivery no disponible'
      });
    }

    // Verificar que el pedido sigue disponible (primer llegado, primer servido)
    const order = await Order.findById(orderId)
      .populate('customerId', 'name phone')
      .populate('merchantId', 'business.businessName business.address business.location business.phone');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    if (order.status !== 'ready') {
      return res.status(400).json({
        success: false,
        error: 'Este pedido ya no está disponible'
      });
    }

    if (order.assignedDelivery) {
      return res.status(400).json({
        success: false,
        error: 'Otro delivery ya tomó este pedido'
      });
    }

    // Crear tracking y asignar
    const tracking = await DeliveryAssignmentService.createDeliveryTracking(order, delivery);
    
    // Actualizar estado del pedido
    order.status = 'assigned_delivery';
    order.assignedDelivery = deliveryId;
    await order.save();

    // Marcar delivery como ocupado
    delivery.delivery.isAvailable = false;
    await delivery.save();

    // Enviar notificaciones
    await DeliveryAssignmentService.sendAssignmentNotifications(order, delivery, tracking);

    res.json({
      success: true,
      message: 'Pedido aceptado exitosamente',
      tracking: tracking,
      order: {
        orderNumber: order.orderNumber,
        merchantName: order.merchantId?.business?.businessName,
        total: order.total,
        estimatedPickupTime: tracking.estimatedPickupTime,
        estimatedDeliveryTime: tracking.estimatedDeliveryTime
      }
    });

  } catch (error) {
    console.error('❌ Error aceptando pedido:', error);
    console.error('❌ Detalles del error:', {
      orderId,
      deliveryId,
      orderExists: !!order,
      orderCustomerId: order?.customerId,
      orderMerchantId: order?.merchantId,
      deliveryExists: !!delivery,
      deliveryCurrentLocation: delivery?.delivery?.currentLocation,
      errorMessage: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
};

// Rechazar un pedido
const rejectOrder = async (req, res) => {
  try {
    const deliveryId = req.userId;
    const { orderId } = req.params;
    const { reason } = req.body;

    console.log(`🚫 Delivery ${deliveryId} rechazó pedido ${orderId}. Razón: ${reason}`);

    // El pedido sigue disponible para otros deliveries
    // Opcionalmente, se puede penalizar al delivery o registrar el rechazo

    res.json({
      success: true,
      message: 'Pedido rechazado'
    });

  } catch (error) {
    console.error('Error rechazando pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener deliveries activos del delivery
const getActiveDeliveries = async (req, res) => {
  try {
    const deliveryId = req.userId;

    const activeDeliveries = await DeliveryTracking.find({
      deliveryPersonId: deliveryId,
      status: { $in: ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'] }
    })
    .populate('orderId', 'orderNumber total deliveryInstructions')
    .populate('customerId', 'name phone')
    .populate('merchantId', 'business.businessName business.phone business.address')
    .sort({ createdAt: -1 });

    const deliveriesWithETA = activeDeliveries.map(delivery => ({
      ...delivery.toObject(),
      currentETA: delivery.currentETA,
      distanceToDestination: delivery.status.includes('pickup') ? 
        delivery.distanceToPickup : delivery.distanceToDelivery,
      isRunningLate: delivery.isRunningLate
    }));

    res.json({
      success: true,
      deliveries: deliveriesWithETA
    });

  } catch (error) {
    console.error('Error obteniendo deliveries activos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Actualizar ubicación del delivery
const updateLocation = async (req, res) => {
  try {
    const deliveryId = req.userId;
    const { latitude, longitude, accuracy, speed, heading } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitud y longitud son requeridas'
      });
    }

    // Actualizar ubicación en perfil del delivery
    await User.findByIdAndUpdate(deliveryId, {
      'delivery.currentLocation.coordinates': [longitude, latitude]
    });

    // Actualizar en todos los trackings activos
    const activeTrackings = await DeliveryTracking.find({
      deliveryPersonId: deliveryId,
      status: { $in: ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'] }
    });

    for (const tracking of activeTrackings) {
      const statusChanged = tracking.updateLocation({
        latitude,
        longitude,
        accuracy,
        speed,
        heading
      });
      await tracking.save();
      
      if (statusChanged) {
        console.log(`📍 Cambio automático de estado para tracking ${tracking._id}:`, tracking.status);
      }
    }

    res.json({
      success: true,
      message: 'Ubicación actualizada',
      updatedTrackings: activeTrackings.length
    });

  } catch (error) {
    console.error('Error actualizando ubicación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Actualizar estado de delivery
const updateDeliveryStatus = async (req, res) => {
  try {
    const deliveryId = req.userId;
    const { trackingId } = req.params;
    const { status, notes, latitude, longitude } = req.body;

    const tracking = await DeliveryTracking.findOne({
      _id: trackingId,
      deliveryPersonId: deliveryId
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        error: 'Tracking no encontrado'
      });
    }

    const location = latitude && longitude ? { latitude, longitude } : null;
    await tracking.updateStatus(status, notes, location);

    // Actualizar estado del pedido si corresponde
    const order = await Order.findById(tracking.orderId);
    if (order) {
      switch (status) {
        case 'picked_up':
          order.status = 'picked_up';
          break;
        case 'delivered':
          order.status = 'delivered';
          // Liberar delivery
          await DeliveryAssignmentService.releaseDelivery(deliveryId);
          break;
      }
      await order.save();
    }

    // Enviar notificaciones según el estado
    await sendStatusNotifications(tracking, status);

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      tracking: {
        status: tracking.status,
        currentETA: tracking.currentETA,
        isRunningLate: tracking.isRunningLate
      }
    });

  } catch (error) {
    console.error('Error actualizando estado de delivery:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
};

// Completar entrega con detalles
const completeDelivery = async (req, res) => {
  try {
    const deliveryId = req.userId;
    const { trackingId } = req.params;
    const { notes, photo, signature } = req.body;

    const tracking = await DeliveryTracking.findOne({
      _id: trackingId,
      deliveryPersonId: deliveryId
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        error: 'Tracking no encontrado'
      });
    }

    await tracking.completeDelivery({ notes, photo, signature });

    // Actualizar pedido a entregado
    const order = await Order.findById(tracking.orderId);
    if (order) {
      order.status = 'delivered';
      order.deliveredAt = new Date();
      await order.save();
    }

    // Liberar delivery
    await DeliveryAssignmentService.releaseDelivery(deliveryId);

    // Actualizar estadísticas del delivery
    const delivery = await User.findById(deliveryId);
    if (delivery) {
      delivery.delivery.deliveryStats.completedDeliveries += 1;
      delivery.delivery.deliveryStats.totalDeliveries += 1;
      await delivery.save();
    }

    // Enviar notificación de entrega completada
    await NotificationService.sendToUser(order.customerId, {
      title: '✅ Pedido entregado',
      body: `Tu pedido #${order.orderNumber} ha sido entregado exitosamente`,
      data: {
        type: 'order_delivered',
        orderId: order._id.toString(),
        action: 'rate_delivery'
      }
    });

    res.json({
      success: true,
      message: 'Entrega completada exitosamente',
      deliveryTime: tracking.actualDeliveryTime,
      totalTime: tracking.actualTotalTime
    });

  } catch (error) {
    console.error('Error completando entrega:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas del delivery
const getDeliveryStats = async (req, res) => {
  try {
    const deliveryId = req.userId;
    const { period = '30' } = req.query; // días

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const stats = await DeliveryTracking.getDeliveryStats(deliveryId, { startDate });
    
    res.json({
      success: true,
      stats: stats[0] || {
        totalDeliveries: 0,
        completedDeliveries: 0,
        cancelledDeliveries: 0,
        completionRate: 0,
        onTimeRate: 0,
        totalDistance: 0,
        averageTime: 0
      },
      period: `${period} días`
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Cambiar disponibilidad
const toggleAvailability = async (req, res) => {
  try {
    const deliveryId = req.userId;
    const { isAvailable } = req.body;

    const delivery = await User.findById(deliveryId);
    if (!delivery || delivery.role !== 'delivery') {
      return res.status(404).json({
        success: false,
        error: 'Delivery no encontrado'
      });
    }

    delivery.delivery.isAvailable = Boolean(isAvailable);
    await delivery.save();

    res.json({
      success: true,
      message: `Estado cambiado a ${delivery.delivery.isAvailable ? 'disponible' : 'no disponible'}`,
      isAvailable: delivery.delivery.isAvailable
    });

  } catch (error) {
    console.error('Error cambiando disponibilidad:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Función auxiliar para enviar notificaciones de estado
const sendStatusNotifications = async (tracking, status) => {
  try {
    const statusMessages = {
      'heading_to_pickup': {
        customer: '🛵 Tu delivery se dirige a recoger el pedido',
        merchant: '🛵 El delivery se dirige hacia tu local'
      },
      'at_pickup': {
        customer: '📍 Tu delivery llegó al restaurante',
        merchant: '📍 El delivery llegó a tu local'
      },
      'picked_up': {
        customer: '🎒 Tu pedido fue recogido y va en camino',
        merchant: '✅ Pedido recogido por el delivery'
      },
      'at_delivery': {
        customer: '🏠 Tu delivery llegó a tu ubicación',
      },
      'delivered': {
        customer: '✅ ¡Tu pedido fue entregado exitosamente!',
        merchant: '✅ Pedido entregado al cliente'
      }
    };

    const messages = statusMessages[status];
    if (!messages) return;

    const order = await Order.findById(tracking.orderId);
    if (!order) return;

    // Notificar al cliente
    if (messages.customer) {
      await NotificationService.sendToUser(order.customerId, {
        title: 'Actualización de tu pedido',
        body: messages.customer,
        data: {
          type: 'delivery_update',
          orderId: order._id.toString(),
          status: status,
          trackingId: tracking._id.toString()
        }
      });
    }

    // Notificar al comerciante
    if (messages.merchant) {
      await NotificationService.sendToUser(order.merchantId, {
        title: `Pedido #${order.orderNumber}`,
        body: messages.merchant,
        data: {
          type: 'delivery_update',
          orderId: order._id.toString(),
          status: status
        }
      });
    }

  } catch (error) {
    console.error('Error enviando notificaciones de estado:', error);
  }
};

module.exports = {
  getAvailableOrders,
  acceptOrder,
  rejectOrder,
  getActiveDeliveries,
  updateLocation,
  updateDeliveryStatus,
  completeDelivery,
  getDeliveryStats,
  toggleAvailability
};