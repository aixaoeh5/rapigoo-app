const mongoose = require('mongoose');
const { ORDER_STATUS, CURRENCY } = require('../utils/statusConstants');

const orderItemSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  specialInstructions: {
    type: String,
    maxlength: 500
  },
  options: [{
    name: String,
    value: String,
    price: {
      type: Number,
      default: 0
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  _id: false
});

const deliveryInfoSchema = new mongoose.Schema({
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 &&
                 coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Coordinates must be [longitude, latitude] within valid ranges'
      }
    }
  },
  instructions: {
    type: String,
    maxlength: 500
  },
  contactPhone: {
    type: String,
    required: true
  },
  estimatedDeliveryTime: Date,
  actualDeliveryTime: Date
});

const paymentInfoSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['card', 'cash', 'digital_wallet'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: String,
  paymentIntentId: String,
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  processedAt: Date,
  failureReason: String
});

const orderTrackingSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  description: String,
  location: {
    type: [Number],
    required: false,
    validate: {
      validator: function(coords) {
        // Si no hay coordenadas o es undefined/null, es válido
        if (!coords || coords === undefined || coords === null) return true;
        // Si es un array vacío, es válido
        if (Array.isArray(coords) && coords.length === 0) return true;
        // Si es un array con coordenadas, validar que tenga 2 elementos en rango
        return coords.length === 2 && 
               coords[0] >= -180 && coords[0] <= 180 &&
               coords[1] >= -90 && coords[1] <= 90;
      },
      message: 'Coordinates must be [longitude, latitude] within valid ranges'
    }
  },
  estimatedTime: Date,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deliveryPersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  items: [orderItemSchema],
  
  // Pricing
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  deliveryFee: {
    type: Number,
    required: true,
    min: 0
  },
  serviceFee: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Order details
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.PENDING
  },
  deliveryInfo: deliveryInfoSchema,
  paymentInfo: paymentInfoSchema,
  
  // Tracking
  tracking: [orderTrackingSchema],
  
  // Timing
  placedAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: Date,
  preparedAt: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  
  // Communication
  notes: {
    type: String,
    maxlength: 1000
  },
  merchantNotes: {
    type: String,
    maxlength: 1000
  },
  cancellationReason: {
    type: String,
    maxlength: 500
  },
  
  // Reviews
  customerReview: {
    merchantRating: {
      type: Number,
      min: 1,
      max: 5
    },
    deliveryRating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: 1000
    },
    reviewedAt: Date
  },
  
  // Metadata
  platform: {
    type: String,
    enum: ['mobile', 'web'],
    default: 'mobile'
  },
  deviceInfo: String,
  
  // Version field for optimistic locking
  __v: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  // Enable optimistic concurrency by default
  optimisticConcurrency: true
});

// Indexes for better performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ merchantId: 1, createdAt: -1 });
orderSchema.index({ deliveryPersonId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'deliveryInfo.coordinates': '2dsphere' });
orderSchema.index({ placedAt: -1 });

// Virtual for order age
orderSchema.virtual('age').get(function() {
  if (!this.placedAt) {
    return 0;
  }
  return Date.now() - this.placedAt.getTime();
});

// Virtual for is active order
orderSchema.virtual('isActive').get(function() {
  return !['delivered', 'cancelled'].includes(this.status);
});

// Virtual for can be cancelled
orderSchema.virtual('canBeCancelled').get(function() {
  return ['pending', 'confirmed'].includes(this.status) && 
         this.age < 5 * 60 * 1000; // 5 minutes
});

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    this.orderNumber = `RP${year}${month}${day}${(count + 1).toString().padStart(4, '0')}`;
  }
  
  // Calculate total if not provided
  if (this.isModified('items') || this.isModified('deliveryFee') || this.isModified('serviceFee') || this.isModified('tax') || this.isModified('discount')) {
    this.total = this.subtotal + this.deliveryFee + this.serviceFee + this.tax - this.discount;
  }
  
  next();
});

// Pre-save middleware to update tracking
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    // Crear nueva entrada de tracking
    const trackingEntry = {
      status: this.status,
      timestamp: new Date(),
      description: this._pendingTrackingUpdate?.description || this.getStatusDescription(this.status)
    };
    
    // Agregar updatedBy si existe
    if (this._pendingTrackingUpdate?.updatedBy) {
      trackingEntry.updatedBy = this._pendingTrackingUpdate.updatedBy;
    }
    
    // Solo agregar location si hay coordenadas válidas
    // No agregar location por defecto para evitar validation errors
    
    // Asegurar que tracking es un array
    if (!Array.isArray(this.tracking)) {
      this.tracking = [];
    }
    
    this.tracking.push(trackingEntry);
    
    // Limpiar valores temporales
    delete this._pendingTrackingUpdate;
    
    // Update timing fields
    switch (this.status) {
      case 'confirmed':
        this.confirmedAt = new Date();
        break;
      case 'ready':
        this.preparedAt = new Date();
        break;
      case 'delivered':
        this.deliveredAt = new Date();
        this.deliveryInfo.actualDeliveryTime = new Date();
        
        // Programar actualización de estadísticas después de guardar
        this._shouldUpdateStats = true;
        break;
      case 'cancelled':
        this.cancelledAt = new Date();
        break;
    }
  }
  
  next();
});

