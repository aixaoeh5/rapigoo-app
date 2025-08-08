const Order = require('../models/Order');
const Cart = require('../models/Cart');
const User = require('../models/User');
const Service = require('../models/Service');
const nodemailer = require('nodemailer');
// Comentar emails por ahora para evitar errores
// const { 
//   getOrderConfirmationTemplate, 
//   getMerchantOrderTemplate, 
//   getStatusUpdateTemplate 
// } = require('../utils/emailTemplates');

// Configuración del transporter para emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verificar configuración del transporter
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Error en configuración de email:', error);
  } else {
    console.log('✅ Servidor de email configurado correctamente');
  }
});

// Crear pedido desde carrito
exports.createOrder = async (req, res) => {
  try {
    const { deliveryInfo, paymentMethod, customerInfo } = req.body;
    const userId = req.user.id;

    // Obtener carrito del usuario
    const cart = await Cart.findOne({ userId })
      .populate('items.serviceId', 'name price available preparationTime')
      .populate('items.merchantId', 'name business');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Carrito vacío' 
      });
    }

    // Verificar que todos los items estén disponibles
    const unavailableItems = cart.items.filter(item => 
      !item.serviceId || !item.serviceId.available
    );

    if (unavailableItems.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Algunos items ya no están disponibles',
        unavailableItems: unavailableItems.map(item => item.serviceName)
      });
    }

    // Obtener información del usuario
    const user = await User.findById(userId);
    const merchant = cart.items[0].merchantId; // Todos los items son del mismo comerciante

    // Calcular tiempo de preparación estimado
    const maxPreparationTime = Math.max(
      ...cart.items.map(item => item.serviceId.preparationTime || 30)
    );

    // Preparar items del pedido
    const orderItems = cart.items.map(item => ({
      serviceId: item.serviceId._id,
      serviceName: item.serviceName,
      serviceDescription: item.serviceDescription,
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity
    }));

    // Función auxiliar para generar número de orden
    const generateOrderNumber = () => {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const time = Date.now().toString().slice(-6);
      return `RP${year}${month}${day}${time}`;
    };

    // Crear pedido con modelo simplificado para MVP
    const order = new Order({
      orderNumber: generateOrderNumber(),
      customerId: userId,
      merchantId: merchant._id,
      items: orderItems.map(item => ({
        serviceId: item.serviceId,
        name: item.serviceName,
        description: item.serviceDescription,
        price: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.totalPrice
      })),
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      total: cart.total,
      status: 'pending',
      deliveryInfo: {
        address: {
          street: deliveryInfo.address,
          city: 'Santo Domingo',
          state: 'DN',
          zipCode: '10001',
          coordinates: [-69.9, 18.5] // Coordenadas por defecto para DR
        },
        instructions: deliveryInfo.instructions,
        contactPhone: customerInfo.phone
      },
      paymentInfo: {
        method: paymentMethod,
        amount: cart.total,
        status: paymentMethod === 'card' ? 'completed' : 'pending'
      }
    });

    // Calcular tiempo estimado de entrega
    order.calculateDeliveryTime();

    await order.save();

    // Limpiar carrito después de crear el pedido
    await cart.clear();

    // Enviar emails de confirmación (deshabilitado por ahora)
    // sendOrderConfirmationEmails(order, user, merchant);

    res.json({
      success: true,
      message: 'Pedido creado exitosamente',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        estimatedDeliveryTime: order.estimatedDeliveryTime
      }
    });

  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Obtener pedidos del usuario
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { customerId: userId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('merchantId', 'name business');

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos'
    });
  }
};

// Obtener detalle de un pedido
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: orderId, customerId: userId })
      .populate('merchantId', 'name business');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener el pedido'
    });
  }
};

// Obtener pedidos del comerciante
exports.getMerchantOrders = async (req, res) => {
  try {
    const merchantId = req.user.merchantId || req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { merchantId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email');

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener pedidos del comerciante:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos'
    });
  }
};

