const Joi = require('joi');

// Schemas corregidos
const updateLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  accuracy: Joi.number().min(0).optional(),
  altitude: Joi.number().optional(),
  altitudeAccuracy: Joi.number().optional(),
  heading: Joi.number().min(0).max(360).optional(),
  speed: Joi.number().min(0).optional()
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery', 'delivered', 'cancelled').required(),
  notes: Joi.string().max(500).optional(),
  location: updateLocationSchema.optional().allow(null)
}).options({ stripUnknown: true });

console.log('🧪 TESTING FIXED VALIDATION');
console.log('===========================');

// Test cases después de la corrección
const testCases = [
  {
    name: 'Frontend sin location (currentLocation null)',
    payload: {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger'
      // No incluye location - corrección frontend
    }
  },
  {
    name: 'Backend con location: null (si llega)',
    payload: {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger',
      location: null
    }
  },
  {
    name: 'Valid location object',
    payload: {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger',
      location: {
        latitude: 18.4861,
        longitude: -69.9312,
        accuracy: 10
      }
    }
  }
];

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. Testing: ${testCase.name}`);
  console.log(`   Payload: ${JSON.stringify(testCase.payload)}`);
  
  const { error, value } = updateStatusSchema.validate(testCase.payload);
  
  if (error) {
    console.log('   ❌ VALIDATION FAILED');
    error.details.forEach(detail => {
      console.log(`      - Field: ${detail.path.join('.')}`);
      console.log(`        Message: ${detail.message}`);
    });
  } else {
    console.log('   ✅ Validation passed');
    console.log(`   Result: ${JSON.stringify(value)}`);
  }
});

console.log('\n✅ ALL TESTS SHOULD PASS NOW!');