const mongoose = require('mongoose');

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
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
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
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
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
  deviceInfo: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
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
        break;
      case 'cancelled':
        this.cancelledAt = new Date();
        break;
    }
  }
  
  next();
});

// Instance methods
orderSchema.methods.getStatusDescription = function(status) {
  const descriptions = {
    pending: 'Pedido recibido, esperando confirmación',
    confirmed: 'Pedido confirmado por el comerciante',
    preparing: 'Preparando tu pedido',
    ready: 'Pedido listo para recolectar',
    assigned: 'Delivery asignado',
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
    assigned: ['picked_up', 'cancelled'],
    picked_up: ['in_transit'],
    in_transit: ['delivered'],
    delivered: [],
    cancelled: []
  };
  
  return validTransitions[this.status]?.includes(newStatus) || false;
};

orderSchema.methods.updateStatus = function(newStatus, description = null, updatedBy = null) {
  if (!this.canTransitionTo(newStatus)) {
    throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
  }
  
  this.status = newStatus;
  
  // La actualización del tracking se hace en el pre-save hook
  // Solo guardamos los valores opcionales para usar después
  this._pendingTrackingUpdate = {
    description: description,
    updatedBy: updatedBy
  };
  
  return this.save();
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
  
  return this.find({
    [field]: userId,
    status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit'] }
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

module.exports = mongoose.model('Order', orderSchema);