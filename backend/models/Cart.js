const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  // Snapshot del servicio al momento de agregarlo al carrito
  serviceName: {
    type: String,
    required: true
  },
  serviceDescription: String,
  merchantName: {
    type: String,
    required: true
  }
}, {
  _id: true
});

const CartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Un carrito por usuario
  },
  items: [CartItemSchema],
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Middleware para calcular totales automáticamente
CartSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.total = this.subtotal + this.deliveryFee;
  this.lastUpdated = new Date();
  next();
});

// Método para agregar item al carrito
CartSchema.methods.addItem = function(serviceData, quantity = 1) {
  const existingItem = this.items.find(item => 
    item.serviceId.toString() === serviceData.serviceId.toString()
  );
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({
      serviceId: serviceData.serviceId,
      merchantId: serviceData.merchantId,
      quantity: quantity,
      price: serviceData.price,
      serviceName: serviceData.serviceName,
      serviceDescription: serviceData.serviceDescription,
      merchantName: serviceData.merchantName
    });
  }
  
  return this.save();
};

// Método para actualizar cantidad de item
CartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.id(itemId);
  if (item) {
    if (quantity <= 0) {
      this.items.pull(itemId);
    } else {
      item.quantity = quantity;
    }
    return this.save();
  }
  throw new Error('Item no encontrado en el carrito');
};

// Método para remover item
CartSchema.methods.removeItem = function(itemId) {
  this.items.pull(itemId);
  return this.save();
};

// Método para limpiar carrito con soporte para transacciones
CartSchema.methods.clear = function(options = {}) {
  this.items = [];
  return this.save(options);
};

// Índices para optimización
CartSchema.index({ userId: 1 });
CartSchema.index({ lastUpdated: 1 });

module.exports = mongoose.model('Cart', CartSchema);