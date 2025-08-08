const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // Información básica de la reseña
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Calificaciones (1-5 estrellas)
  merchantRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: 'La calificación debe ser un número entero entre 1 y 5'
    }
  },
  serviceRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: 'La calificación debe ser un número entero entre 1 y 5'
    }
  },
  deliveryRating: {
    type: Number,
    min: 1,
    max: 5,
    validate: {
      validator: function(v) {
        return v === null || Number.isInteger(v);
      },
      message: 'La calificación debe ser un número entero entre 1 y 5'
    }
  },
  
  // Calificación promedio calculada
  overallRating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  // Comentarios
  merchantComment: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  serviceComment: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  deliveryComment: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  
  // Comentario general
  generalComment: {
    type: String,
    maxlength: 1500,
    trim: true
  },
  
  // Información del pedido (desnormalizada para consultas rápidas)
  orderInfo: {
    orderNumber: String,
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    merchantName: String,
    deliveryPersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveryPersonName: String,
    orderTotal: Number,
    orderDate: Date
  },
  
  // Etiquetas predefinidas
  tags: [{
    category: {
      type: String,
      enum: ['service', 'delivery', 'food_quality', 'price', 'experience']
    },
    tag: {
      type: String,
      enum: [
        // Service tags
        'fast_service', 'slow_service', 'friendly_staff', 'professional',
        // Delivery tags
        'on_time', 'late_delivery', 'careful_handling', 'good_communication',
        // Food quality tags
        'delicious', 'fresh', 'cold_food', 'wrong_order', 'good_portion',
        // Price tags
        'good_value', 'expensive', 'fair_price',
        // Experience tags
        'recommend', 'will_order_again', 'disappointed', 'exceeded_expectations'
      ]
    }
  }],
  
  // Características específicas evaluadas
  criteria: {
    foodQuality: {
      type: Number,
      min: 1,
      max: 5
    },
    deliverySpeed: {
      type: Number,
      min: 1,
      max: 5
    },
    packaging: {
      type: Number,
      min: 1,
      max: 5
    },
    valueForMoney: {
      type: Number,
      min: 1,
      max: 5
    },
    customerService: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Estado de la reseña
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'approved'
  },
  
  // Moderación
  moderation: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    reason: String,
    notes: String
  },
  
  // Interacciones
  helpful: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpful: Boolean, // true for helpful, false for not helpful
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  helpfulCount: {
    type: Number,
    default: 0
  },
  notHelpfulCount: {
    type: Number,
    default: 0
  },
  
  // Respuesta del comerciante
  merchantResponse: {
    comment: {
      type: String,
      maxlength: 1000
    },
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // Información adicional
  isVerifiedPurchase: {
    type: Boolean,
    default: true
  },
  
  // Metadatos
  language: {
    type: String,
    default: 'es'
  },
  platform: {
    type: String,
    enum: ['mobile', 'web'],
    default: 'mobile'
  },
  
  // Información del dispositivo/ubicación (opcional)
  metadata: {
    userAgent: String,
    ipAddress: String,
    location: {
      city: String,
      country: String
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes para mejor performance
reviewSchema.index({ orderId: 1 });
reviewSchema.index({ reviewerId: 1, createdAt: -1 });
reviewSchema.index({ 'orderInfo.merchantId': 1, status: 1, createdAt: -1 });
reviewSchema.index({ 'orderInfo.deliveryPersonId': 1, status: 1, createdAt: -1 });
reviewSchema.index({ overallRating: -1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ helpfulCount: -1 });

// Index de texto para búsqueda
reviewSchema.index({
  merchantComment: 'text',
  serviceComment: 'text',
  deliveryComment: 'text',
  generalComment: 'text'
});

// Virtual para calcular la puntuación de utilidad
reviewSchema.virtual('helpfulnessScore').get(function() {
  const total = this.helpfulCount + this.notHelpfulCount;
  if (total === 0) return 0;
  return this.helpfulCount / total;
});

// Virtual para verificar si la reseña es reciente
reviewSchema.virtual('isRecent').get(function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.createdAt > thirtyDaysAgo;
});

// Virtual para obtener todas las calificaciones válidas
reviewSchema.virtual('validRatings').get(function() {
  const ratings = [this.merchantRating, this.serviceRating];
  if (this.deliveryRating) {
    ratings.push(this.deliveryRating);
  }
  return ratings;
});

// Pre-save middleware para calcular calificación promedio
reviewSchema.pre('save', function(next) {
  const validRatings = this.validRatings;
  if (validRatings.length > 0) {
    this.overallRating = Number((validRatings.reduce((a, b) => a + b) / validRatings.length).toFixed(1));
  }
  
  next();
});

// Pre-save middleware para actualizar contadores de utilidad
reviewSchema.pre('save', function(next) {
  if (this.isModified('helpful')) {
    this.helpfulCount = this.helpful.filter(h => h.helpful === true).length;
    this.notHelpfulCount = this.helpful.filter(h => h.helpful === false).length;
  }
  
  next();
});

// Instance methods
reviewSchema.methods.markHelpful = function(userId, isHelpful) {
  // Remover voto anterior si existe
  this.helpful = this.helpful.filter(h => h.userId.toString() !== userId.toString());
  
  // Agregar nuevo voto
  this.helpful.push({
    userId,
    helpful: isHelpful,
    timestamp: new Date()
  });
  
  return this.save();
};

reviewSchema.methods.addMerchantResponse = function(response, respondedBy) {
  this.merchantResponse = {
    comment: response,
    respondedAt: new Date(),
    respondedBy
  };
  
  return this.save();
};

reviewSchema.methods.updateModerationStatus = function(status, moderatorId, reason = null, notes = null) {
  this.status = status;
  this.moderation = {
    reviewedBy: moderatorId,
    reviewedAt: new Date(),
    reason,
    notes
  };
  
  return this.save();
};

reviewSchema.methods.getSummary = function() {
  return {
    id: this._id,
    overallRating: this.overallRating,
    merchantRating: this.merchantRating,
    serviceRating: this.serviceRating,
    deliveryRating: this.deliveryRating,
    generalComment: this.generalComment,
    tags: this.tags,
    helpfulCount: this.helpfulCount,
    isRecent: this.isRecent,
    createdAt: this.createdAt,
    reviewer: {
      name: this.reviewerId?.name || 'Usuario anónimo'
    }
  };
};

// Static methods
reviewSchema.statics.findByMerchant = function(merchantId, options = {}) {
  const { status = 'approved', limit = 20, skip = 0, minRating = null, sortBy = 'recent' } = options;
  
  const query = {
    'orderInfo.merchantId': merchantId,
    status
  };
  
  if (minRating) {
    query.overallRating = { $gte: minRating };
  }
  
  let sort = {};
  switch (sortBy) {
    case 'rating_high':
      sort = { overallRating: -1, createdAt: -1 };
      break;
    case 'rating_low':
      sort = { overallRating: 1, createdAt: -1 };
      break;
    case 'helpful':
      sort = { helpfulCount: -1, createdAt: -1 };
      break;
    default:
      sort = { createdAt: -1 };
  }
  
  return this.find(query)
    .populate('reviewerId', 'name')
    .sort(sort)
    .limit(limit)
    .skip(skip);
};

reviewSchema.statics.findByDeliveryPerson = function(deliveryPersonId, options = {}) {
  const { status = 'approved', limit = 20, skip = 0 } = options;
  
  return this.find({
    'orderInfo.deliveryPersonId': deliveryPersonId,
    status,
    deliveryRating: { $exists: true }
  })
  .populate('reviewerId', 'name')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip);
};

reviewSchema.statics.getAverageRatings = function(merchantId) {
  return this.aggregate([
    {
      $match: {
        'orderInfo.merchantId': new mongoose.Types.ObjectId(merchantId),
        status: 'approved'
      }
    },
    {
      $group: {
        _id: null,
        avgOverall: { $avg: '$overallRating' },
        avgMerchant: { $avg: '$merchantRating' },
        avgService: { $avg: '$serviceRating' },
        avgDelivery: { $avg: '$deliveryRating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$overallRating'
        }
      }
    },
    {
      $addFields: {
        ratingBreakdown: {
          '5': {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 5] }
              }
            }
          },
          '4': {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 4] }
              }
            }
          },
          '3': {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 3] }
              }
            }
          },
          '2': {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 2] }
              }
            }
          },
          '1': {
            $size: {
              $filter: {
                input: '$ratingDistribution',
                cond: { $eq: ['$$this', 1] }
              }
            }
          }
        }
      }
    }
  ]);
};

