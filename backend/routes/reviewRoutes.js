const express = require('express');
const Review = require('../models/Review');
const Order = require('../models/Order');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { cachePresets, invalidateCache } = require('../middleware/cache');
const { securityMonitoring } = require('../middleware/monitoring');
const Joi = require('joi');
const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verifyToken);

// Esquemas de validación
const createReviewSchema = Joi.object({
  orderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  merchantRating: Joi.number().integer().min(1).max(5).required(),
  serviceRating: Joi.number().integer().min(1).max(5).required(),
  deliveryRating: Joi.number().integer().min(1).max(5).optional(),
  merchantComment: Joi.string().max(1000).allow('').optional(),
  serviceComment: Joi.string().max(1000).allow('').optional(),
  deliveryComment: Joi.string().max(1000).allow('').optional(),
  generalComment: Joi.string().max(1500).allow('').optional(),
  tags: Joi.array().items(
    Joi.object({
      category: Joi.string().valid('service', 'delivery', 'food_quality', 'price', 'experience').required(),
      tag: Joi.string().valid(
        'fast_service', 'slow_service', 'friendly_staff', 'professional',
        'on_time', 'late_delivery', 'careful_handling', 'good_communication',
        'delicious', 'fresh', 'cold_food', 'wrong_order', 'good_portion',
        'good_value', 'expensive', 'fair_price',
        'recommend', 'will_order_again', 'disappointed', 'exceeded_expectations'
      ).required()
    })
  ).max(10).optional(),
  criteria: Joi.object({
    foodQuality: Joi.number().integer().min(1).max(5).optional(),
    deliverySpeed: Joi.number().integer().min(1).max(5).optional(),
    packaging: Joi.number().integer().min(1).max(5).optional(),
    valueForMoney: Joi.number().integer().min(1).max(5).optional(),
    customerService: Joi.number().integer().min(1).max(5).optional()
  }).optional()
});

const merchantResponseSchema = Joi.object({
  response: Joi.string().min(1).max(1000).required()
});

// POST /api/reviews - Crear una nueva reseña
router.post('/', invalidateCache(['api:reviews:*', 'api:merchants:*']), async (req, res) => {
  try {
    const { error, value } = createReviewSchema.validate(req.body);
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

    const { orderId, ...reviewData } = value;

    // Verificar que el pedido existe y está entregado
    const order = await Order.findById(orderId)
      .populate('customerId', 'name')
      .populate('merchantId', 'name')
      .populate('deliveryPersonId', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Solo el cliente del pedido puede crear la reseña
    if (order.customerId._id.toString() !== req.user.id) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized review creation attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este pedido',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // El pedido debe estar entregado
    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Solo se pueden reseñar pedidos entregados',
          code: 'ORDER_NOT_DELIVERED'
        }
      });
    }

    // Verificar que no existe una reseña previa
    const existingReview = await Review.findOne({ orderId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Ya existe una reseña para este pedido',
          code: 'REVIEW_ALREADY_EXISTS'
        }
      });
    }

    // Crear la reseña
    const review = new Review({
      orderId,
      reviewerId: req.user.id,
      ...reviewData,
      orderInfo: {
        orderNumber: order.orderNumber,
        merchantId: order.merchantId._id,
        merchantName: order.merchantId.name,
        deliveryPersonId: order.deliveryPersonId?._id,
        deliveryPersonName: order.deliveryPersonId?.name,
        orderTotal: order.total,
        orderDate: order.placedAt
      },
      isVerifiedPurchase: true,
      platform: 'mobile', // O detectar desde headers
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    });

    await review.save();

    // Actualizar la reseña en el pedido también
    if (order.customerReview) {
      order.customerReview = {
        merchantRating: reviewData.merchantRating,
        deliveryRating: reviewData.deliveryRating,
        comment: reviewData.generalComment,
        reviewedAt: new Date()
      };
      await order.save();
    }

    // Populate para respuesta
    await review.populate('reviewerId', 'name');

    res.status(201).json({
      success: true,
      message: 'Reseña creada exitosamente',
      data: {
        review
      }
    });

  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/reviews/merchant/:merchantId - Obtener reseñas de un comerciante
