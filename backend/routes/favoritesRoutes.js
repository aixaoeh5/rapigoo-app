const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const User = require('../models/User');
const Service = require('../models/Service');

// Esquemas de validación
const addFavoriteSchema = Joi.object({
  merchantId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
  serviceId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/)
}).xor('merchantId', 'serviceId').messages({
  'object.xor': 'Debe proporcionar merchantId o serviceId, pero no ambos'
});

// Obtener todos los favoritos del usuario
const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate({
        path: 'favorites.merchants',
        select: 'business rating totalOrders createdAt',
        match: { merchantStatus: 'aprobado' }
      })
      .populate({
        path: 'favorites.services',
        select: 'name description price category images rating reviewCount preparationTime',
        populate: {
          path: 'merchantId',
          select: 'business.businessName business.category'
        }
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Filtrar comerciantes y servicios válidos
    const validMerchants = (user.favorites?.merchants || []).filter(merchant => 
      merchant && merchant.business
    );

    const validServices = (user.favorites?.services || []).filter(service => 
      service && service.merchantId
    );

    // Formatear respuesta
    const merchants = validMerchants.map(merchant => ({
      _id: merchant._id,
      businessName: merchant.business.businessName,
      category: merchant.business.category,
      description: merchant.business.description,
      rating: merchant.rating || 0,
      totalOrders: merchant.totalOrders || 0,
      image: merchant.business.profileImage,
      verified: merchant.business.verified || false,
      business: merchant.business,
      addedAt: user.favorites?.merchantsAddedAt?.find(item => 
        item.merchantId.toString() === merchant._id.toString()
      )?.addedAt || merchant.createdAt
    }));

    const services = validServices.map(service => ({
      _id: service._id,
      name: service.name,
      description: service.description,
      price: service.price,
      category: service.category,
      images: service.images,
      rating: service.rating || 0,
      reviewCount: service.reviewCount || 0,
      preparationTime: service.preparationTime,
      merchantId: service.merchantId._id,
      merchantName: service.merchantId.business?.businessName,
      merchantCategory: service.merchantId.business?.category,
      addedAt: user.favorites?.servicesAddedAt?.find(item => 
        item.serviceId.toString() === service._id.toString()
      )?.addedAt || service.createdAt
    }));

    res.json({
      success: true,
      merchants,
      services,
      stats: {
        totalMerchants: merchants.length,
        totalServices: services.length,
        total: merchants.length + services.length
      }
    });

  } catch (error) {
    console.error('Error obteniendo favoritos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Agregar comerciante a favoritos
const addMerchantToFavorites = async (req, res) => {
  try {
    const { error, value } = addFavoriteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const userId = req.user.id;
    const { merchantId } = value;

    // Verificar que el comerciante existe y está aprobado
    const merchant = await User.findOne({
      _id: merchantId,
      userType: 'merchant',
      merchantStatus: 'aprobado'
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        error: 'Comerciante no encontrado o no disponible'
      });
    }

    // Verificar que no esté ya en favoritos
    const user = await User.findById(userId);
    if (user.favorites?.merchants?.includes(merchantId)) {
      return res.status(400).json({
        success: false,
        error: 'El comerciante ya está en favoritos'
      });
    }

    // Agregar a favoritos
    const updateResult = await User.updateOne(
      { _id: userId },
      { 
        $addToSet: { 
          'favorites.merchants': merchantId,
          'favorites.merchantsAddedAt': {
            merchantId: merchantId,
            addedAt: new Date()
          }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo agregar a favoritos'
      });
    }

    res.json({
      success: true,
      message: 'Comerciante agregado a favoritos',
      merchantId
    });

  } catch (error) {
    console.error('Error agregando comerciante a favoritos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Remover comerciante de favoritos
const removeMerchantFromFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { merchantId } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(merchantId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de comerciante inválido'
      });
    }

    const updateResult = await User.updateOne(
      { _id: userId },
      { 
        $pull: { 
          'favorites.merchants': merchantId,
          'favorites.merchantsAddedAt': { merchantId: merchantId }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'El comerciante no estaba en favoritos'
      });
    }

    res.json({
      success: true,
      message: 'Comerciante removido de favoritos',
      merchantId
    });

  } catch (error) {
    console.error('Error removiendo comerciante de favoritos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Agregar servicio a favoritos
const addServiceToFavorites = async (req, res) => {
  try {
    const { error, value } = addFavoriteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const userId = req.user.id;
    const { serviceId } = value;

    // Verificar que el servicio existe y está disponible
    const service = await Service.findOne({
      _id: serviceId,
      available: true
    }).populate('merchantId', 'merchantStatus');

    if (!service || service.merchantId?.merchantStatus !== 'aprobado') {
      return res.status(404).json({
        success: false,
        error: 'Servicio no encontrado o no disponible'
      });
    }

    // Verificar que no esté ya en favoritos
    const user = await User.findById(userId);
    if (user.favorites?.services?.includes(serviceId)) {
      return res.status(400).json({
        success: false,
        error: 'El servicio ya está en favoritos'
      });
    }

    // Agregar a favoritos
    const updateResult = await User.updateOne(
      { _id: userId },
      { 
        $addToSet: { 
          'favorites.services': serviceId,
          'favorites.servicesAddedAt': {
            serviceId: serviceId,
            addedAt: new Date()
          }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo agregar a favoritos'
      });
    }

    res.json({
      success: true,
      message: 'Servicio agregado a favoritos',
      serviceId
    });

  } catch (error) {
    console.error('Error agregando servicio a favoritos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Remover servicio de favoritos
const removeServiceFromFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const { serviceId } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(serviceId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de servicio inválido'
      });
    }

    const updateResult = await User.updateOne(
      { _id: userId },
      { 
        $pull: { 
          'favorites.services': serviceId,
          'favorites.servicesAddedAt': { serviceId: serviceId }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'El servicio no estaba en favoritos'
      });
    }

    res.json({
      success: true,
      message: 'Servicio removido de favoritos',
      serviceId
    });

  } catch (error) {
    console.error('Error removiendo servicio de favoritos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Limpiar todos los favoritos
const clearAllFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    const updateResult = await User.updateOne(
      { _id: userId },
      { 
        $unset: { 
          'favorites.merchants': 1,
          'favorites.services': 1,
          'favorites.merchantsAddedAt': 1,
          'favorites.servicesAddedAt': 1
        }
      }
    );

    res.json({
      success: true,
      message: 'Todos los favoritos han sido eliminados',
      cleared: updateResult.modifiedCount > 0
    });

  } catch (error) {
    console.error('Error limpiando favoritos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Verificar si un elemento está en favoritos
const checkFavoriteStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { merchantId, serviceId } = req.query;

    if (!merchantId && !serviceId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere merchantId o serviceId'
      });
    }

    const user = await User.findById(userId).select('favorites');
    
    const response = {
      success: true
    };

    if (merchantId) {
      response.isMerchantFavorite = user.favorites?.merchants?.includes(merchantId) || false;
    }

    if (serviceId) {
      response.isServiceFavorite = user.favorites?.services?.includes(serviceId) || false;
    }

    res.json(response);

  } catch (error) {
    console.error('Error verificando estado de favoritos:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Rutas
router.get('/', verifyToken, getFavorites);
router.post('/merchant', verifyToken, addMerchantToFavorites);
router.delete('/merchant/:merchantId', verifyToken, removeMerchantFromFavorites);
router.post('/service', verifyToken, addServiceToFavorites);
router.delete('/service/:serviceId', verifyToken, removeServiceFromFavorites);
router.delete('/all', verifyToken, clearAllFavorites);
router.get('/check', verifyToken, checkFavoriteStatus);

module.exports = router;