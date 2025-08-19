const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// Esquemas de validación
const extractAddressSchema = Joi.object({
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }).required(),
  country: Joi.string().default('República Dominicana'),
  city: Joi.string().default('Santo Domingo')
});

const enhanceAddressSchema = Joi.object({
  existingAddress: Joi.object().required(),
  coordinates: Joi.array().items(Joi.number()).length(2).required(),
  country: Joi.string().default('República Dominicana')
});

const validateAddressSchema = Joi.object({
  address: Joi.object().required(),
  country: Joi.string().default('República Dominicana')
});

const nearbyLandmarksSchema = Joi.object({
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }).required(),
  radius: Joi.number().min(100).max(2000).default(500),
  country: Joi.string().default('República Dominicana')
});

const addressSuggestionsSchema = Joi.object({
  partialAddress: Joi.string().min(2).required(),
  coordinates: Joi.array().items(Joi.number()).length(2).optional(),
  country: Joi.string().default('República Dominicana'),
  maxSuggestions: Joi.number().min(1).max(10).default(5)
});

// Función simulada de GPT (reemplazar con llamada real a OpenAI)
async function callGPTService(prompt, systemMessage = '') {
  try {
    // NOTA: Aquí deberías integrar con OpenAI API
    // const response = await openai.chat.completions.create({
    //   model: "gpt-3.5-turbo",
    //   messages: [
    //     { role: "system", content: systemMessage },
    //     { role: "user", content: prompt }
    //   ],
    //   temperature: 0.3
    // });
    // return response.choices[0].message.content;

    // Por ahora, simular respuesta inteligente basada en coordenadas
    console.log('🤖 Simulando llamada a GPT:', { prompt: prompt.substring(0, 100) });
    
    return await simulateIntelligentResponse(prompt);
    
  } catch (error) {
    console.error('❌ Error en GPT service:', error);
    throw error;
  }
}

// Función para simular respuestas inteligentes
async function simulateIntelligentResponse(prompt) {
  // Extraer coordenadas del prompt
  const latMatch = prompt.match(/latitude[:\s]+(-?\d+\.?\d*)/i);
  const lngMatch = prompt.match(/longitude[:\s]+(-?\d+\.?\d*)/i);
  
  if (latMatch && lngMatch) {
    const lat = parseFloat(latMatch[1]);
    const lng = parseFloat(lngMatch[1]);
    
    // Generar dirección realista para Santo Domingo
    const streets = [
      'Av. Winston Churchill', 'Av. 27 de Febrero', 'Av. John F. Kennedy',
      'Calle El Conde', 'Av. George Washington', 'Calle Mercedes',
      'Av. Máximo Gómez', 'Calle José Reyes', 'Av. Bolívar',
      'Calle Padre Billini', 'Av. Tiradentes', 'Calle Santomé'
    ];
    
    const neighborhoods = [
      'Piantini', 'Naco', 'Bella Vista', 'Gazcue', 'La Esperilla',
      'Los Cacicazgos', 'Serrallés', 'Mirador Sur', 'Los Prados',
      'Arroyo Hondo', 'La Julia', 'Evaristo Morales'
    ];
    
    const landmarks = [
      'Centro Comercial Blue Mall', 'Malecón de Santo Domingo',
      'Zona Colonial', 'Hospital General Plaza', 'Universidad APEC',
      'Parque Mirador Sur', 'Centro Comercial Agora Mall',
      'Palacio Nacional', 'Catedral Primada', 'Alcázar de Colón'
    ];
    
    // Seleccionar elementos basados en las coordenadas
    const streetIndex = Math.abs(Math.floor((lat + lng) * 1000)) % streets.length;
    const neighborhoodIndex = Math.abs(Math.floor((lat * lng) * 1000)) % neighborhoods.length;
    const landmarkIndex = Math.abs(Math.floor((lat - lng) * 1000)) % landmarks.length;
    const houseNumber = Math.abs(Math.floor((lat + lng) * 10000)) % 999 + 1;
    
    return JSON.stringify({
      street: `${streets[streetIndex]} ${houseNumber}`,
      city: 'Santo Domingo',
      state: 'Distrito Nacional',
      zipCode: '10101',
      neighborhood: neighborhoods[neighborhoodIndex],
      landmarks: landmarks[landmarkIndex],
      fullAddress: `${streets[streetIndex]} ${houseNumber}, ${neighborhoods[neighborhoodIndex]}, Santo Domingo, República Dominicana`,
      confidence: 0.85
    });
  }
  
  // Respuesta por defecto
  return JSON.stringify({
    street: 'Dirección no especificada',
    city: 'Santo Domingo',
    state: 'Distrito Nacional',
    zipCode: '10101',
    neighborhood: '',
    landmarks: '',
    fullAddress: 'Santo Domingo, República Dominicana',
    confidence: 0.3
  });
}

// Extraer dirección desde coordenadas
const extractAddress = async (req, res) => {
  try {
    const { error, value } = extractAddressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details
      });
    }

    const { coordinates, country, city } = value;
    const { latitude, longitude } = coordinates;

    console.log(`🔍 Extrayendo dirección para: ${latitude}, ${longitude}`);

    const prompt = `
Basándote en las coordenadas latitude: ${latitude}, longitude: ${longitude} en ${city}, ${country}, 
extrae y genera una dirección completa y realista. 

Responde SOLO con un JSON válido que contenga:
{
  "street": "calle y número específicos",
  "city": "ciudad",
  "state": "estado/provincia", 
  "zipCode": "código postal",
  "neighborhood": "barrio o sector",
  "landmarks": "punto de referencia cercano",
  "fullAddress": "dirección completa formateada",
  "confidence": número entre 0 y 1
}

Usa nombres reales de calles y barrios de ${city}, ${country}.
`;

    const systemMessage = `Eres un experto en geografía y direcciones de República Dominicana. 
Generas direcciones precisas y realistas basadas en coordenadas GPS.`;

    const gptResponse = await callGPTService(prompt, systemMessage);
    
    let extractedAddress;
    try {
      extractedAddress = JSON.parse(gptResponse);
    } catch (parseError) {
      throw new Error('Respuesta de GPT no válida');
    }

    res.json({
      success: true,
      extractedAddress,
      coordinates: [longitude, latitude],
      source: 'ai_extraction'
    });

  } catch (error) {
    console.error('❌ Error extrayendo dirección:', error);
    res.status(500).json({
      success: false,
      error: 'Error extrayendo dirección con IA',
      details: error.message
    });
  }
};

