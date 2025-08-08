const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '📦' // Emoji por defecto
  },
  order: {
    type: Number,
    default: 0 // Para ordenar las categorías
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índice compuesto para asegurar nombres únicos por comerciante
categorySchema.index({ merchantId: 1, name: 1 }, { unique: true });

// Actualizar updatedAt antes de guardar
categorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Category', categorySchema);