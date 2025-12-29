const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const merchantController = require('../controllers/merchantController');

const {
  registerMerchant,
  loginMerchant,
  verifyMerchantEmail,
  createMerchantProfile,
  updateMerchantProfile,
  getAllMerchants,
  updateMerchantStatus,
  getMerchantsByCategory,
  getAllMerchantsForAdmin,
  getPublicMerchantProfile,
  updateBusinessLocation,
} = merchantController;

// Registro y autenticación
router.post('/register', registerMerchant);
router.post('/login', loginMerchant);
router.post('/verify-email-register', verifyMerchantEmail);

// Perfil del comerciante
router.post('/profile', verifyToken, createMerchantProfile);
router.put('/profile', verifyToken, updateMerchantProfile);
router.put('/location', verifyToken, updateBusinessLocation);

// Categorías y filtrado
router.get('/category', getMerchantsByCategory); 
router.get('/', getAllMerchants);

// Admin
router.get('/all', getAllMerchantsForAdmin);
router.put('/status/:id', updateMerchantStatus);

// Perfil público para consumidores
router.get('/public/:merchantId', getPublicMerchantProfile);

// GET /api/merchant/stats - Obtener estadísticas del comerciante actual
router.get('/stats', verifyToken, async (req, res) => {
  try {
    console.log('📊 GET /api/merchant/stats - Obteniendo estadísticas del comerciante');
    
    // Verificar que el usuario sea comerciante
    if (req.user.role !== 'merchant' && req.user.role !== 'comerciante') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Solo los comerciantes pueden ver estas estadísticas',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const User = require('../models/User');
    const Order = require('../models/Order');

    // Obtener el usuario comerciante con estadísticas
    const merchant = await User.findById(req.user.id);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Usuario comerciante no encontrado',
          code: 'MERCHANT_NOT_FOUND'
        }
      });
    }

    // Inicializar estadísticas si no existen
    if (!merchant.business.stats) {
      merchant.business.stats = {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        averageRating: 0,
        totalReviews: 0,
        thisWeekOrders: 0,
        thisMonthOrders: 0,
        lastStatsUpdate: new Date()
      };
      await merchant.save();
    }

    // Calcular periodos de tiempo
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
    thisWeek.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // Obtener estadísticas en tiempo real
    const [todayOrders, weekOrders, monthOrders, pendingOrders, revenueToday] = await Promise.all([
      Order.countDocuments({
        merchantId: req.user.id,
        createdAt: { $gte: today }
      }),
      Order.countDocuments({
        merchantId: req.user.id,
        createdAt: { $gte: thisWeek }
      }),
      Order.countDocuments({
        merchantId: req.user.id,
        createdAt: { $gte: thisMonth }
      }),
      Order.countDocuments({
        merchantId: req.user.id,
        status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'at_pickup', 'picked_up'] }
      }),
      Order.aggregate([
        {
          $match: {
            merchantId: merchant._id,
            status: 'delivered',
            deliveredAt: { $gte: today }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' }
          }
        }
      ])
    ]);

    // Calcular tasa de éxito
    const successRate = merchant.business.stats.totalOrders > 0 
      ? ((merchant.business.stats.completedOrders / merchant.business.stats.totalOrders) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        // Estadísticas principales
        totalOrders: merchant.business.stats.totalOrders,
        completedOrders: merchant.business.stats.completedOrders,
        cancelledOrders: merchant.business.stats.cancelledOrders,
        successRate: parseFloat(successRate),
        
        // Ingresos
        totalRevenue: merchant.business.stats.totalRevenue,
        averageOrderValue: merchant.business.stats.averageOrderValue,
        revenueToday: revenueToday[0]?.total || 0,
        
        // Rating y reseñas
        averageRating: merchant.business.stats.averageRating,
        totalReviews: merchant.business.stats.totalReviews,
        
        // Estadísticas por periodo
        todayOrders,
        weekOrders,
        monthOrders,
        thisWeekOrders: merchant.business.stats.thisWeekOrders,
        thisMonthOrders: merchant.business.stats.thisMonthOrders,
        
        // Pedidos pendientes
        pendingOrders,
        
        // Información del negocio
        businessName: merchant.business.businessName,
        category: merchant.business.category,
        lastStatsUpdate: merchant.business.stats.lastStatsUpdate
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas del comerciante:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

module.exports = router;