// Mejorar datos de dirección existente
const enhanceAddress = async (req, res) => {
  try {
    const { error, value } = enhanceAddressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details
      });
    }

    const { existingAddress, coordinates, country } = value;

    const prompt = `
Mejora y completa esta dirección: ${JSON.stringify(existingAddress)}
Ubicada en las coordenadas: ${coordinates[1]}, ${coordinates[0]} en ${country}

Mejora los datos faltantes y corrige errores. Responde SOLO con JSON:
{
  "street": "calle mejorada",
  "city": "ciudad correcta",
  "state": "estado correcto",
  "zipCode": "código postal",
  "neighborhood": "barrio específico",
  "landmarks": "referencias cercanas",
  "fullAddress": "dirección completa mejorada",
  "improvements": ["lista de mejoras realizadas"]
}
`;

    const gptResponse = await callGPTService(prompt);
    const enhancedAddress = JSON.parse(gptResponse);

    res.json({
      success: true,
      enhancedAddress,
      originalAddress: existingAddress
    });

  } catch (error) {
    console.error('❌ Error mejorando dirección:', error);
    res.status(500).json({
      success: false,
      error: 'Error mejorando dirección'
    });
  }
};

// Validar y corregir dirección
const validateAddress = async (req, res) => {
  try {
    const { error, value } = validateAddressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details
      });
    }

    const { address, country } = value;

    const prompt = `
Valida esta dirección en ${country}: ${JSON.stringify(address)}

Responde SOLO con JSON:
{
  "isValid": true/false,
  "confidence": número 0-1,
  "correctedAddress": {...dirección corregida},
  "issues": ["problemas encontrados"],
  "suggestions": ["sugerencias de mejora"]
}
`;

    const gptResponse = await callGPTService(prompt);
    const validation = JSON.parse(gptResponse);

    res.json({
      success: true,
      ...validation
    });

  } catch (error) {
    console.error('❌ Error validando dirección:', error);
    res.status(500).json({
      success: false,
      error: 'Error validando dirección'
    });
  }
};

// Buscar landmarks cercanos
const findNearbyLandmarks = async (req, res) => {
  try {
    const { error, value } = nearbyLandmarksSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details
      });
    }

    const { coordinates, radius, country } = value;
    const { latitude, longitude } = coordinates;

    const prompt = `
Encuentra puntos de interés y landmarks cerca de las coordenadas ${latitude}, ${longitude} 
en un radio de ${radius} metros en ${country}.

Responde SOLO con JSON:
{
  "landmarks": [
    {
      "name": "nombre del lugar",
      "type": "tipo (tienda, restaurante, hospital, etc)",
      "distance": "distancia aproximada en metros",
      "description": "descripción breve"
    }
  ]
}
`;

    const gptResponse = await callGPTService(prompt);
    const result = JSON.parse(gptResponse);

    res.json({
      success: true,
      landmarks: result.landmarks || [],
      searchRadius: radius,
      coordinates: [longitude, latitude]
    });

  } catch (error) {
    console.error('❌ Error buscando landmarks:', error);
    res.status(500).json({
      success: false,
      error: 'Error buscando puntos de interés'
    });
  }
};

// Obtener sugerencias de direcciones
const getAddressSuggestions = async (req, res) => {
  try {
    const { error, value } = addressSuggestionsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.details
      });
    }

    const { partialAddress, coordinates, country, maxSuggestions } = value;

    const prompt = `
Genera ${maxSuggestions} sugerencias de direcciones en ${country} 
que empiecen o contengan: "${partialAddress}"
${coordinates ? `Cerca de las coordenadas: ${coordinates[1]}, ${coordinates[0]}` : ''}

Responde SOLO con JSON:
{
  "suggestions": [
    {
      "fullAddress": "dirección completa sugerida",
      "street": "calle",
      "neighborhood": "barrio",
      "relevance": número 0-1
    }
  ]
}
`;

    const gptResponse = await callGPTService(prompt);
    const result = JSON.parse(gptResponse);

    res.json({
      success: true,
      suggestions: result.suggestions || [],
      query: partialAddress
    });

  } catch (error) {
    console.error('❌ Error obteniendo sugerencias:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo sugerencias'
    });
  }
};

// Endpoint de prueba para verificar conectividad con IA
const testAIConnection = async (req, res) => {
  try {
    const prompt = "Responde 'OK' si puedes procesar esta solicitud.";
    const response = await callGPTService(prompt);
    
    res.json({
      success: true,
      message: 'Conexión con IA funcionando',
      response: response.substring(0, 100),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error conectando con servicio de IA',
      details: error.message
    });
  }
};

// Rutas
router.post('/extract-address', verifyToken, extractAddress);
router.post('/enhance-address', verifyToken, enhanceAddress);
router.post('/validate-address', verifyToken, validateAddress);
router.post('/nearby-landmarks', verifyToken, findNearbyLandmarks);
router.post('/address-suggestions', verifyToken, getAddressSuggestions);
router.get('/test', verifyToken, testAIConnection);

module.exports = router;