// Post-save middleware para actualizar estadísticas cuando se completa un pedido
orderSchema.post('save', async function(doc) {
  if (doc._shouldUpdateStats && doc.status === 'delivered') {
    // Usar setImmediate para ejecutar después del response
    setImmediate(async () => {
      try {
        await this.constructor.updateAllStatsOnDelivery(doc._id);
      } catch (error) {
        console.error('❌ Error en post-save stats update:', error);
      }
    });
  }
});

// Instance methods
orderSchema.methods.getStatusDescription = function(status) {
  const descriptions = {
    pending: 'Pedido recibido, esperando confirmación',
    confirmed: 'Pedido confirmado por el comerciante',
    preparing: 'Preparando tu pedido',
    ready: 'Pedido listo para recolectar',
    assigned: 'Delivery asignado',
    at_pickup: 'Delivery llegó al restaurante',
    picked_up: 'Pedido recolectado por el delivery',
    in_transit: 'En camino hacia tu ubicación',
    delivered: 'Pedido entregado',
    cancelled: 'Pedido cancelado'
  };
  return descriptions[status] || 'Estado desconocido';
};

orderSchema.methods.canTransitionTo = function(newStatus) {
  const validTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['assigned', 'cancelled'],
    assigned: ['at_pickup', 'picked_up', 'delivered', 'cancelled'], // Permitir transición a at_pickup
    at_pickup: ['picked_up', 'delivered', 'cancelled'], // Delivery llegó, comerciante puede entregar
    picked_up: ['in_transit', 'delivered'], // Permitir salto directo a delivered
    in_transit: ['delivered'],
    delivered: [],
    cancelled: []
  };
  
  return validTransitions[this.status]?.includes(newStatus) || false;
};

orderSchema.methods.updateStatus = async function(newStatus, description = null, updatedBy = null) {
  if (!this.canTransitionTo(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }
  
  const currentVersion = this.__v;
  const previousStatus = this.status;
  
  this.status = newStatus;
  
  // La actualización del tracking se hace en el pre-save hook
  // Solo guardamos los valores opcionales para usar después
  this._pendingTrackingUpdate = {
    description: description,
    updatedBy: updatedBy
  };
  
  try {
    // Intentar guardar con optimistic locking
    const result = await this.save();
    console.log(`✅ Status updated: ${previousStatus} → ${newStatus} (v${currentVersion} → v${this.__v})`);
    return result;
  } catch (error) {
    // Manejar conflictos de versión
    if (error.name === 'VersionError') {
      const conflictError = new Error(`Concurrent modification detected. Order was modified by another process. Please refresh and try again.`);
      conflictError.name = 'ConcurrencyConflictError';
      conflictError.code = 'CONCURRENCY_CONFLICT';
      conflictError.currentVersion = currentVersion;
      throw conflictError;
    }
    throw error;
  }
};

orderSchema.methods.calculateDeliveryTime = function() {
  const basePreparationTime = 30; // 30 minutes base
  const itemPreparationTime = this.items.reduce((total, item) => {
    return total + (item.quantity * 5); // 5 minutes per item
  }, 0);
  
  const totalPreparationTime = basePreparationTime + itemPreparationTime;
  const deliveryTime = 20; // 20 minutes for delivery
  
  const estimatedTime = new Date(Date.now() + (totalPreparationTime + deliveryTime) * 60000);
  this.deliveryInfo.estimatedDeliveryTime = estimatedTime;
  
  return estimatedTime;
};

orderSchema.methods.addReview = function(rating, comment) {
  this.customerReview = {
    merchantRating: rating.merchant || rating,
    deliveryRating: rating.delivery,
    comment,
    reviewedAt: new Date()
  };
  
  return this.save();
};

// Static methods
orderSchema.statics.findActiveOrders = function(userId, userType = 'customer') {
  const field = userType === 'customer' ? 'customerId' : 
                userType === 'merchant' ? 'merchantId' : 'deliveryPersonId';
  
  // Estados considerados activos (NO finalizados)
  const activeStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit'];
  // Estados finalizados que NO deben aparecer en activos
  const finishedStatuses = ['delivered', 'cancelled'];
  
  return this.find({
    [field]: userId,
    status: { $nin: finishedStatuses }  // Excluir estados finalizados
  }).populate('customerId merchantId deliveryPersonId', 'name email phone')
    .populate('items.serviceId', 'name images')
    .sort({ createdAt: -1 });
};

orderSchema.statics.findOrderHistory = function(userId, userType = 'customer', options = {}) {
  const field = userType === 'customer' ? 'customerId' : 
                userType === 'merchant' ? 'merchantId' : 'deliveryPersonId';
  
  const query = {
    [field]: userId,
    status: { $in: ['delivered', 'cancelled'] }
  };
  
  return this.find(query)
    .populate('customerId merchantId deliveryPersonId', 'name email phone')
    .populate('items.serviceId', 'name images')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

orderSchema.statics.getOrderStats = function(merchantId, dateRange = {}) {
  const { startDate, endDate } = dateRange;
  const matchQuery = { merchantId };
  
  if (startDate || endDate) {
    matchQuery.placedAt = {};
    if (startDate) matchQuery.placedAt.$gte = new Date(startDate);
    if (endDate) matchQuery.placedAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' },
        deliveredOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        }
      }
    },
    {
      $addFields: {
        fulfillmentRate: {
          $cond: [
            { $gt: ['$totalOrders', 0] },
            { $divide: ['$deliveredOrders', '$totalOrders'] },
            0
          ]
        }
      }
    }
  ]);
};

