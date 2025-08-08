const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders, getOrderById } = require('../controllers/orderController');
const verifyToken = require('../middleware/verifyToken');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// POST /api/orders/create - Crear pedido desde carrito
router.post('/create', createOrder);

// GET /api/orders - Obtener pedidos del usuario
router.get('/', getUserOrders);

// GET /api/orders/:orderId - Obtener detalle de un pedido específico
router.get('/:orderId', getOrderById);

module.exports = router;