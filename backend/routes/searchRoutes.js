const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const User = require('../models/User');
const Service = require('../models/Service');


// Esquema de validación para búsqueda
const searchSchema = Joi.object({
  q: Joi.string().min(1).max(100).required().messages({
    'string.min': 'El término de búsqueda debe tener al menos 1 caracter',
    'string.max': 'El término de búsqueda no puede exceder 100 caracteres',
    'any.required': 'El término de búsqueda es requerido'
  }),
  type: Joi.string().valid('all', 'merchants', 'services').default('all'),
  category: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(50).default(20),
  offset: Joi.number().integer().min(0).default(0),
  sortBy: Joi.string().valid('relevance', 'rating', 'distance', 'price').default('relevance'),
  minRating: Joi.number().min(0).max(5).optional(),
  maxPrice: Joi.number().min(0).optional(),
  location: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    radius: Joi.number().min(1).max(50).default(10) // km
  }).optional()
});

// Búsqueda general
const performSearch = async (req, res) => {
  try {
    const { error, value } = searchSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros de búsqueda inválidos',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    const { q, type, category, limit, offset, sortBy, minRating, maxPrice, location } = value;
    
    let results = [];
    let totalResults = 0;

    // Usar índices de texto de MongoDB para búsqueda optimizada
    const textSearchQuery = { $text: { $search: q, $language: 'spanish' } };

    // Búsqueda de comerciantes
    if (type === 'all' || type === 'merchants') {
      const merchantQuery = {
        $and: [
          { merchantStatus: 'aprobado' },
          { role: 'comerciante' },
          textSearchQuery
        ]
      };

      // Filtros adicionales
      if (category) {
        merchantQuery.$and.push({ 'business.category': category });
      }

      if (minRating) {
        merchantQuery.$and.push({ rating: { $gte: minRating } });
      }

      // Filtro geoespacial para comerciantes
      if (location) {
        const { latitude, longitude, radius } = location;
        merchantQuery.$and.push({
          'business.location': {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [longitude, latitude]
              },
              $maxDistance: radius * 1000 // convertir km a metros
            }
          }
        });
      }

      const merchants = await User.find(merchantQuery)
        .select('name business rating totalOrders createdAt')
        .limit(type === 'merchants' ? limit : Math.ceil(limit / 2))
        .skip(offset)
        .sort(getSortOptions(sortBy, 'merchant'));

      // Agregar merchants a resultados
      merchants.forEach(merchant => {
        results.push({
          _id: merchant._id,
          type: 'merchant',
          name: merchant.business?.businessName || merchant.name,
          category: merchant.business?.category,
          description: merchant.business?.description,
          rating: merchant.rating || 0,
          totalOrders: merchant.totalOrders || 0,
          image: merchant.business?.profileImage,
          verified: merchant.business?.verified || false,
          address: merchant.business?.address,
          openHour: merchant.business?.openHour,
          closeHour: merchant.business?.closeHour
        });
      });
    }

    // Búsqueda de servicios
    if (type === 'all' || type === 'services') {
      const serviceQuery = {
        $and: [
          { available: true },
          textSearchQuery
        ]
      };

      // Filtros adicionales
      if (category) {
        serviceQuery.$and.push({ category: category });
      }

      if (maxPrice) {
        serviceQuery.$and.push({ price: { $lte: maxPrice } });
      }

      const services = await Service.find(serviceQuery)
        .populate('merchantId', 'business.businessName business.category rating')
        .select('name description price preparationTime tags category images rating reviewCount')
        .limit(type === 'services' ? limit : Math.ceil(limit / 2))
        .skip(offset)
        .sort(getSortOptions(sortBy, 'service'));

      // Agregar servicios a resultados
      services.forEach(service => {
        if (service.merchantId) {
          results.push({
            _id: service._id,
            type: 'service',
            name: service.name,
            description: service.description,
            price: service.price,
            preparationTime: service.preparationTime,
            category: service.category,
            tags: service.tags,
            rating: service.rating || 0,
            reviewCount: service.reviewCount || 0,
            images: service.images,
            merchantId: service.merchantId._id,
            merchantName: service.merchantId.business?.businessName,
            merchantCategory: service.merchantId.business?.category,
            merchantRating: service.merchantId.rating || 0
          });
        }
      });
    }

    // Ordenar resultados finales si es búsqueda mixta
    if (type === 'all') {
      results = sortMixedResults(results, sortBy);
    }

    // Aplicar limite final
    results = results.slice(0, limit);
    totalResults = results.length;

    res.json({
      success: true,
      query: q,
      type: type,
      results: results,
      totalResults: totalResults,
      hasMore: totalResults === limit,
      filters: {
        category,
        minRating,
        maxPrice,
        sortBy
      }
    });

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Sugerencias de búsqueda
const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    const searchRegex = new RegExp(q, 'i');
    
    // Buscar sugerencias en comerciantes
    const merchantSuggestions = await User.find({
      merchantStatus: 'aprobado',
      $or: [
        { 'business.businessName': searchRegex },
        { 'business.category': searchRegex }
      ]
    })
    .select('business.businessName business.category')
    .limit(5);

    // Buscar sugerencias en servicios
    const serviceSuggestions = await Service.find({
      available: true,
      $or: [
        { name: searchRegex },
        { tags: { $in: [searchRegex] } }
      ]
    })
    .select('name category tags')
    .limit(5);

    const suggestions = [];

    // Agregar sugerencias de comerciantes
    merchantSuggestions.forEach(merchant => {
      if (merchant.business?.businessName) {
        suggestions.push({
          text: merchant.business.businessName,
          type: 'merchant',
          category: merchant.business.category
        });
      }
    });

    // Agregar sugerencias de servicios
    serviceSuggestions.forEach(service => {
      suggestions.push({
        text: service.name,
        type: 'service',
        category: service.category
      });
      
      // Agregar tags como sugerencias
      if (service.tags) {
        service.tags.forEach(tag => {
          if (tag.toLowerCase().includes(q.toLowerCase())) {
            suggestions.push({
              text: tag,
              type: 'tag',
              category: service.category
            });
          }
        });
      }
    });

    // Remover duplicados y limitar
    const uniqueSuggestions = suggestions
      .filter((item, index, arr) => 
        arr.findIndex(t => t.text.toLowerCase() === item.text.toLowerCase()) === index
      )
      .slice(0, 8);

    res.json({
      success: true,
      query: q,
      suggestions: uniqueSuggestions
    });

  } catch (error) {
    console.error('Error obteniendo sugerencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Comerciantes destacados
const getFeaturedMerchants = async (req, res) => {
  try {
    const merchants = await User.find({
      merchantStatus: 'aprobado',
      $or: [
        { rating: { $gte: 4.0 } },
        { totalOrders: { $gte: 10 } },
        { 'business.featured': true }
      ]
    })
    .select('business rating totalOrders createdAt')
    .sort({ rating: -1, totalOrders: -1 })
    .limit(10);

    res.json({
      success: true,
      merchants: merchants.filter(m => m.business).map(merchant => ({
        _id: merchant._id,
        businessName: merchant.business.businessName,
        category: merchant.business.category,
        rating: merchant.rating || 0,
        totalOrders: merchant.totalOrders || 0,
        image: merchant.business.profileImage,
        verified: merchant.business.verified || false,
        business: merchant.business
      }))
    });

  } catch (error) {
    console.error('Error obteniendo comerciantes destacados:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

// Funciones auxiliares
const getSortOptions = (sortBy, type) => {
  const sortOptions = {
    relevance: type === 'merchant' 
      ? { rating: -1, totalOrders: -1, createdAt: -1 }
      : { rating: -1, reviewCount: -1, createdAt: -1 },
    rating: { rating: -1 },
    distance: { createdAt: -1 }, // Placeholder - implementar geolocalización
    price: type === 'service' ? { price: 1 } : { createdAt: -1 }
  };
  
  return sortOptions[sortBy] || sortOptions.relevance;
};

const sortMixedResults = (results, sortBy) => {
  switch (sortBy) {
    case 'rating':
      return results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'price':
      return results.sort((a, b) => {
        const aPrice = a.price || (a.type === 'merchant' ? 0 : Infinity);
        const bPrice = b.price || (b.type === 'merchant' ? 0 : Infinity);
        return aPrice - bPrice;
      });
    case 'relevance':
    default:
      return results.sort((a, b) => {
        const aScore = (a.rating || 0) * 0.6 + ((a.totalOrders || a.reviewCount || 0) * 0.4);
        const bScore = (b.rating || 0) * 0.6 + ((b.totalOrders || b.reviewCount || 0) * 0.4);
        return bScore - aScore;
      });
  }
};

// Rutas
router.get('/', performSearch);
router.get('/suggestions', getSearchSuggestions);
router.get('/featured', getFeaturedMerchants);

module.exports = router;