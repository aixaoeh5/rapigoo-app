const express = require('express');
const paymentService = require('../services/paymentService');
const Order = require('../models/Order');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { securityMonitoring, businessMetricsCollector } = require('../middleware/monitoring');
const { logger } = require('../utils/logger');
const Joi = require('joi');
const router = express.Router();

// Aplicar autenticación a todas las rutas de pago (excepto webhooks)
router.use('/webhook', express.raw({ type: 'application/json' })); // Webhook necesita raw body
router.use((req, res, next) => {
  if (req.path === '/webhook') {
    return next(); // Skip auth for webhooks
  }
  verifyToken(req, res, next);
});

// Esquemas de validación
const createPaymentIntentSchema = Joi.object({
  orderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  currency: Joi.string().length(3).default('usd').optional()
});

const confirmPaymentSchema = Joi.object({
  paymentIntentId: Joi.string().required(),
  paymentMethodId: Joi.string().optional()
});

const refundSchema = Joi.object({
  orderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  amount: Joi.number().min(0.50).optional(),
  reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').default('requested_by_customer')
});

// POST /api/payments/create-payment-intent - Crear Payment Intent
router.post('/create-payment-intent', businessMetricsCollector.paymentProcessed, async (req, res) => {
  try {
    const { error, value } = createPaymentIntentSchema.validate(req.body);
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

    const { orderId, currency } = value;

    // Verificar que el pedido existe y pertenece al usuario
    const order = await Order.findById(orderId)
      .populate('customerId', 'name email phone')
      .populate('merchantId', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Verificar que el usuario es el owner del pedido
    if (order.customerId._id.toString() !== req.user.id) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized payment intent creation attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este pedido',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Verificar que el pedido no ha sido pagado ya
    if (order.paymentInfo.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Este pedido ya ha sido pagado',
          code: 'ORDER_ALREADY_PAID'
        }
      });
    }

    // Verificar que el pedido está en estado correcto para pago
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'El pedido no está en un estado válido para pago',
          code: 'INVALID_ORDER_STATUS'
        }
      });
    }

    // Crear Payment Intent
    const paymentIntent = await paymentService.createPaymentIntent(
      orderId,
      order.total,
      currency,
      {
        customerName: order.customerId.name,
        merchantName: order.merchantId.name,
        orderNumber: order.orderNumber
      }
    );

    // Guardar ID del pago para métricas
    res.locals.paymentId = paymentIntent.paymentIntentId;

    res.json({
      success: true,
      message: 'Payment Intent creado exitosamente',
      data: {
        paymentIntent,
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          total: order.total,
          currency: order.paymentInfo.currency
        }
      }
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// POST /api/payments/confirm - Confirmar pago
router.post('/confirm', async (req, res) => {
  try {
    const { error, value } = confirmPaymentSchema.validate(req.body);
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

    const { paymentIntentId, paymentMethodId } = value;

    // Confirmar el pago
    const result = await paymentService.confirmPayment(paymentIntentId, paymentMethodId);

    // Verificar que el usuario tiene acceso al pedido
    const order = await Order.findById(result.order.id);
    if (order && order.customerId.toString() !== req.user.id) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized payment confirmation attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este pago',
          code: 'ACCESS_DENIED'
        }
      });
    }

    res.json({
      success: true,
      message: 'Pago confirmado exitosamente',
      data: result
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Error interno del servidor',
        code: 'PAYMENT_CONFIRMATION_ERROR'
      }
    });
  }
});

// POST /api/payments/cancel - Cancelar pago
router.post('/cancel', async (req, res) => {
  try {
    const { paymentIntentId, reason } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Payment Intent ID es requerido',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    // Obtener información del pago para verificar acceso
    const paymentInfo = await paymentService.getPaymentInfo(paymentIntentId);
    const orderId = paymentInfo.metadata.orderId;

    if (orderId) {
      const order = await Order.findById(orderId);
      if (order && order.customerId.toString() !== req.user.id) {
        securityMonitoring.suspiciousActivity(req, 'Unauthorized payment cancellation attempt');
        return res.status(403).json({
          success: false,
          error: {
            message: 'No tienes acceso a este pago',
            code: 'ACCESS_DENIED'
          }
        });
      }
    }

    const result = await paymentService.cancelPayment(paymentIntentId, reason);

    res.json({
      success: true,
      message: 'Pago cancelado exitosamente',
      data: result
    });

  } catch (error) {
    console.error('Error canceling payment:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Error interno del servidor',
        code: 'PAYMENT_CANCELLATION_ERROR'
      }
    });
  }
});

