const User = require('../models/User');
const Order = require('../models/Order');
const DeliveryTracking = require('../models/DeliveryTracking');
const NotificationService = require('./pushNotificationService');

class DeliveryAssignmentService {
  
  /**
   * Busca y asigna automáticamente un delivery a un pedido listo
   * @param {String} orderId - ID del pedido
   * @returns {Object} - Resultado de la asignación
   */
  static async assignDeliveryToOrder(orderId) {
    try {
      console.log(`🚚 Iniciando asignación de delivery para pedido: ${orderId}`);

      // 1. Verificar que el pedido existe y está listo
      const order = await Order.findById(orderId)
        .populate('merchantId', 'business.address business.location')
        .populate('customerId', 'name phone');

      if (!order) {
        throw new Error('Pedido no encontrado');
      }

      if (order.status !== 'ready') {
        throw new Error('El pedido debe estar en estado "ready" para asignar delivery');
      }

      // Verificar si ya tiene delivery asignado
      const existingTracking = await DeliveryTracking.findOne({ orderId });
      if (existingTracking) {
        return {
          success: false,
          message: 'El pedido ya tiene un delivery asignado',
          tracking: existingTracking
        };
      }

      // 2. Buscar delivery disponible
      const availableDelivery = await this.findAvailableDelivery(order);

      if (!availableDelivery) {
        console.log('❌ No hay delivery disponible, agregando a cola de espera');
        return await this.addToWaitingQueue(orderId);
      }

      // 3. Crear registro de tracking
      const tracking = await this.createDeliveryTracking(order, availableDelivery);

      // 4. Actualizar estado del pedido
      order.status = 'assigned_delivery';
      order.assignedDelivery = availableDelivery._id;
      await order.save();

      // 5. Marcar delivery como ocupado
      availableDelivery.delivery.isAvailable = false;
      await availableDelivery.save();

      // 6. Enviar notificaciones
      await this.sendAssignmentNotifications(order, availableDelivery, tracking);

      console.log(`✅ Delivery ${availableDelivery.name} asignado al pedido ${order.orderNumber}`);

      return {
        success: true,
        message: 'Delivery asignado exitosamente',
        deliveryId: availableDelivery._id,
        trackingId: tracking._id,
        estimatedPickupTime: tracking.estimatedPickupTime,
        estimatedDeliveryTime: tracking.estimatedDeliveryTime
      };

    } catch (error) {
      console.error('❌ Error asignando delivery:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  /**
   * Busca el delivery más cercano y disponible
   * @param {Object} order - Pedido que necesita delivery
   * @returns {Object|null} - Delivery disponible o null
   */
  static async findAvailableDelivery(order) {
    try {
      const merchantLocation = order.merchantId.business?.location?.coordinates || 
                              [-69.9312, 18.4861]; // Default Santo Domingo

      // Buscar deliveries disponibles en un radio de 15km
      const availableDeliveries = await User.find({
        role: 'delivery',
        deliveryStatus: 'aprobado',
        'delivery.isAvailable': true,
        'delivery.workZone.center': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: merchantLocation
            },
            $maxDistance: 15000 // 15 km en metros
          }
        }
      })
      .select('name phone delivery rating')
      .limit(10);

      if (availableDeliveries.length === 0) {
        return null;
      }

      // Ordenar por proximidad y rating
      const deliveriesWithDistance = await Promise.all(
        availableDeliveries.map(async (delivery) => {
          const distance = this.calculateDistance(
            merchantLocation,
            delivery.delivery.workZone.center
          );
          
          // Verificar si no tiene pedidos activos
          const activeDeliveries = await DeliveryTracking.countDocuments({
            deliveryPersonId: delivery._id,
            status: { $in: ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery'] }
          });

          return {
            ...delivery.toObject(),
            distance,
            activeDeliveries,
            score: this.calculateDeliveryScore(delivery, distance, activeDeliveries)
          };
        })
      );

      // Filtrar solo deliveries sin pedidos activos
      const freeDeliveries = deliveriesWithDistance.filter(d => d.activeDeliveries === 0);
      
      if (freeDeliveries.length === 0) {
        return null;
      }

      // Ordenar por score (mejor delivery primero)
      freeDeliveries.sort((a, b) => b.score - a.score);

      return User.findById(freeDeliveries[0]._id);

    } catch (error) {
      console.error('Error buscando delivery disponible:', error);
      return null;
    }
  }

  /**
   * Calcula un score para seleccionar el mejor delivery
   * @param {Object} delivery - Delivery candidato
   * @param {Number} distance - Distancia en km
   * @param {Number} activeDeliveries - Número de deliveries activos
   * @returns {Number} - Score del delivery
   */
  static calculateDeliveryScore(delivery, distance, activeDeliveries) {
    const maxDistance = 15; // km
    const distanceScore = (maxDistance - distance) / maxDistance * 40; // 40% peso distancia
    const ratingScore = (delivery.rating || 0) * 12; // 60% peso rating (5 * 12 = 60)
    const availabilityPenalty = activeDeliveries * 10; // Penalización por deliveries activos
    
    return Math.max(0, distanceScore + ratingScore - availabilityPenalty);
  }

  /**
   * Crea el registro de tracking para un delivery asignado
   * @param {Object} order - Pedido
   * @param {Object} delivery - Delivery asignado
   * @returns {Object} - Registro de tracking creado
   */
  static async createDeliveryTracking(order, delivery) {
    // Validar datos necesarios
    if (!order._id || !delivery._id) {
      throw new Error('Order ID o Delivery ID es null');
    }
    
    if (!order.customerId) {
      throw new Error('Customer ID es null - el pedido debe estar populado con customerId');
    }
    
    if (!order.merchantId) {
      throw new Error('Merchant ID es null - el pedido debe estar populado con merchantId');
    }
    
    if (!delivery.delivery || !delivery.delivery.currentLocation || !delivery.delivery.currentLocation.coordinates) {
      console.log('⚠️ Delivery sin ubicación actual, usando ubicación por defecto');
      // Usar ubicación del centro de trabajo como fallback
      if (!delivery.delivery.currentLocation) {
        delivery.delivery.currentLocation = { coordinates: delivery.delivery.workZone.center };
      } else if (!delivery.delivery.currentLocation.coordinates) {
        delivery.delivery.currentLocation.coordinates = delivery.delivery.workZone.center;
      }
    }

    const merchantCoords = order.merchantId.business?.location?.coordinates || [0, 0];
    const deliveryCoords = order.deliveryInfo?.coordinates || order.deliveryAddress?.coordinates || [0, 0];
    
    console.log(`📍 Merchant coordinates: ${JSON.stringify(merchantCoords)}`);
    console.log(`🏠 Delivery coordinates: ${JSON.stringify(deliveryCoords)}`);
    
    // Validar coordenadas - no crear tracking si faltan coordenadas críticas
    if ((merchantCoords[0] === 0 && merchantCoords[1] === 0) || 
        (deliveryCoords[0] === 0 && deliveryCoords[1] === 0)) {
      console.warn('⚠️ Warning: Using default coordinates [0,0] - ubicaciones pueden ser incorrectas');
    }

    // Calcular tiempos estimados
    const distanceToMerchant = this.calculateDistance(
      delivery.delivery.currentLocation.coordinates, 
      merchantCoords
    );
    const distanceToCustomer = this.calculateDistance(merchantCoords, deliveryCoords);

    const estimatedPickupTime = new Date(Date.now() + (distanceToMerchant / 25) * 60 * 60 * 1000); // 25 km/h promedio
    const estimatedDeliveryTime = new Date(estimatedPickupTime.getTime() + (distanceToCustomer / 25) * 60 * 60 * 1000);

    const tracking = new DeliveryTracking({
      orderId: order._id,
      deliveryPersonId: delivery._id,
      customerId: order.customerId._id || order.customerId,
      merchantId: order.merchantId._id || order.merchantId,
      status: 'assigned',
      
      currentLocation: {
        type: 'Point',
        coordinates: delivery.delivery.currentLocation.coordinates
      },
      
      pickupLocation: {
        coordinates: merchantCoords,
        address: order.merchantId.business?.address || 'Dirección del comerciante'
      },
      
      deliveryLocation: {
        coordinates: deliveryCoords,
        address: order.deliveryInfo?.address?.street || order.deliveryAddress?.address || order.customerAddress || 'Dirección de entrega'
      },

      estimatedPickupTime,
      estimatedDeliveryTime,
      deliveryNotes: order.deliveryInfo?.instructions || order.deliveryInstructions || '',
      
      isLive: true,
      
      statusHistory: [{
        status: 'assigned',
        timestamp: new Date(),
        location: delivery.delivery.currentLocation.coordinates,
        notes: `Delivery ${delivery.name} asignado al pedido`
      }]
    });

    return await tracking.save();
  }

  /**
   * Envía notificaciones de asignación a todos los involucrados
   * @param {Object} order - Pedido
   * @param {Object} delivery - Delivery asignado
   * @param {Object} tracking - Registro de tracking
   */
  static async sendAssignmentNotifications(order, delivery, tracking) {
    try {
      // Notificar al delivery
      await NotificationService.sendToUser(delivery._id, {
        title: '🚚 Nuevo pedido asignado',
        body: `Pedido #${order.orderNumber} - ${order.merchantId.business?.businessName}`,
        data: {
          type: 'delivery_assigned',
          orderId: order._id.toString(),
          trackingId: tracking._id.toString(),
          action: 'open_delivery_details'
        }
      });

      // Notificar al cliente
      await NotificationService.sendToUser(order.customerId._id, {
        title: '🛵 Delivery asignado',
        body: `${delivery.name} se dirigirá a recoger tu pedido`,
        data: {
          type: 'delivery_assigned',
          orderId: order._id.toString(),
          deliveryName: delivery.name,
          estimatedTime: tracking.estimatedDeliveryTime.toISOString(),
          action: 'open_order_tracking'
        }
      });

      // Notificar al comerciante
      await NotificationService.sendToUser(order.merchantId._id, {
        title: '📦 Delivery en camino',
        body: `${delivery.name} va a recoger el pedido #${order.orderNumber}`,
        data: {
          type: 'delivery_assigned',
          orderId: order._id.toString(),
          deliveryName: delivery.name,
          estimatedPickupTime: tracking.estimatedPickupTime.toISOString()
        }
      });

    } catch (error) {
      console.error('Error enviando notificaciones de asignación:', error);
      // No fallar la asignación por errores de notificación
    }
  }

  /**
   * Agrega un pedido a la cola de espera cuando no hay delivery disponible
   * @param {String} orderId - ID del pedido
   * @returns {Object} - Resultado
   */
  static async addToWaitingQueue(orderId) {
    // Por ahora, simplemente intentar asignar cada 5 minutos
    setTimeout(async () => {
      console.log(`🔄 Reintentando asignación para pedido: ${orderId}`);
      await this.assignDeliveryToOrder(orderId);
    }, 5 * 60 * 1000); // 5 minutos

    return {
      success: false,
      message: 'No hay delivery disponible en este momento. Reintentaremos automáticamente.',
      inQueue: true,
      retryIn: '5 minutos'
    };
  }

  /**
   * Busca deliveries disponibles en un área específica
   * @param {Array} coordinates - Coordenadas [lon, lat]
   * @param {Number} radius - Radio en km (default: 10)
   * @returns {Array} - Lista de deliveries disponibles
   */
  static async getAvailableDeliveriesInArea(coordinates, radius = 10) {
    return await User.find({
      role: 'delivery',
      deliveryStatus: 'aprobado',
      'delivery.isAvailable': true,
      'delivery.currentLocation': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          $maxDistance: radius * 1000 // convertir km a metros
        }
      }
    })
    .select('name phone delivery rating')
    .populate('delivery');
  }

  /**
   * Libera un delivery cuando completa o cancela un pedido
   * @param {String} deliveryId - ID del delivery
   * @returns {Boolean} - Éxito de la operación
   */
  static async releaseDelivery(deliveryId) {
    try {
      const delivery = await User.findById(deliveryId);
      if (!delivery || delivery.role !== 'delivery') {
        return false;
      }

      delivery.delivery.isAvailable = true;
      await delivery.save();

      console.log(`✅ Delivery ${delivery.name} liberado y disponible`);
      
      // Intentar asignar pedidos en cola de espera
      await this.processWaitingQueue();
      
      return true;
    } catch (error) {
      console.error('Error liberando delivery:', error);
      return false;
    }
  }

  /**
   * Procesa la cola de espera de pedidos sin delivery
   */
  static async processWaitingQueue() {
    try {
      // Buscar pedidos listos sin delivery asignado
      const pendingOrders = await Order.find({
        status: 'ready',
        assignedDelivery: { $exists: false }
      })
      .sort({ createdAt: 1 }) // Más antiguos primero
      .limit(5);

      for (const order of pendingOrders) {
        const result = await this.assignDeliveryToOrder(order._id);
        if (result.success) {
          console.log(`✅ Pedido ${order.orderNumber} asignado desde cola de espera`);
        }
      }
    } catch (error) {
      console.error('Error procesando cola de espera:', error);
    }
  }

  /**
   * Obtiene estadísticas de asignación
   * @param {Date} startDate - Fecha inicio
   * @param {Date} endDate - Fecha fin
   * @returns {Object} - Estadísticas
   */
  static async getAssignmentStats(startDate, endDate) {
    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = startDate;
      if (endDate) matchQuery.createdAt.$lte = endDate;
    }

    const stats = await Order.aggregate([
      { $match: { ...matchQuery, status: { $in: ['ready', 'assigned_delivery', 'picked_up', 'delivered'] } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          ordersWithDelivery: { $sum: { $cond: [{ $ne: ['$assignedDelivery', null] }, 1, 0] } },
          averageAssignmentTime: { $avg: '$assignmentTime' }
        }
      }
    ]);

    return stats[0] || {
      totalOrders: 0,
      ordersWithDelivery: 0,
      averageAssignmentTime: 0,
      assignmentRate: 0
    };
  }

  /**
   * Calcula distancia entre dos puntos usando fórmula de Haversine
   * @param {Array} coords1 - [lon, lat]
   * @param {Array} coords2 - [lon, lat]
   * @returns {Number} - Distancia en km
   */
  static calculateDistance(coords1, coords2) {
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;
    
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}

module.exports = DeliveryAssignmentService;