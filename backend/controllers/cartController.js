const Cart = require('../models/Cart');
const Service = require('../models/Service');
const User = require('../models/User');

// Obtener carrito del usuario
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id })
      .populate('items.serviceId', 'name price available')
      .populate('items.merchantId', 'name business');
    
    if (!cart) {
      return res.json({
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        total: 0
      });
    }
    
    // Filtrar items de servicios no disponibles
    const availableItems = cart.items.filter(item => 
      item.serviceId && item.serviceId.available
    );
    
    if (availableItems.length !== cart.items.length) {
      cart.items = availableItems;
      await cart.save();
    }
    
    res.json(cart);
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    res.status(500).json({ error: 'Error al obtener el carrito' });
  }
};

// Agregar item al carrito
exports.addToCart = async (req, res) => {
  try {
    const { serviceId, quantity = 1 } = req.body;
    
    // Verificar que el servicio existe y está disponible
    const service = await Service.findById(serviceId).populate('merchantId', 'name business');
    if (!service) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    
    if (!service.available) {
      return res.status(400).json({ error: 'Servicio no disponible' });
    }
    
    // Buscar o crear carrito
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      cart = new Cart({ userId: req.user.id, items: [] });
    }
    
    // Verificar si ya existe un item del mismo comerciante
    const existingMerchantItems = cart.items.filter(item => 
      item.merchantId.toString() === service.merchantId._id.toString()
    );
    
    // Si hay items de otro comerciante, limpiar carrito (MVP: un comerciante por pedido)
    const differentMerchantItems = cart.items.filter(item => 
      item.merchantId.toString() !== service.merchantId._id.toString()
    );
    
    if (differentMerchantItems.length > 0) {
      cart.items = existingMerchantItems; // Mantener solo items del mismo comerciante
    }
    
    // Preparar datos del servicio
    const serviceData = {
      serviceId: service._id,
      merchantId: service.merchantId._id,
      price: service.price,
      serviceName: service.name,
      serviceDescription: service.description,
      merchantName: service.merchantId.business?.businessName || service.merchantId.name
    };
    
    await cart.addItem(serviceData, quantity);
    
    // Repoblar para respuesta
    await cart.populate('items.serviceId', 'name price available');
    await cart.populate('items.merchantId', 'name business');
    
    res.json({
      message: 'Item agregado al carrito',
      cart: cart
    });
    
  } catch (error) {
    console.error('Error al agregar al carrito:', error);
    res.status(500).json({ error: 'Error al agregar item al carrito' });
  }
};

// Actualizar cantidad de item
exports.updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    
    if (quantity < 0) {
      return res.status(400).json({ error: 'La cantidad no puede ser negativa' });
    }
    
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }
    
    await cart.updateItemQuantity(itemId, quantity);
    
    // Repoblar para respuesta
    await cart.populate('items.serviceId', 'name price available');
    await cart.populate('items.merchantId', 'name business');
    
    res.json({
      message: quantity === 0 ? 'Item removido del carrito' : 'Cantidad actualizada',
      cart: cart
    });
    
  } catch (error) {
    console.error('Error al actualizar item:', error);
    if (error.message === 'Item no encontrado en el carrito') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al actualizar item del carrito' });
  }
};

// Remover item del carrito
exports.removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }
    
    await cart.removeItem(itemId);
    
    // Repoblar para respuesta
    await cart.populate('items.serviceId', 'name price available');
    await cart.populate('items.merchantId', 'name business');
    
    res.json({
      message: 'Item removido del carrito',
      cart: cart
    });
    
  } catch (error) {
    console.error('Error al remover item:', error);
    res.status(500).json({ error: 'Error al remover item del carrito' });
  }
};

// Limpiar carrito completo
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.json({ message: 'Carrito ya está vacío' });
    }
    
    await cart.clear();
    
    res.json({
      message: 'Carrito limpiado',
      cart: {
        items: [],
        subtotal: 0,
        deliveryFee: 0,
        total: 0
      }
    });
    
  } catch (error) {
    console.error('Error al limpiar carrito:', error);
    res.status(500).json({ error: 'Error al limpiar el carrito' });
  }
};

// Obtener resumen del carrito (para checkout)
exports.getCartSummary = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id })
      .populate('items.serviceId', 'name price available preparationTime')
      .populate('items.merchantId', 'name business phone');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Carrito vacío' });
    }
    
    // Verificar disponibilidad de todos los items
    const unavailableItems = cart.items.filter(item => 
      !item.serviceId || !item.serviceId.available
    );
    
    if (unavailableItems.length > 0) {
      return res.status(400).json({ 
        error: 'Algunos items ya no están disponibles',
        unavailableItems: unavailableItems.map(item => item.serviceName)
      });
    }
    
    // Calcular tiempo de preparación estimado
    const maxPreparationTime = Math.max(
      ...cart.items.map(item => item.serviceId.preparationTime || 30)
    );
    
    const merchant = cart.items[0].merchantId; // Todos los items son del mismo comerciante
    
    const summary = {
      merchant: {
        id: merchant._id,
        name: merchant.business?.businessName || merchant.name,
        address: merchant.business?.address,
        phone: merchant.business?.phone || merchant.phone
      },
      items: cart.items.map(item => ({
        id: item._id,
        serviceId: item.serviceId._id,
        serviceName: item.serviceName,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity
      })),
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      total: cart.total,
      estimatedPreparationTime: maxPreparationTime
    };
    
    res.json(summary);
    
  } catch (error) {
    console.error('Error al obtener resumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen del carrito' });
  }
};