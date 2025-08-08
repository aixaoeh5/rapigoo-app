const express = require('express');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Service = require('../models/Service');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { cachePresets, invalidateCache } = require('../middleware/cache');
const { securityMonitoring, businessMetricsCollector } = require('../middleware/monitoring');
const Joi = require('joi');
const router = express.Router();

// Ruta de estadísticas admin SIN autenticación (para dashboard web)
router.get('/admin/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Contar todos los pedidos
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ 
      status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
    });
    const completedOrders = await Order.countDocuments({ status: 'delivered' });

    // Calcular ingresos
    const todayRevenue = await Order.aggregate([
      {
        $match: {
          status: 'delivered',
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' }
        }
      }
    ]);

    const totalRevenue = await Order.aggregate([
      {
        $match: {
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        completedOrders,
        todayRevenue: todayRevenue[0]?.total || 0,
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/orders/admin/all - Obtener todos los pedidos para admin (sin autenticación para dashboard web)
router.get('/admin/all', async (req, res) => {
  try {
    const { status, search, limit = 50, page = 1 } = req.query;
    
    // Construir query
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Buscar por número de pedido, nombre de cliente o comerciante
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customerInfo.name': { $regex: search, $options: 'i' } },
        { 'merchantInfo.name': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .populate('customerId', 'name email phone')
      .populate('merchantId', 'name email business')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Formatear datos para el frontend
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      customerInfo: {
        name: order.customerId?.name || 'N/A',
        phone: order.customerId?.phone || 'N/A'
      },
      merchantName: order.merchantId?.name || order.merchantId?.business?.businessName || 'N/A',
      deliveryInfo: {
        address: order.deliveryInfo?.address?.street || 'N/A',
        instructions: order.deliveryInfo?.instructions
      },
      paymentMethod: order.paymentInfo?.method || 'N/A',
      items: order.items?.map(item => ({
        quantity: item.quantity,
        serviceName: item.name,
        totalPrice: item.subtotal
      }))
    }));

    res.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: formattedOrders.length
      }
    });

  } catch (error) {
    console.error('Error fetching orders for admin:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// Aplicar autenticación a las demás rutas de pedidos
router.use(verifyToken);

// Esquemas de validación para pedidos
const createOrderSchema = Joi.object({
  merchantId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'ID de comerciante inválido',
    'any.required': 'El ID del comerciante es requerido'
  }),
  
  items: Joi.array().items(
    Joi.object({
      serviceId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
      quantity: Joi.number().integer().min(1).required(),
      specialInstructions: Joi.string().max(500).allow('').optional(),
      options: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          value: Joi.string().required(),
          price: Joi.number().min(0).default(0)
        })
      ).optional()
    })
  ).min(1).required(),
  
  deliveryInfo: Joi.object({
    address: Joi.object({
      street: Joi.string().min(5).max(200).required(),
      city: Joi.string().min(2).max(100).required(),
      state: Joi.string().min(2).max(100).required(),
      zipCode: Joi.string().min(3).max(20).required(),
      coordinates: Joi.array().items(Joi.number()).length(2).required()
    }).required(),
    instructions: Joi.string().max(500).allow('').optional(),
    contactPhone: Joi.string().pattern(/^[0-9+\-() ]+$/).min(10).max(20).required()
  }).required(),
  
  paymentInfo: Joi.object({
    method: Joi.string().valid('card', 'cash', 'digital_wallet').required(),
    transactionId: Joi.string().optional(),
    paymentIntentId: Joi.string().optional()
  }).required(),

  notes: Joi.string().max(1000).allow('').optional(),
  platform: Joi.string().valid('mobile', 'web').default('mobile')
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled').required(),
  notes: Joi.string().max(500).allow('').optional(),
  deliveryPersonId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
});