// Método para actualizar estadísticas del delivery cuando se entrega un pedido
orderSchema.statics.updateDeliveryStats = async function(orderId) {
  try {
    const order = await this.findById(orderId);
    if (!order || order.status !== 'delivered' || !order.deliveryPersonId) {
      return; // Solo actualizar si la orden está delivered y tiene delivery asignado
    }

    const User = require('./User');
    const delivery = await User.findById(order.deliveryPersonId);
    if (!delivery || delivery.role !== 'delivery') {
      return;
    }

    // Inicializar delivery object si no existe
    if (!delivery.delivery) {
      delivery.delivery = {};
    }

    // Inicializar deliveryStats si no existen
    if (!delivery.delivery.deliveryStats) {
      delivery.delivery.deliveryStats = {
        totalDeliveries: 0,
        completedDeliveries: 0,
        cancelledDeliveries: 0,
        averageRating: 0,
        totalEarnings: 0
      };
    }

    // Calcular ganancias del delivery (asumiendo 10% del total del pedido)
    const deliveryEarnings = Math.round((order.total || 0) * 0.1);

    // Actualizar estadísticas del delivery
    delivery.delivery.deliveryStats.totalDeliveries += 1;
    delivery.delivery.deliveryStats.completedDeliveries += 1;
    delivery.delivery.deliveryStats.totalEarnings += deliveryEarnings;

    await delivery.save();
    console.log(`✅ Estadísticas actualizadas para delivery ${delivery.name} - Ganancias: RD$${deliveryEarnings}`);
    
  } catch (error) {
    console.error('❌ Error actualizando estadísticas del delivery:', error);
  }
};

// Método para actualizar estadísticas del merchant cuando se entrega un pedido
orderSchema.statics.updateMerchantStats = async function(orderId) {
  try {
    const order = await this.findById(orderId);
    if (!order || order.status !== 'delivered') {
      return; // Solo actualizar si la orden está delivered
    }

    const User = require('./User');
    const merchant = await User.findById(order.merchantId);
    if (!merchant || merchant.role !== 'comerciante') {
      return;
    }

    // Inicializar stats si no existen
    if (!merchant.business.stats) {
      merchant.business.stats = {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        averageRating: 0,
        totalReviews: 0,
        thisWeekOrders: 0,
        thisMonthOrders: 0,
        lastStatsUpdate: new Date()
      };
    }

    // Verificar si esta orden ya fue contada (evitar duplicados)
    const currentDate = new Date();
    const weekStart = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // Actualizar estadísticas
    merchant.business.stats.totalOrders += 1;
    merchant.business.stats.completedOrders += 1;
    merchant.business.stats.totalRevenue += order.total || 0;
    
    // Calcular nuevo promedio de valor de orden
    merchant.business.stats.averageOrderValue = 
      merchant.business.stats.totalRevenue / merchant.business.stats.totalOrders;

    // Incrementar contadores de semana y mes si la orden es reciente
    if (order.placedAt >= weekStart) {
      merchant.business.stats.thisWeekOrders += 1;
    }
    if (order.placedAt >= monthStart) {
      merchant.business.stats.thisMonthOrders += 1;
    }

    merchant.business.stats.lastStatsUpdate = new Date();

    await merchant.save();
    console.log(`✅ Estadísticas actualizadas para merchant ${merchant.business.businessName}`);
    
  } catch (error) {
    console.error('❌ Error actualizando estadísticas del merchant:', error);
  }
};

// Método maestro para actualizar todas las estadísticas cuando se completa un pedido
orderSchema.statics.updateAllStatsOnDelivery = async function(orderId) {
  console.log(`📊 Actualizando estadísticas para pedido completado: ${orderId}`);
  
  try {
    // Actualizar estadísticas del comerciante
    await this.updateMerchantStats(orderId);
    
    // Actualizar estadísticas del delivery
    await this.updateDeliveryStats(orderId);
    
    console.log(`✅ Todas las estadísticas actualizadas para pedido ${orderId}`);
    
  } catch (error) {
    console.error('❌ Error actualizando estadísticas completas:', error);
  }
};

module.exports = mongoose.model('Order', orderSchema);