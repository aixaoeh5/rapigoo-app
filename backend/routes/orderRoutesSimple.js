const express = require('express');
const router = express.Router();
const { createOrder, getUserOrders, getOrderById, getMerchantOrders, updateOrderStatus } = require('../controllers/orderController');
const verifyToken = require('../middleware/verifyToken');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// POST /api/orders/create - Crear pedido desde carrito  
router.post('/create', createOrder);

// POST /api/orders/checkout - Crear pedido desde carrito (alias para compatibilidad)
router.post('/checkout', createOrder);

// GET /api/orders/merchant/list - Obtener pedidos del comerciante (DEBE ir antes de /:orderId)
router.get('/merchant/list', getMerchantOrders);

// GET /api/orders - Obtener pedidos del usuario
router.get('/', getUserOrders);

// PUT /api/orders/:orderId/status - Actualizar estado del pedido (comerciante)
router.put('/:orderId/status', updateOrderStatus);

// GET /api/orders/:orderId - Obtener detalle de un pedido específico (DEBE ir al final)
router.get('/:orderId', getOrderById);

module.exports = router;