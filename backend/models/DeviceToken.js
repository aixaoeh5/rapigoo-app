const mongoose = require('mongoose');

const DeviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android'],
    required: true
  },
  deviceInfo: {
    model: {
      type: String,
      default: 'Unknown'
    },
    version: {
      type: String,
      default: 'Unknown'
    },
    appVersion: {
      type: String,
      default: '1.0.0'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  unregisteredAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Índices compuestos para optimización
DeviceTokenSchema.index({ userId: 1, platform: 1 });
DeviceTokenSchema.index({ isActive: 1, platform: 1 });
DeviceTokenSchema.index({ createdAt: -1 });

// Middleware para actualizar lastUpdated
DeviceTokenSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.lastUpdated = new Date();
  }
  next();
});

// Método para desactivar token
DeviceTokenSchema.methods.deactivate = function() {
  this.isActive = false;
  this.unregisteredAt = new Date();
  return this.save();
};

// Método estático para limpiar tokens antiguos
DeviceTokenSchema.statics.cleanupOldTokens = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    $or: [
      { isActive: false, unregisteredAt: { $lt: cutoffDate } },
      { lastUpdated: { $lt: cutoffDate }, isActive: false }
    ]
  });
  
  return result.deletedCount;
};

// Método estático para obtener tokens activos por usuario
DeviceTokenSchema.statics.getActiveTokensByUser = async function(userId, platform = null) {
  const query = {
    userId: mongoose.Types.ObjectId(userId),
    isActive: true
  };
  
  if (platform) {
    query.platform = platform;
  }
  
  return this.find(query).select('deviceToken platform');
};

// Método estático para obtener estadísticas
DeviceTokenSchema.statics.getStats = async function() {
  const pipeline = [
    {
      $group: {
        _id: {
          platform: '$platform',
          isActive: '$isActive'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.platform',
        active: {
          $sum: {
            $cond: [{ $eq: ['$_id.isActive', true] }, '$count', 0]
          }
        },
        inactive: {
          $sum: {
            $cond: [{ $eq: ['$_id.isActive', false] }, '$count', 0]
          }
        },
        total: { $sum: '$count' }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('DeviceToken', DeviceTokenSchema);