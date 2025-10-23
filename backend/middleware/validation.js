const Joi = require('joi');

// Esquemas de validación
const schemas = {
  // Auth schemas
  register: Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede exceder 50 caracteres',
      'any.required': 'El nombre es requerido'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    }),
    password: Joi.string().min(6).max(128).required().messages({
      'string.min': 'La contraseña debe tener al menos 6 caracteres',
      'string.max': 'La contraseña no puede exceder 128 caracteres',
      'any.required': 'La contraseña es requerida'
    }),
    phone: Joi.string().pattern(/^[0-9+\-() ]+$/).allow('').optional().messages({
      'string.pattern.base': 'El teléfono debe contener solo números y caracteres válidos'
    })
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    }),
    password: Joi.string().required().messages({
      'any.required': 'La contraseña es requerida'
    })
  }),

  verifyCode: Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().length(6).required().messages({
      'string.length': 'El código debe tener 6 dígitos',
      'any.required': 'El código es requerido'
    })
  }),

  resetPassword: Joi.object({
    email: Joi.string().email().required(),
    code: Joi.string().length(6).required(),
    newPassword: Joi.string().min(6).max(128).required().messages({
      'string.min': 'La nueva contraseña debe tener al menos 6 caracteres'
    })
  }),

  // Merchant schemas
  merchantRegister: Joi.object({
    businessName: Joi.string().min(2).max(100).required().messages({
      'string.min': 'El nombre del negocio debe tener al menos 2 caracteres',
      'any.required': 'El nombre del negocio es requerido'
    }),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).max(128).required(),
    phone: Joi.string().pattern(/^[0-9+\-() ]+$/).required().messages({
      'any.required': 'El teléfono es requerido para comerciantes'
    }),
    address: Joi.string().min(5).max(200).required().messages({
      'any.required': 'La dirección es requerida'
    }),
    category: Joi.string().required().messages({
      'any.required': 'La categoría es requerida'
    }),
    description: Joi.string().max(500).allow('').optional()
  }),

  // Service schemas
  createService: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).allow('').optional(),
    price: Joi.number().positive().required().messages({
      'number.positive': 'El precio debe ser un número positivo',
      'any.required': 'El precio es requerido'
    }),
    category: Joi.string().required(),
    available: Joi.boolean().default(true),
    preparationTime: Joi.number().positive().optional(),
    image: Joi.string().uri().allow('').optional()
  }),

  updateService: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().max(500).allow('').optional(),
    price: Joi.number().positive().optional(),
    category: Joi.string().optional(),
    available: Joi.boolean().optional(),
    preparationTime: Joi.number().positive().optional(),
    image: Joi.string().uri().allow('').optional()
  }).min(1).messages({
    'object.min': 'Debe proporcionar al menos un campo para actualizar'
  }),

  // Validación de IDs de MongoDB
  mongoId: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
      'string.pattern.base': 'ID inválido',
      'any.required': 'El ID es requerido'
    })
  }),

  // Validación de parámetros de consulta
  queryParams: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('asc', 'desc', 'newest', 'oldest').default('newest'),
    category: Joi.string().optional(),
    search: Joi.string().max(100).optional()
  })
};

// Middleware de validación
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({ error: 'Schema de validación no encontrado' });
    }

    // Determinar qué validar según el tipo de schema
    let dataToValidate;
    if (schemaName === 'mongoId') {
      dataToValidate = req.params;
    } else if (schemaName === 'queryParams') {
      dataToValidate = req.query;
    } else {
      dataToValidate = req.body;
    }

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Mostrar todos los errores
      stripUnknown: true // Eliminar campos no definidos
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Datos inválidos',
        details: errors
      });
    }

    // Reemplazar con datos validados y sanitizados
    if (schemaName === 'queryParams') {
      req.query = value;
    } else if (schemaName === 'mongoId') {
      req.params = value;
    } else {
      req.body = value;
    }

    next();
  };
};

module.exports = {
  validate,
  schemas
};