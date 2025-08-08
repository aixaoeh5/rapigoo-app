const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  category: {
    type: String,
    required: true,
  },
  images: [{
    type: String,
  }],
  available: {
    type: Boolean,
    default: true,
  },
  preparationTime: {
    type: Number,
    default: 20, // minutos
  },
  tags: [{
    type: String,
  }],
  options: [{
    name: String,
    price: Number,
  }],
  isSpecial: {
    type: Boolean,
    default: false,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  ageRestricted: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Mantener compatibilidad con código antiguo
serviceSchema.virtual('title').get(function() {
  return this.name;
});

serviceSchema.virtual('image').get(function() {
  return this.images && this.images.length > 0 ? this.images[0] : null;
});

module.exports = mongoose.model('Service', serviceSchema);