// Actualizar estado del pedido (comerciante)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, note } = req.body;
    const merchantId = req.user.merchantId || req.user.id;

    const order = await Order.findOne({ _id: orderId, merchantId })
      .populate('userId', 'name email')
      .populate('merchantId', 'businessName');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    try {
      await order.updateStatus(status, note);
      
      // Enviar notificación por email al cliente (deshabilitado)
      // sendStatusUpdateEmail(order);

      res.json({
        success: true,
        message: 'Estado del pedido actualizado',
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          statusHistory: order.statusHistory
        }
      });

    } catch (statusError) {
      return res.status(400).json({
        success: false,
        error: statusError.message
      });
    }

  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar estado del pedido'
    });
  }
};

// Funciones auxiliares para emails
const sendOrderConfirmationEmails = async (order, user, merchant) => {
  try {
    // Email al cliente con template profesional
    const customerEmailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `🎉 Confirmación de pedido #${order.orderNumber} - Rapigoo`,
      html: getOrderConfirmationTemplate(order, user, merchant)
    };

    // Email al comerciante con template profesional
    const merchantEmailOptions = {
      from: process.env.EMAIL_USER,
      to: merchant.email,
      subject: `🔔 Nuevo pedido #${order.orderNumber} - Rapigoo Business`,
      html: getMerchantOrderTemplate(order, user, merchant)
    };

    await transporter.sendMail(customerEmailOptions);
    await transporter.sendMail(merchantEmailOptions);

    console.log(`✅ Emails de confirmación enviados para pedido #${order.orderNumber}`);

  } catch (error) {
    console.error('❌ Error al enviar emails de confirmación:', error);
  }
};

const sendStatusUpdateEmail = async (order) => {
  try {
    const statusTitles = {
      confirmed: '✅ Pedido confirmado',
      preparing: '👨‍🍳 Pedido en preparación',
      ready: '📦 Pedido listo',
      completed: '🎉 Pedido entregado',
      cancelled: '❌ Pedido cancelado'
    };

    const emailOptions = {
      from: process.env.EMAIL_USER,
      to: order.userId.email,
      subject: `${statusTitles[order.status]} #${order.orderNumber} - Rapigoo`,
      html: getStatusUpdateTemplate(order, order.status)
    };

    await transporter.sendMail(emailOptions);
    console.log(`✅ Email de actualización enviado para pedido #${order.orderNumber} - Estado: ${order.status}`);

  } catch (error) {
    console.error('❌ Error al enviar email de actualización:', error);
  }
};

// FUNCIONES PARA ADMINISTRADORES

// Obtener todos los pedidos (admin)
exports.getAdminOrders = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;

    // Construir query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Búsqueda por número de pedido, nombre de cliente o comerciante
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customerInfo.name': { $regex: search, $options: 'i' } },
        { merchantName: { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email')
      .populate('merchantId', 'businessName');

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error al obtener pedidos (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener pedidos'
    });
  }
};

// Obtener estadísticas de pedidos (admin)
exports.getAdminStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Estadísticas generales
    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      todayOrders,
      todayRevenue,
      totalRevenue
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'completed' }),
      Order.countDocuments({ status: 'cancelled' }),
      Order.countDocuments({ 
        createdAt: { 
          $gte: today, 
          $lt: tomorrow 
        } 
      }),
      Order.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' }
          }
        }
      ]),
      Order.aggregate([
        {
          $match: {
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' }
          }
        }
      ])
    ]);

    // Estadísticas por estado (últimos 7 días)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const ordersByStatus = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: weekAgo }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$total' }
        }
      }
    ]);

    // Pedidos por día (últimos 7 días)
    const ordersByDay = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: weekAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$total', 0] } }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    res.json({
      success: true,
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      todayOrders,
      todayRevenue: todayRevenue[0]?.total || 0,
      totalRevenue: totalRevenue[0]?.total || 0,
      ordersByStatus,
      ordersByDay,
      averageOrderValue: totalOrders > 0 ? (totalRevenue[0]?.total || 0) / completedOrders : 0,
      successRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0
    });

  } catch (error) {
    console.error('Error al obtener estadísticas (admin):', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
};