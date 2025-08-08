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

module.exports = mongoose.model('User', UserSchema);
