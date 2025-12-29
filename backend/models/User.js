const mongoose = require('mongoose');

// Sub-esquema para el horario
const scheduleSchema = new mongoose.Schema({
  opening: { type: String, default: '' },
  closing: { type: String, default: '' },
}, { _id: false });

// Sub-esquema para datos del negocio
const businessSchema = new mongoose.Schema({
  businessName: { type: String, default: '' },
  rnc: { type: String, default: '' },
  category: { type: String, default: '' },
  address: { type: String, default: '' },
  description: { type: String, default: '' },
  phone: { type: String, default: '' },
  socials: { type: String, default: '' }, 
  schedule: scheduleSchema,
  // Ubicación del negocio para pickup de delivery
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: null,
      validate: {
        validator: function(coords) {
          // Permitir null o array válido de coordenadas
          if (!coords || coords === null) return true;
          if (!Array.isArray(coords) || coords.length !== 2) return false;
          return coords[0] >= -180 && coords[0] <= 180 && coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Las coordenadas deben ser [longitude, latitude] válidas'
      }
    }
  },
  // Dirección detallada para mostrar al delivery
  pickupAddress: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    landmarks: { type: String, default: '' }, // Referencias como "frente al banco"
    instructions: { type: String, default: '' } // Instrucciones específicas para el delivery
  },
  // Estadísticas del negocio
  stats: {
    totalOrders: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    cancelledOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    thisWeekOrders: { type: Number, default: 0 },
    thisMonthOrders: { type: Number, default: 0 },
    lastStatsUpdate: { type: Date, default: Date.now }
  }
}, { _id: false });

// Sub-esquema para datos del delivery
const deliverySchema = new mongoose.Schema({
  vehicleType: {
    type: String,
    enum: ['motocicleta', 'bicicleta', 'carro', 'caminando'],
    default: 'motocicleta'
  },
  vehicleModel: { type: String, default: '' },
  licensePlate: { type: String, default: '' },
  licenseNumber: { type: String, default: '' },
  licenseExpiry: { type: Date },
  isAvailable: { type: Boolean, default: true },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  workZone: {
    center: {
      type: [Number], // [longitude, latitude] 
      default: [-69.9312, 18.4861] // Santo Domingo por defecto
    },
    radius: {
      type: Number, // en kilómetros
      default: 15
    }
  },
  deliveryStats: {
    totalDeliveries: { type: Number, default: 0 },
    completedDeliveries: { type: Number, default: 0 },
    cancelledDeliveries: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalEarnings: { type: Number, default: 0 }
  }
}, { _id: false });

// Esquema principal del usuario
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  role: {
    type: String,
    enum: ['cliente', 'comerciante', 'admin', 'delivery'],
    default: 'cliente',
  },
  phone: {
    type: String,
    default: '',
  },
  avatar: {
    type: String,
    default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  },
  verificationCode: String,
  verificationCodeExpires: Date,
  isVerified: {
    type: Boolean,
    default: false,
  },

  // SOLO PARA COMERCIANTES
  merchantStatus: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado'],
    default: 'pendiente',
  },
  business: businessSchema,

  // SOLO PARA CLIENTES - Dirección de entrega
  deliveryAddress: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: null
    },
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    landmarks: { type: String, default: '' },
    instructions: { type: String, default: '' }
  },

  // SOLO PARA DELIVERY
  deliveryStatus: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado', 'suspendido'],
    default: 'pendiente',
  },
  delivery: deliverySchema,

  // FAVORITOS (todos los usuarios)
  favorites: {
    merchants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    services: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service'
    }],
    merchantsAddedAt: [{
      merchantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }],
    servicesAddedAt: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
      },
      addedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // MÉTRICAS ADICIONALES
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  lastLoginAt: {
    type: Date
  },

  // PREFERENCIAS DE NOTIFICACIONES
  notificationPreferences: {
    orderUpdates: {
      type: Boolean,
      default: true
    },
    promotions: {
      type: Boolean,
      default: true
    },
    newMerchants: {
      type: Boolean,
      default: true
    },
    sound: {
      type: Boolean,
      default: true
    },
    vibrate: {
      type: Boolean,
      default: true
    },
    quiet_hours: {
      enabled: {
        type: Boolean,
        default: false
      },
      start: {
        type: String,
        default: '22:00'
      },
      end: {
        type: String,
        default: '07:00'
      }
    }
  },
}, {
  timestamps: true,
});

// Índices geoespaciales para ubicaciones
UserSchema.index({ 'business.location': '2dsphere' });
UserSchema.index({ 'delivery.currentLocation': '2dsphere' });

module.exports = mongoose.model('User', UserSchema);
