const mongoose = require('mongoose');

const systemCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '📦'
  },
  image: {
    type: String,
    default: null // URL de la imagen
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  merchantCount: {
    type: Number,
    default: 0 // Contador de comerciantes en esta categoría
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

// Actualizar updatedAt antes de guardar
systemCategorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Método estático para obtener categorías activas
systemCategorySchema.statics.getActiveCategories = function() {
  return this.find({ isActive: true })
    .sort('order name')
    .select('name description icon image merchantCount');
};

module.exports = mongoose.model('SystemCategory', systemCategorySchema);