// POST /api/orders - Crear un nuevo pedido
router.post('/', businessMetricsCollector.orderCreated, async (req, res) => {
  try {
    const { error, value } = createOrderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Datos de pedido inválidos',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const {
      merchantId,
      items,
      deliveryInfo,
      paymentInfo,
      notes,
      platform = 'mobile'
    } = value;

    // Validar que el comerciante existe
    const merchant = await User.findById(merchantId);
    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Comerciante no encontrado',
          code: 'MERCHANT_NOT_FOUND'
        }
      });
    }

    // Validar items y calcular totales
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const service = await Service.findById(item.serviceId);
      if (!service || !service.available) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Servicio no disponible`,
            code: 'SERVICE_UNAVAILABLE'
          }
        });
      }

      // Validar que el servicio pertenece al comerciante
      if (service.merchantId.toString() !== merchantId) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Servicio no pertenece al comerciante seleccionado',
            code: 'INVALID_SERVICE_MERCHANT'
          }
        });
      }

      const itemSubtotal = service.price * item.quantity;
      const optionsTotal = item.options?.reduce((total, option) => total + (option.price || 0), 0) || 0;
      
      validatedItems.push({
        serviceId: service._id,
        name: service.name,
        description: service.description,
        price: service.price,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions || '',
        options: item.options || [],
        subtotal: itemSubtotal + (optionsTotal * item.quantity)
      });

      subtotal += itemSubtotal + (optionsTotal * item.quantity);
    }

    // Calcular fees y total
    const deliveryFee = merchant.business?.deliveryFee || 2.50;
    const serviceFee = subtotal * 0.05; // 5% service fee
    const tax = subtotal * 0.1; // 10% tax
    const total = subtotal + deliveryFee + serviceFee + tax;

    // Validar monto mínimo
    const minimumOrder = merchant.business?.minimumOrder || 10;
    if (subtotal < minimumOrder) {
      return res.status(400).json({
        success: false,
        error: {
          message: `El monto mínimo de pedido es $${minimumOrder}`,
          code: 'MINIMUM_ORDER_NOT_MET'
        }
      });
    }

    // Crear el pedido
    const order = new Order({
      customerId: req.user.id,
      merchantId,
      items: validatedItems,
      subtotal,
      deliveryFee,
      serviceFee,
      tax,
      total,
      deliveryInfo: {
        ...deliveryInfo,
        coordinates: [deliveryInfo.address.coordinates[0], deliveryInfo.address.coordinates[1]]
      },
      paymentInfo: {
        ...paymentInfo,
        amount: total
      },
      notes,
      platform,
      deviceInfo: req.get('User-Agent')
    });

    // Calcular tiempo estimado de entrega
    order.calculateDeliveryTime();

    await order.save();

    // Limpiar el carrito después de crear el pedido
    await Cart.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { items: [], lastUpdated: new Date() } }
    );

    // Populate para respuesta completa
    await order.populate([
      { path: 'customerId', select: 'name email phone' },
      { path: 'merchantId', select: 'name email phone business' },
      { path: 'items.serviceId', select: 'name images' }
    ]);

    // Guardar ID del pedido para métricas
    res.locals.orderId = order._id;

    res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente',
      data: {
        order
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/orders - Obtener pedidos del usuario
router.get('/', cachePresets.static, async (req, res) => {
  try {
    const { status, type = 'active', page = 1, limit = 20 } = req.query;
    const userType = (req.user.role === 'merchant' || req.user.role === 'comerciante') ? 'merchant' : 
                     req.user.role === 'delivery' ? 'delivery' : 'customer';

    let orders;
    const options = {
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    if (type === 'active') {
      orders = await Order.findActiveOrders(req.user.id, userType);
    } else if (type === 'history') {
      orders = await Order.findOrderHistory(req.user.id, userType, options);
    } else {
      // Búsqueda personalizada
      const field = userType === 'customer' ? 'customerId' : 
                    userType === 'merchant' ? 'merchantId' : 'deliveryPersonId';
      
      const query = { [field]: req.user.id };
      if (status) {
        query.status = status;
      }

      orders = await Order.find(query)
        .populate('customerId merchantId deliveryPersonId', 'name email phone')
        .populate('items.serviceId', 'name images')
        .sort({ createdAt: -1 })
        .limit(options.limit)
        .skip(options.skip);
    }

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: orders.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/orders/available-for-delivery - Pedidos disponibles para delivery
router.get('/available-for-delivery', verifyToken, async (req, res) => {
  try {
    console.log('🚚 Solicitando pedidos disponibles para delivery');
    console.log('🚚 Usuario:', req.user);

    // Solo delivery persons pueden ver estos pedidos
    if (req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los delivery persons pueden ver pedidos disponibles',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Buscar pedidos con status 'ready' que no tengan delivery asignado
    const availableOrders = await Order.find({
      status: 'ready',
      $or: [
        { deliveryPersonId: null },
        { deliveryPersonId: { $exists: false } }
      ]
    })
    .populate('customerId', 'name phone')
    .populate('merchantId', 'name business.businessName business.address business.phone')
    .sort({ createdAt: -1 })
    .limit(20);

    console.log(`🚚 Encontrados ${availableOrders.length} pedidos disponibles`);

    // Formatear los datos para que sean consistentes con el formato esperado
    const formattedOrders = availableOrders.map(order => {
      console.log('🚚 Procesando pedido:', order.orderNumber);
      
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        total: order.total || 0,
        items: order.items || [],
        status: order.status,
        customerInfo: {
          name: order.customerId?.name || 'Cliente desconocido',
          phone: order.customerId?.phone || 'N/A'
        },
        deliveryInfo: {
          address: order.deliveryInfo?.address || 'Dirección no disponible',
          coordinates: order.deliveryInfo?.coordinates || [],
          instructions: order.deliveryInfo?.instructions || ''
        },
        paymentMethod: order.paymentMethod || 'N/A',
        createdAt: order.createdAt,
        merchantId: order.merchantId
      };
    });

    res.json({
      success: true,
      orders: formattedOrders
    });

  } catch (error) {
    console.error('❌ Error obteniendo pedidos disponibles para delivery:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/orders/:id - Obtener un pedido específico
router.get('/:id', cachePresets.static, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('merchantId', 'name email phone business')
      .populate('deliveryPersonId', 'name email phone')
      .populate('items.serviceId', 'name images description');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Verificar que el usuario tiene acceso al pedido
    const hasAccess = order.customerId._id.toString() === req.user.id ||
                      order.merchantId._id.toString() === req.user.id ||
                      (order.deliveryPersonId && order.deliveryPersonId._id.toString() === req.user.id);

    if (!hasAccess) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized order access attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este pedido',
          code: 'ACCESS_DENIED'
        }
      });
    }

    res.json({
      success: true,
      data: {
        order
      }
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// PUT /api/orders/:id/status - Actualizar estado del pedido
router.put('/:id/status', verifyToken, /* invalidateCache(['api:orders:*']), */ async (req, res) => {
  try {
    console.log('🔄 PUT /orders/:id/status - Iniciando actualización de estado');
    console.log('📋 Parámetros recibidos:', {
      orderId: req.params.id,
      body: req.body,
      userId: req.user?.id,
      userRole: req.user?.role
    });
    
    const { error, value } = updateOrderStatusSchema.validate(req.body);
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

    const { status, notes, deliveryPersonId } = value;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Verificar permisos según el rol del usuario
    const canUpdate = ((req.user.role === 'merchant' || req.user.role === 'comerciante') && order.merchantId.toString() === req.user.id) ||
                      (req.user.role === 'delivery' && order.deliveryPersonId?.toString() === req.user.id) ||
                      (req.user.role === 'customer' && order.customerId.toString() === req.user.id && status === 'cancelled');

    if (!canUpdate) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized order status update attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes permisos para actualizar este pedido',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Validar transición de estado
    if (!order.canTransitionTo(status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `No se puede cambiar el estado de ${order.status} a ${status}`,
          code: 'INVALID_STATUS_TRANSITION'
        }
      });
    }

    // Validaciones específicas por rol
    if (req.user.role === 'customer' && status === 'cancelled' && !order.canBeCancelled) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'El pedido ya no puede ser cancelado',
          code: 'CANCELLATION_NOT_ALLOWED'
        }
      });
    }

    // Actualizar estado
    console.log('📝 Actualizando estado del pedido:', {
      orderId: order._id,
      currentStatus: order.status,
      newStatus: status,
      userId: req.user.id
    });
    
    try {
      await order.updateStatus(status, notes, req.user.id);
      console.log('✅ Estado actualizado correctamente');
    } catch (updateError) {
      console.error('❌ Error en updateStatus:', updateError);
      throw updateError;
    }

    // Si se está asignando un delivery, actualizar el campo
    if (status === 'assigned' && (req.user.role === 'merchant' || req.user.role === 'comerciante') && deliveryPersonId) {
      order.deliveryPersonId = deliveryPersonId;
      await order.save();
    }

    // Populate para respuesta
    await order.populate([
      { path: 'customerId', select: 'name email phone' },
      { path: 'merchantId', select: 'name email phone business' },
      { path: 'deliveryPersonId', select: 'name email phone' }
    ]);

    res.json({
      success: true,
      message: 'Estado del pedido actualizado exitosamente',
      data: {
        order
      }
    });

  } catch (error) {
    console.error('❌ Error completo updating order status:', error);
    console.error('❌ Stack trace:', error.stack);
    
    if (error.message && error.message.includes('Cannot transition')) {
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

// PUT /api/orders/:id/cancel - Cancelar pedido
router.put('/:id/cancel', invalidateCache(['api:orders:*']), async (req, res) => {
  try {
    const { reason } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Solo el cliente o el comerciante pueden cancelar
    const canCancel = order.customerId.toString() === req.user.id ||
                      ((req.user.role === 'merchant' || req.user.role === 'comerciante') && order.merchantId.toString() === req.user.id);

    if (!canCancel) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized order cancellation attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes permisos para cancelar este pedido',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Verificar si se puede cancelar
    if (!order.canTransitionTo('cancelled')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'El pedido no puede ser cancelado en su estado actual',
          code: 'CANCELLATION_NOT_ALLOWED'
        }
      });
    }

    // Para clientes, verificar tiempo límite
    if (req.user.role === 'customer' && !order.canBeCancelled) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'El tiempo límite para cancelar ha expirado',
          code: 'CANCELLATION_TIME_EXPIRED'
        }
      });
    }

    // Cancelar pedido
    order.cancellationReason = reason || 'Sin razón especificada';
    await order.updateStatus('cancelled', `Pedido cancelado: ${reason}`, req.user.id);

    res.json({
      success: true,
      message: 'Pedido cancelado exitosamente',
      data: {
        order
      }
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// POST /api/orders/:id/review - Agregar reseña al pedido
router.post('/:id/review', invalidateCache(['api:orders:*']), async (req, res) => {
  try {
    const { merchantRating, deliveryRating, comment } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Solo el cliente puede hacer reseñas
    if (order.customerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes permisos para reseñar este pedido',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Solo se puede reseñar pedidos entregados
    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Solo se pueden reseñar pedidos entregados',
          code: 'ORDER_NOT_DELIVERED'
        }
      });
    }

    // Verificar si ya existe una reseña
    if (order.customerReview && order.customerReview.reviewedAt) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Ya has reseñado este pedido',
          code: 'REVIEW_ALREADY_EXISTS'
        }
      });
    }

    // Validar ratings
    if (merchantRating && (merchantRating < 1 || merchantRating > 5)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'La calificación del comerciante debe estar entre 1 y 5',
          code: 'INVALID_RATING'
        }
      });
    }

    if (deliveryRating && (deliveryRating < 1 || deliveryRating > 5)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'La calificación del delivery debe estar entre 1 y 5',
          code: 'INVALID_RATING'
        }
      });
    }

    // Agregar reseña
    await order.addReview({
      merchant: merchantRating,
      delivery: deliveryRating
    }, comment);

    res.json({
      success: true,
      message: 'Reseña agregada exitosamente',
      data: {
        review: order.customerReview
      }
    });

  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});


// GET /api/orders/merchant/list - Obtener pedidos específicos para comerciantes
router.get('/merchant/list', verifyToken, async (req, res) => {
  try {
    // Solo comerciantes pueden acceder
    if (req.user.role !== 'merchant' && req.user.role !== 'comerciante') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los comerciantes pueden ver estos pedidos',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const { status, limit = 50, page = 1 } = req.query;
    
    // Construir query para pedidos del comerciante
    const query = { merchantId: req.user.id };
    if (status && status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('customerId', 'name email phone')
      .populate('items.serviceId', 'name price')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    res.json({
      success: true,
      orders: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: orders.length
      }
    });

  } catch (error) {
    console.error('Error fetching merchant orders:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/orders/stats/merchant - Estadísticas del comerciante
router.get('/stats/merchant', async (req, res) => {
  try {
    // Solo comerciantes pueden ver sus estadísticas
    if (req.user.role !== 'merchant' && req.user.role !== 'comerciante') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los comerciantes pueden ver estas estadísticas',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const { startDate, endDate } = req.query;
    const dateRange = {};
    
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const stats = await Order.getOrderStats(req.user.id, dateRange);

    res.json({
      success: true,
      data: {
        stats: stats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          fulfillmentRate: 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching merchant stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/orders/:id/tracking - Obtener tracking del pedido
router.get('/:id/tracking', cachePresets.static, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .select('orderNumber status tracking deliveryInfo.estimatedDeliveryTime deliveryInfo.actualDeliveryTime')
      .populate('tracking.updatedBy', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        currentStatus: order.status,
        estimatedDeliveryTime: order.deliveryInfo.estimatedDeliveryTime,
        actualDeliveryTime: order.deliveryInfo.actualDeliveryTime,
        tracking: order.tracking
      }
    });

  } catch (error) {
    console.error('Error fetching order tracking:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// POST /api/orders/test - Crear orden de prueba para testing de navegación GPS
router.post('/test', verifyToken, async (req, res) => {
  try {
    console.log('🧪 Creando orden de prueba para delivery:', req.user.id);
    
    // Buscar un comerciante existente
    const merchant = await User.findOne({ role: 'merchant' }).limit(1);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: { message: 'No hay comerciantes disponibles para crear orden de prueba' }
      });
    }

    // Crear orden de prueba
    const testOrder = new Order({
      orderNumber: `TEST-${Date.now()}`,
      customerId: req.user.id,
      merchantId: merchant._id,
      items: [{
        serviceId: new require('mongoose').Types.ObjectId(),
        name: 'Hamburguesa Especial',
        description: 'Hamburguesa con papas fritas',
        price: 25.00,
        quantity: 1,
        subtotal: 25.00
      }],
      subtotal: 25.00,
      deliveryFee: 5.00,
      total: 30.00,
      status: 'ready', // Lista para delivery
      paymentInfo: {
        method: 'cash',
        status: 'paid'
      },
      deliveryInfo: {
        address: {
          street: 'Calle de Prueba 123',
          city: 'Ciudad Test',
          state: 'Estado Test',
          zipCode: '12345'
        },
        coordinates: [-69.51, -18.51], // Coordenadas de prueba
        instructions: 'Orden de prueba para testing de navegación GPS'
      },
      customerInfo: {
        name: req.user.name || 'Cliente Test',
        phone: '+1234567890',
        email: req.user.email
      },
      platform: 'mobile',
      placedAt: new Date(),
      estimatedDeliveryTime: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
    });

    await testOrder.save();

    console.log('✅ Orden de prueba creada:', testOrder.orderNumber);

    res.json({
      success: true,
      message: 'Orden de prueba creada exitosamente',
      data: {
        order: {
          _id: testOrder._id,
          orderNumber: testOrder.orderNumber,
          status: testOrder.status,
          total: testOrder.total,
          merchantId: testOrder.merchantId,
          deliveryInfo: testOrder.deliveryInfo,
          customerInfo: testOrder.customerInfo
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creando orden de prueba:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Error interno del servidor' }
    });
  }
});

module.exports = router;