router.get('/merchant/:merchantId', cachePresets.static, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      minRating, 
      sortBy = 'recent',
      withComments = false 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const options = {
      limit: parseInt(limit),
      skip,
      sortBy
    };

    if (minRating) {
      options.minRating = parseInt(minRating);
    }

    let reviews = await Review.findByMerchant(merchantId, options);

    // Filtrar solo reseñas con comentarios si se solicita
    if (withComments === 'true') {
      reviews = reviews.filter(review => 
        review.generalComment || 
        review.merchantComment || 
        review.serviceComment || 
        review.deliveryComment
      );
    }

    // Obtener estadísticas del comerciante
    const stats = await Review.getAverageRatings(merchantId);

    res.json({
      success: true,
      data: {
        reviews,
        stats: stats[0] || {
          avgOverall: 0,
          avgMerchant: 0,
          avgService: 0,
          avgDelivery: 0,
          totalReviews: 0,
          ratingBreakdown: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: reviews.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching merchant reviews:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/reviews/delivery/:deliveryPersonId - Obtener reseñas de un delivery
router.get('/delivery/:deliveryPersonId', cachePresets.static, async (req, res) => {
  try {
    const { deliveryPersonId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const reviews = await Review.findByDeliveryPerson(deliveryPersonId, {
      limit: parseInt(limit),
      skip
    });

    // Calcular estadísticas de delivery
    const stats = await Review.aggregate([
      {
        $match: {
          'orderInfo.deliveryPersonId': new mongoose.Types.ObjectId(deliveryPersonId),
          status: 'approved',
          deliveryRating: { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          avgDeliveryRating: { $avg: '$deliveryRating' },
          totalDeliveryReviews: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        stats: stats[0] || {
          avgDeliveryRating: 0,
          totalDeliveryReviews: 0
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: reviews.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching delivery reviews:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/reviews/:reviewId - Obtener una reseña específica
router.get('/:reviewId', cachePresets.static, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId)
      .populate('reviewerId', 'name')
      .populate('orderInfo.merchantId', 'name')
      .populate('orderInfo.deliveryPersonId', 'name')
      .populate('merchantResponse.respondedBy', 'name');

    if (!review) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Reseña no encontrada',
          code: 'REVIEW_NOT_FOUND'
        }
      });
    }

    res.json({
      success: true,
      data: {
        review
      }
    });

  } catch (error) {
    console.error('Error fetching review:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// POST /api/reviews/:reviewId/helpful - Marcar reseña como útil
router.post('/:reviewId/helpful', invalidateCache(['api:reviews:*']), async (req, res) => {
  try {
    const { helpful } = req.body;

    if (typeof helpful !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'El campo helpful debe ser true o false',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Reseña no encontrada',
          code: 'REVIEW_NOT_FOUND'
        }
      });
    }

    // No se puede votar en su propia reseña
    if (review.reviewerId.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No puedes votar en tu propia reseña',
          code: 'CANNOT_VOTE_OWN_REVIEW'
        }
      });
    }

    await review.markHelpful(req.user.id, helpful);

    res.json({
      success: true,
      message: 'Voto registrado exitosamente',
      data: {
        helpfulCount: review.helpfulCount,
        notHelpfulCount: review.notHelpfulCount
      }
    });

  } catch (error) {
    console.error('Error marking review as helpful:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// POST /api/reviews/:reviewId/respond - Responder a una reseña (solo comerciantes)
router.post('/:reviewId/respond', invalidateCache(['api:reviews:*']), async (req, res) => {
  try {
    const { error, value } = merchantResponseSchema.validate(req.body);
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

    const { response } = value;

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Reseña no encontrada',
          code: 'REVIEW_NOT_FOUND'
        }
      });
    }

    // Solo el comerciante de la reseña puede responder
    if (req.user.role !== 'merchant' || review.orderInfo.merchantId.toString() !== req.user.id) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized review response attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo el comerciante puede responder a esta reseña',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Verificar si ya hay una respuesta
    if (review.merchantResponse && review.merchantResponse.comment) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Ya existe una respuesta para esta reseña',
          code: 'RESPONSE_ALREADY_EXISTS'
        }
      });
    }

    await review.addMerchantResponse(response, req.user.id);

    res.json({
      success: true,
      message: 'Respuesta agregada exitosamente',
      data: {
        response: review.merchantResponse
      }
    });

  } catch (error) {
    console.error('Error responding to review:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/reviews/search - Buscar reseñas
router.get('/search', async (req, res) => {
  try {
    const { 
      q: query, 
      merchantId, 
      minRating, 
      maxRating, 
      page = 1, 
      limit = 20 
    } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Query de búsqueda es requerido',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const options = {
      limit: parseInt(limit),
      skip
    };

    if (merchantId) options.merchantId = merchantId;
    if (minRating) options.minRating = parseInt(minRating);
    if (maxRating) options.maxRating = parseInt(maxRating);

    const reviews = await Review.searchReviews(query, options);

    res.json({
      success: true,
      data: {
        reviews,
        query,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: reviews.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error searching reviews:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/reviews/top/:merchantId - Obtener mejores reseñas de un comerciante
router.get('/top/:merchantId', cachePresets.static, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const reviews = await Review.getTopReviews(merchantId, limit);

    res.json({
      success: true,
      data: {
        reviews
      }
    });

  } catch (error) {
    console.error('Error fetching top reviews:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/reviews/stats/:merchantId - Obtener estadísticas de reseñas
router.get('/stats/:merchantId', cachePresets.static, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate } = req.query;

    const timeRange = {};
    if (startDate) timeRange.startDate = startDate;
    if (endDate) timeRange.endDate = endDate;

    const [averageRatings, reviewStats] = await Promise.all([
      Review.getAverageRatings(merchantId),
      Review.getReviewStats(merchantId, timeRange)
    ]);

    res.json({
      success: true,
      data: {
        averageRatings: averageRatings[0] || {
          avgOverall: 0,
          avgMerchant: 0,
          avgService: 0,
          avgDelivery: 0,
          totalReviews: 0,
          ratingBreakdown: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
        },
        stats: reviewStats[0] || {
          totalReviews: 0,
          avgRating: 0,
          totalHelpfulVotes: 0,
          reviewsWithComments: 0,
          responseRate: 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching review stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/reviews/my - Obtener reseñas del usuario
router.get('/my', cachePresets.static, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find({ reviewerId: req.user.id })
      .populate('orderInfo.merchantId', 'name')
      .populate('orderInfo.deliveryPersonId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: reviews.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user reviews:', error);
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