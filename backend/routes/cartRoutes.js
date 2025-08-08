const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validation');
const verifyToken = require('../middleware/verifyToken');

const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartSummary
} = require('../controllers/cartController');

// Esquemas de validación específicos para carrito
const Joi = require('joi');

const addToCartSchema = Joi.object({
  serviceId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'ID de servicio inválido',
    'any.required': 'El ID del servicio es requerido'
  }),
  quantity: Joi.number().integer().min(1).max(10).default(1).messages({
    'number.min': 'La cantidad mínima es 1',
    'number.max': 'La cantidad máxima es 10 por item'
  })
});

const updateQuantitySchema = Joi.object({
  quantity: Joi.number().integer().min(0).max(10).required().messages({
    'number.min': 'La cantidad no puede ser negativa',
    'number.max': 'La cantidad máxima es 10 por item',
    'any.required': 'La cantidad es requerida'
  })
});

const itemIdSchema = Joi.object({
  itemId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'ID de item inválido',
    'any.required': 'El ID del item es requerido'
  })
});

// Middleware de validación personalizado
const validateAddToCart = (req, res, next) => {
  const { error, value } = addToCartSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  req.body = value;
  next();
};

const validateUpdateQuantity = (req, res, next) => {
  const { error, value } = updateQuantitySchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  req.body = value;
  next();
};

const validateItemId = (req, res, next) => {
  const { error, value } = itemIdSchema.validate(req.params);
  if (error) {
    return res.status(400).json({
      error: 'ID inválido',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  req.params = value;
  next();
};

// RUTAS DEL CARRITO (todas requieren autenticación)

// GET /api/cart - Obtener carrito del usuario
router.get('/', verifyToken, getCart);

// POST /api/cart/add - Agregar item al carrito
router.post('/add', verifyToken, validateAddToCart, addToCart);

// PUT /api/cart/item/:itemId - Actualizar cantidad de item
router.put('/item/:itemId', verifyToken, validateItemId, validateUpdateQuantity, updateCartItem);

// DELETE /api/cart/item/:itemId - Remover item del carrito
router.delete('/item/:itemId', verifyToken, validateItemId, removeFromCart);

// DELETE /api/cart - Limpiar carrito completo
router.delete('/', verifyToken, clearCart);

// GET /api/cart/summary - Obtener resumen para checkout
router.get('/summary', verifyToken, getCartSummary);

module.exports = router;