// POST /api/payments/refund - Procesar reembolso (solo comerciantes)
router.post('/refund', async (req, res) => {
  try {
    const { error, value } = refundSchema.validate(req.body);
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

    const { orderId, amount, reason } = value;

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

    // Solo comerciantes pueden procesar reembolsos de sus pedidos
    if (req.user.role !== 'merchant' || order.merchantId.toString() !== req.user.id) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized refund attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes permisos para procesar este reembolso',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Procesar reembolso
    const refund = await paymentService.processRefund(orderId, amount, reason);

    res.json({
      success: true,
      message: 'Reembolso procesado exitosamente',
      data: {
        refund,
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentInfo.status
        }
      }
    });

  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Error interno del servidor',
        code: 'REFUND_PROCESSING_ERROR'
      }
    });
  }
});

// GET /api/payments/:paymentIntentId - Obtener información del pago
router.get('/:paymentIntentId', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    const paymentInfo = await paymentService.getPaymentInfo(paymentIntentId);
    const orderId = paymentInfo.metadata.orderId;

    // Verificar acceso al pedido si existe
    if (orderId) {
      const order = await Order.findById(orderId);
      if (order) {
        const hasAccess = order.customerId.toString() === req.user.id ||
                          (req.user.role === 'merchant' && order.merchantId.toString() === req.user.id);

        if (!hasAccess) {
          securityMonitoring.suspiciousActivity(req, 'Unauthorized payment info access attempt');
          return res.status(403).json({
            success: false,
            error: {
              message: 'No tienes acceso a esta información de pago',
              code: 'ACCESS_DENIED'
            }
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        payment: paymentInfo
      }
    });

  } catch (error) {
    console.error('Error getting payment info:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Error interno del servidor',
        code: 'PAYMENT_INFO_ERROR'
      }
    });
  }
});

// POST /api/payments/create-customer - Crear customer en Stripe
router.post('/create-customer', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        }
      });
    }

    // Verificar si ya tiene un customer ID
    if (user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'El usuario ya tiene un customer ID de Stripe',
          code: 'CUSTOMER_ALREADY_EXISTS'
        }
      });
    }

    const customer = await paymentService.createCustomer(
      user._id,
      user.email,
      user.name,
      user.phone
    );

    // Guardar customer ID en el usuario
    user.stripeCustomerId = customer.id;
    await user.save();

    res.json({
      success: true,
      message: 'Customer creado exitosamente',
      data: {
        customer
      }
    });

  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Error interno del servidor',
        code: 'CUSTOMER_CREATION_ERROR'
      }
    });
  }
});

// GET /api/payments/methods/list - Obtener métodos de pago del usuario
router.get('/methods/list', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Customer no encontrado en Stripe',
          code: 'CUSTOMER_NOT_FOUND'
        }
      });
    }

    const paymentMethods = await paymentService.getPaymentMethods(user.stripeCustomerId);

    res.json({
      success: true,
      data: {
        paymentMethods
      }
    });

  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Error interno del servidor',
        code: 'PAYMENT_METHODS_ERROR'
      }
    });
  }
});

// POST /api/payments/setup-intent - Crear Setup Intent para guardar método de pago
router.post('/setup-intent', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Customer no encontrado en Stripe',
          code: 'CUSTOMER_NOT_FOUND'
        }
      });
    }

    const setupIntent = await paymentService.createSetupIntent(user.stripeCustomerId);

    res.json({
      success: true,
      message: 'Setup Intent creado exitosamente',
      data: {
        setupIntent
      }
    });

  } catch (error) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message || 'Error interno del servidor',
        code: 'SETUP_INTENT_ERROR'
      }
    });
  }
});

// POST /api/payments/webhook - Webhook de Stripe
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({
        error: 'Missing Stripe signature'
      });
    }

    await paymentService.handleWebhook(req.body, signature);

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      error: `Webhook Error: ${error.message}`
    });
  }
});

module.exports = router;