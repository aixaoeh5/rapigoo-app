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
    enum: ['cliente', 'comerciante', 'admin'],
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
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', UserSchema);
