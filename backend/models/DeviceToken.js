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
    userId: new mongoose.Types.ObjectId(userId),
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

// Método estático para registrar o actualizar token (evita duplicados)
DeviceTokenSchema.statics.upsertToken = async function(userId, deviceToken, platform, deviceInfo = {}) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Primero, desactivar cualquier token existente para este dispositivo
      await this.updateMany(
        { deviceToken: deviceToken },
        { 
          $set: { 
            isActive: false, 
            unregisteredAt: new Date() 
          } 
        }
      );

      // Crear o actualizar token para el usuario actual
      const result = await this.findOneAndUpdate(
        { 
          userId: new mongoose.Types.ObjectId(userId),
          deviceToken: deviceToken 
        },
        {
          $set: {
            platform: platform,
            deviceInfo: deviceInfo,
            isActive: true,
            lastUpdated: new Date()
          },
          $unset: { unregisteredAt: 1 }
        },
        { 
          upsert: true, 
          new: true,
          runValidators: true
        }
      );

      return result;
      
    } catch (error) {
      attempt++;
      
      // Si es error E11000 y no es el último intento, reintentar
      if (error.code === 11000 && attempt < maxRetries) {
        console.log(`⚠️ E11000 en intento ${attempt}, reintentando... (${deviceToken.substring(0, 15)}...)`);
        
        // Pequeña pausa antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      
      // Si es E11000 en el último intento, buscar el token existente
      if (error.code === 11000) {
        console.log(`🔄 E11000 persistente, buscando token existente... (${deviceToken.substring(0, 15)}...)`);
        
        try {
          // Buscar el token existente y actualizarlo
          const existingToken = await this.findOneAndUpdate(
            { deviceToken: deviceToken },
            {
              $set: {
                userId: new mongoose.Types.ObjectId(userId),
                platform: platform,
                deviceInfo: deviceInfo,
                isActive: true,
                lastUpdated: new Date()
              },
              $unset: { unregisteredAt: 1 }
            },
            { 
              new: true,
              runValidators: true
            }
          );
          
          if (existingToken) {
            console.log(`✅ Token existente actualizado exitosamente (${deviceToken.substring(0, 15)}...)`);
            return existingToken;
          }
        } catch (updateError) {
          console.error('❌ Error actualizando token existente:', updateError);
        }
      }
      
      console.error(`❌ Error en upsertToken (intento ${attempt}/${maxRetries}):`, error);
      throw error;
    }
  }
  
  throw new Error(`upsertToken falló después de ${maxRetries} intentos`);
};

module.exports = mongoose.model('DeviceToken', DeviceTokenSchema);