reviewSchema.statics.getReviewStats = function(merchantId, timeRange = {}) {
  const { startDate, endDate } = timeRange;
  const matchQuery = {
    'orderInfo.merchantId': new mongoose.Types.ObjectId(merchantId),
    status: 'approved'
  };
  
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        avgRating: { $avg: '$overallRating' },
        totalHelpfulVotes: { $sum: '$helpfulCount' },
        reviewsWithComments: {
          $sum: {
            $cond: [
              { $ne: ['$generalComment', null] },
              1,
              0
            ]
          }
        },
        responseRate: {
          $avg: {
            $cond: [
              { $ne: ['$merchantResponse.comment', null] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
};

reviewSchema.statics.searchReviews = function(searchQuery, options = {}) {
  const { merchantId, minRating, maxRating, limit = 20, skip = 0 } = options;
  
  const query = {
    $text: { $search: searchQuery },
    status: 'approved'
  };
  
  if (merchantId) {
    query['orderInfo.merchantId'] = merchantId;
  }
  
  if (minRating || maxRating) {
    query.overallRating = {};
    if (minRating) query.overallRating.$gte = minRating;
    if (maxRating) query.overallRating.$lte = maxRating;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .populate('reviewerId', 'name')
    .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

reviewSchema.statics.getTopReviews = function(merchantId, limit = 5) {
  return this.find({
    'orderInfo.merchantId': merchantId,
    status: 'approved',
    overallRating: { $gte: 4 }
  })
  .populate('reviewerId', 'name')
  .sort({ helpfulCount: -1, overallRating: -1, createdAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Review', reviewSchema);