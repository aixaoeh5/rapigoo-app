const mongoose = require('mongoose');
const { DELIVERY_STATUS, formatCoordinates } = require('../utils/statusConstants');

const locationSchema = new mongoose.Schema({
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true,
    validate: {
      validator: function(coords) {
        return coords.length === 2 && 
               coords[0] >= -180 && coords[0] <= 180 &&
               coords[1] >= -90 && coords[1] <= 90;
      },
      message: 'Coordinates must be [longitude, latitude] within valid ranges'
    }
  },
  accuracy: {
    type: Number,
    min: 0
  },
  altitude: Number,
  altitudeAccuracy: Number,
  heading: {
    type: Number,
    min: 0,
    max: 360
  },
  speed: {
    type: Number,
    min: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const routePointSchema = new mongoose.Schema({
  coordinates: {
    type: [Number],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  distanceFromPrevious: {
    type: Number,
    default: 0
  },
  estimatedTimeToDestination: Number // in minutes
});

const deliveryTrackingSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order ID is required for delivery tracking'],
    unique: true,
    validate: {
      validator: async function(orderId) {
        // Validate that the referenced order exists
        if (!orderId) return false;
        const Order = mongoose.model('Order');
        const order = await Order.findById(orderId);
        return !!order;
      },
      message: 'Referenced order does not exist'
    }
  },
  deliveryPersonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Concurrency control
  version: {
    type: Number,
    default: 0
  },
  operationLock: {
    type: Date,
    default: null,
    index: { expireAfterSeconds: 30 } // Auto-expire after 30 seconds
  },
  lastOperationId: {
    type: String,
    default: null
  },
  
  // Current tracking status
  status: {
    type: String,
    enum: Object.values(DELIVERY_STATUS),
    default: DELIVERY_STATUS.ASSIGNED
  },
  
  // Location tracking
  currentLocation: locationSchema,
  
  // Route tracking
  route: [routePointSchema],
  
  // Destinations
  pickupLocation: {
    coordinates: {
      type: [Number],
      required: true
    },
    address: String,
    arrived: {
      type: Boolean,
      default: false
    },
    arrivedAt: Date,
    leftAt: Date
  },
  
  deliveryLocation: {
    coordinates: {
      type: [Number],
      required: true
    },
    address: String,
    arrived: {
      type: Boolean,
      default: false
    },
    arrivedAt: Date,
    deliveredAt: Date
  },
  
  // Distance and time calculations
  totalDistance: {
    type: Number,
    default: 0 // in kilometers
  },
  estimatedTotalTime: Number, // in minutes
  actualTotalTime: Number, // in minutes
  
  // ETA calculations
  estimatedPickupTime: Date,
  actualPickupTime: Date,
  estimatedDeliveryTime: Date,
  actualDeliveryTime: Date,
  
  // Delivery details
  deliveryNotes: String,
  deliveryPhoto: String, // URL to delivery confirmation photo
  customerSignature: String, // Base64 signature or URL
  
  // Status history
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(DELIVERY_STATUS)
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      type: [Number]
    },
    notes: String
  }],
  
  // Performance metrics
  metrics: {
    averageSpeed: Number, // km/h
    maxSpeed: Number, // km/h
    totalStops: {
      type: Number,
      default: 0
    },
    timeSpentStationary: Number, // in minutes
    onTimeDelivery: {
      type: Boolean,
      default: null
    }
  },
  
  // Real-time features
  isLive: {
    type: Boolean,
    default: false
  },
  lastLocationUpdate: {
    type: Date,
    default: Date.now
  },
  
  // Notifications sent
  notificationsSent: [{
    type: {
      type: String,
      enum: ['assigned', 'pickup_arrived', 'picked_up', 'delivery_arrived', 'delivered', 'delay_alert']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    recipient: {
      type: String,
      enum: ['customer', 'merchant', 'delivery']
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
deliveryTrackingSchema.index({ orderId: 1 });
deliveryTrackingSchema.index({ deliveryPersonId: 1, status: 1 });
deliveryTrackingSchema.index({ 'currentLocation.coordinates': '2dsphere' });
deliveryTrackingSchema.index({ status: 1, createdAt: -1 });
deliveryTrackingSchema.index({ isLive: 1, lastLocationUpdate: -1 });

// Virtual for calculating distance to pickup
deliveryTrackingSchema.virtual('distanceToPickup').get(function() {
  if (!this.currentLocation || !this.pickupLocation) return null;
  return this.calculateDistance(
    this.currentLocation.coordinates,
    this.pickupLocation.coordinates
  );
});

// Virtual for calculating distance to delivery
deliveryTrackingSchema.virtual('distanceToDelivery').get(function() {
  if (!this.currentLocation || !this.deliveryLocation) return null;
  return this.calculateDistance(
    this.currentLocation.coordinates,
    this.deliveryLocation.coordinates
  );
});

// Virtual for checking if delivery is running late
deliveryTrackingSchema.virtual('isRunningLate').get(function() {
  if (!this.estimatedDeliveryTime) return false;
  return new Date() > this.estimatedDeliveryTime && this.status !== 'delivered';
});

// Virtual for current ETA
deliveryTrackingSchema.virtual('currentETA').get(function() {
  if (this.status === 'delivered') return null;
  
  // Calculate ETA based on current location and average speed
  const targetLocation = this.status.includes('pickup') || this.status === 'assigned' || this.status === 'heading_to_pickup' 
    ? this.pickupLocation.coordinates 
    : this.deliveryLocation.coordinates;
    
  if (!this.currentLocation || !targetLocation) return null;
  
  const distance = this.calculateDistance(this.currentLocation.coordinates, targetLocation);
  const averageSpeed = this.metrics?.averageSpeed || 25; // Default 25 km/h
  const etaMinutes = (distance / averageSpeed) * 60;
  
  return new Date(Date.now() + etaMinutes * 60000);
});

// Pre-save middleware for basic validation only
deliveryTrackingSchema.pre('save', function(next) {
  // Update last location update timestamp only
  if (this.isModified('currentLocation')) {
    this.lastLocationUpdate = new Date();
  }
  
  next();
});

// Instance methods
deliveryTrackingSchema.methods.getStatusDescription = function(status) {
  const descriptions = {
    assigned: 'Delivery asignado al pedido',
    heading_to_pickup: 'En camino a recoger el pedido',
    at_pickup: 'Llegó al punto de recogida',
    picked_up: 'Pedido recogido, en camino al cliente',
    heading_to_delivery: 'En camino al punto de entrega',
    at_delivery: 'Llegó al punto de entrega',
    delivered: 'Pedido entregado exitosamente',
    cancelled: 'Delivery cancelado'
  };
  return descriptions[status] || 'Estado desconocido';
};

deliveryTrackingSchema.methods.calculateDistance = function(coords1, coords2) {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;
  
  const R = 6371; // Radio de la Tierra en km
  const dLat = this.toRadians(lat2 - lat1);
  const dLon = this.toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en km
};

deliveryTrackingSchema.methods.toRadians = function(degrees) {
  return degrees * (Math.PI / 180);
};

// Simplified atomic update method without complex locking
deliveryTrackingSchema.methods.atomicUpdate = async function(updateFn, operationId = null, maxRetries = 3) {
  const Model = this.constructor;
  let retryCount = 0;
  
  operationId = operationId || `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  while (retryCount < maxRetries) {
    try {
      // Get fresh document
      const currentDoc = await Model.findById(this._id);
      if (!currentDoc) {
        throw new Error('Document not found');
      }
      
      // Apply the update function
      const updatedDoc = await updateFn.call(currentDoc);
      
      // Prepare update data excluding version and _id
      const updateData = { ...updatedDoc.toObject() };
      delete updateData.version;
      delete updateData._id;
      delete updateData.__v;
      updateData.lastOperationId = operationId;
      
      // Use findOneAndUpdate with version check for optimistic locking
      const finalResult = await Model.findOneAndUpdate(
        { 
          _id: updatedDoc._id,
          version: currentDoc.version  // Optimistic locking
        },
        {
          ...updateData,
          $inc: { version: 1 }
        },
        { 
          new: true,
          runValidators: true
        }
      );
      
      if (!finalResult) {
        // Version conflict, retry
        console.log(`⚠️ Version conflict on attempt ${retryCount + 1}, retrying...`);
        await this.waitWithBackoff(retryCount);
        retryCount++;
        continue;
      }
      
      // Update current document with final result
      Object.assign(this, finalResult.toObject());
      
      // Emit real-time updates after successful save
      this.emitRealtimeUpdate(operationId);
      
      return finalResult;
      
    } catch (error) {
      console.error(`❌ Atomic update attempt ${retryCount + 1} failed:`, error.message);
      
      if (error.message.includes('E11000') || error.message.includes('VersionError') || 
          error.message.includes('version') || !error.message.includes('cast')) {
        // Recoverable error, retry
        await this.waitWithBackoff(retryCount);
        retryCount++;
        continue;
      }
      
      // Non-recoverable error
      throw error;
    }
  }
  
  throw new Error(`Failed to complete atomic update after ${maxRetries} retries`);
};

// Wait with exponential backoff
deliveryTrackingSchema.methods.waitWithBackoff = async function(retryCount) {
  const delay = Math.min(1000 * Math.pow(2, retryCount) + Math.random() * 1000, 5000);
  await new Promise(resolve => setTimeout(resolve, delay));
};

// Emit real-time updates
deliveryTrackingSchema.methods.emitRealtimeUpdate = function(operationId) {
  process.nextTick(() => {
    try {
      const realTimeService = require('../services/socketService');
      if (realTimeService && realTimeService.emitStatusUpdate) {
        realTimeService.emitStatusUpdate({
          orderId: this.orderId,
          deliveryPersonId: this.deliveryPersonId,
          status: this.status,
          currentLocation: this.currentLocation,
          operationId: operationId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.log('⚠️ Real-time service not available:', error.message);
    }
  });
};

// Location update with atomic operations
deliveryTrackingSchema.methods.updateLocation = function(locationData, operationId = null) {
  return this.atomicUpdate(async () => {
    const statusChanged = this.updateLocationOnly(locationData);
    
    // If status changed due to automatic arrival, add to history
    if (statusChanged) {
      this.statusHistory.push({
        status: this.status,
        timestamp: new Date(),
        location: this.currentLocation?.coordinates,
        notes: 'Arrival detected automatically',
        automatic: true,
        operationId: operationId || `auto_${Date.now()}`
      });
      
      // Update timing fields
      this.updateTimingFields(this.status);
    }
    
    return this;
  }, operationId);
};

// Location update without triggering status changes (internal use)
deliveryTrackingSchema.methods.updateLocationOnly = function(locationData) {
  const newLocation = {
    coordinates: [locationData.longitude, locationData.latitude],
    accuracy: locationData.accuracy,
    altitude: locationData.altitude,
    altitudeAccuracy: locationData.altitudeAccuracy,
    heading: locationData.heading,
    speed: locationData.speed,
    timestamp: new Date()
  };
  
  // Add to route if there's a significant change in position
  if (this.currentLocation) {
    const distance = this.calculateDistance(
      this.currentLocation.coordinates,
      newLocation.coordinates
    );
    
    // Only add to route if moved more than 10 meters
    if (distance > 0.01) {
      this.route.push({
        coordinates: newLocation.coordinates,
        timestamp: newLocation.timestamp,
        distanceFromPrevious: distance
      });
      
      // Update total distance
      this.totalDistance += distance;
    }
    
    // Update metrics
    if (newLocation.speed && newLocation.speed > 0) {
      const speeds = this.route
        .map(point => point.speed)
        .filter(speed => speed && speed > 0);
      
      if (speeds.length > 0) {
        this.metrics.averageSpeed = speeds.reduce((a, b) => a + b) / speeds.length;
        this.metrics.maxSpeed = Math.max(...speeds);
      }
    }
  }
  
  this.currentLocation = newLocation;
  this.lastLocationUpdate = new Date();
  
  // Check if arrived at destinations
  return this.checkArrivalStatus();
};

// Extract timing field updates
deliveryTrackingSchema.methods.updateTimingFields = function(status) {
  switch (status) {
    case 'at_pickup':
      this.pickupLocation.arrived = true;
      this.pickupLocation.arrivedAt = new Date();
      break;
    case 'picked_up':
      this.pickupLocation.leftAt = new Date();
      this.actualPickupTime = new Date();
      break;
    case 'at_delivery':
      this.deliveryLocation.arrived = true;
      this.deliveryLocation.arrivedAt = new Date();
      break;
    case 'delivered':
      this.deliveryLocation.deliveredAt = new Date();
      this.actualDeliveryTime = new Date();
      this.isLive = false;
      
      // Calculate final metrics
      if (this.createdAt) {
        this.actualTotalTime = Math.round((this.actualDeliveryTime - this.createdAt) / 60000);
      }
      
      // Determine if delivery was on time
      if (this.estimatedDeliveryTime) {
        this.metrics.onTimeDelivery = this.actualDeliveryTime <= this.estimatedDeliveryTime;
      }
      break;
  }
};

deliveryTrackingSchema.methods.checkArrivalStatus = function() {
  const ARRIVAL_THRESHOLD = 0.2; // 200 meters (changed from 100m)
  let statusChanged = false;
  
  // FIX: Check pickup arrival - ONLY if not already arrived
  if (!this.pickupLocation.arrived && this.currentLocation) {
    // FIX: Verificar que el estado actual permite detección automática
    if (this.status === 'heading_to_pickup' || this.status === 'assigned') {
      const distanceToPickup = this.calculateDistance(
        this.currentLocation.coordinates,
        this.pickupLocation.coordinates
      );
      
      console.log(`🎯 Distancia al pickup: ${distanceToPickup.toFixed(3)}km (umbral: ${ARRIVAL_THRESHOLD}km)`);
      
      if (distanceToPickup <= ARRIVAL_THRESHOLD) {
        console.log('✅ Auto-arrival detected at pickup location');
        this.status = 'at_pickup';
        this.pickupLocation.arrived = true;
        this.pickupLocation.arrivedAt = new Date();
        
        // Add to status history
        this.statusHistory.push({
          status: 'at_pickup',
          timestamp: new Date(),
          location: this.currentLocation.coordinates,
          notes: 'Arrival detected automatically',
          automatic: true
        });
        
        statusChanged = true;
      }
    } else {
      console.log(`⚠️ No auto-detection for pickup - current status: ${this.status}`);
    }
  } else if (this.pickupLocation.arrived) {
    console.log(`✅ Pickup arrival already detected at: ${this.pickupLocation.arrivedAt}`);
  }
  
  // FIX: Check delivery arrival - ONLY if not already arrived and in correct state
  if (!this.deliveryLocation.arrived && this.currentLocation) {
    // FIX: Verificar que el estado actual permite detección automática
    if (this.status === 'heading_to_delivery') {
      const distanceToDelivery = this.calculateDistance(
        this.currentLocation.coordinates,
        this.deliveryLocation.coordinates
      );
      
      console.log(`🏠 Distancia al delivery: ${distanceToDelivery.toFixed(3)}km (umbral: ${ARRIVAL_THRESHOLD}km)`);
      
      if (distanceToDelivery <= ARRIVAL_THRESHOLD) {
        console.log('✅ Auto-arrival detected at delivery location');
        this.status = 'at_delivery';
        this.deliveryLocation.arrived = true;
        this.deliveryLocation.arrivedAt = new Date();
        
        // Add to status history
        this.statusHistory.push({
          status: 'at_delivery',
          timestamp: new Date(),
          location: this.currentLocation.coordinates,
          notes: 'Arrival detected automatically',
          automatic: true
        });
        
        statusChanged = true;
      }
    } else {
      console.log(`⚠️ No auto-detection for delivery - current status: ${this.status}`);
    }
  } else if (this.deliveryLocation.arrived) {
    console.log(`✅ Delivery arrival already detected at: ${this.deliveryLocation.arrivedAt}`);
  }
  
  return statusChanged;
};

deliveryTrackingSchema.methods.updateStatus = function(newStatus, notes = null, location = null, operationId = null) {
  return this.atomicUpdate(async () => {
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
    
    if (!validTransitions[this.status]?.includes(newStatus)) {
      throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
    }
    
    this.status = newStatus;
    
    // Update location if provided (without triggering status change)
    if (location) {
      this.updateLocationOnly(location);
    }
    
    // Add status change to history
    this.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      notes: notes || `Estado actualizado a: ${newStatus}`,
      automatic: false,
      operationId: operationId || `status_${Date.now()}`
    });
    
    // Update timing fields based on status
    this.updateTimingFields(newStatus);
    
    return this;
  }, operationId);
};

deliveryTrackingSchema.methods.completeDelivery = function(deliveryData = {}, operationId = null) {
  return this.atomicUpdate(async () => {
    const { notes, photo, signature } = deliveryData;
    
    if (this.status !== 'at_delivery') {
      throw new Error('Cannot complete delivery unless at delivery location');
    }
    
    this.status = 'delivered';
    this.deliveryNotes = notes;
    this.deliveryPhoto = photo;
    this.customerSignature = signature;
    
    // Add completion to history
    this.statusHistory.push({
      status: 'delivered',
      timestamp: new Date(),
      notes: notes || 'Delivery completed successfully',
      automatic: false,
      operationId: operationId || `complete_${Date.now()}`
    });
    
    // Update timing fields
    this.updateTimingFields('delivered');
    
    return this;
  }, operationId);
};

// Static methods
deliveryTrackingSchema.statics.findActiveDeliveries = function(deliveryPersonId = null) {
  const query = {
    status: { $in: ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'] },
    isLive: true
  };
  
  if (deliveryPersonId) {
    query.deliveryPersonId = deliveryPersonId;
  }
  
  return this.find(query)
    .populate({
      path: 'orderId',
      select: 'orderNumber total customerId merchantId',
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
};

deliveryTrackingSchema.statics.findByOrder = function(orderId) {
  return this.findOne({ orderId })
    .populate('orderId', 'orderNumber total status customerId merchantId')
    .populate('deliveryPersonId', 'name phone email');
};

deliveryTrackingSchema.statics.getDeliveryStats = function(deliveryPersonId, dateRange = {}) {
  const { startDate, endDate } = dateRange;
  const matchQuery = { deliveryPersonId };
  
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
        totalDeliveries: { $sum: 1 },
        completedDeliveries: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        cancelledDeliveries: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        totalDistance: { $sum: '$totalDistance' },
        averageTime: { $avg: '$actualTotalTime' },
        onTimeDeliveries: {
          $sum: { $cond: ['$metrics.onTimeDelivery', 1, 0] }
        }
      }
    },
    {
      $addFields: {
        completionRate: {
          $cond: [
            { $gt: ['$totalDeliveries', 0] },
            { $divide: ['$completedDeliveries', '$totalDeliveries'] },
            0
          ]
        },
        onTimeRate: {
          $cond: [
            { $gt: ['$completedDeliveries', 0] },
            { $divide: ['$onTimeDeliveries', '$completedDeliveries'] },
            0
          ]
        }
      }
    }
  ]);
};

module.exports = mongoose.model('DeliveryTracking', deliveryTrackingSchema);