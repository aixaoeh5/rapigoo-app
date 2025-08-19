const Joi = require('joi');

// Schemas exactos del backend
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
  location: updateLocationSchema.optional()
});

console.log('🧪 TESTING VALIDATION WITH DIFFERENT LOCATION VALUES');
console.log('====================================================');

// Test cases que pueden enviarse desde el frontend
const testCases = [
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
  },
  {
    name: 'location: null',
    payload: {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger',
      location: null
    }
  },
  {
    name: 'location: undefined (omitted)',
    payload: {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger'
    }
  },
  {
    name: 'location: undefined (explicit)',
    payload: {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger',
      location: undefined
    }
  },
  {
    name: 'location: empty object',
    payload: {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger',
      location: {}
    }
  },
  {
    name: 'location with missing required fields',
    payload: {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger',
      location: {
        accuracy: 10
      }
    }
  },
  {
    name: 'location with invalid latitude',
    payload: {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger',
      location: {
        latitude: 'invalid',
        longitude: -69.9312
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
      console.log(`        Value: ${JSON.stringify(detail.context?.value)}`);
    });
  } else {
    console.log('   ✅ Validation passed');
    console.log(`   Validated: ${JSON.stringify(value)}`);
  }
});

// Específicamente probar el caso más probable del frontend
console.log('\n🎯 TESTING MOST LIKELY FRONTEND SCENARIO:');
console.log('=========================================');

// Cuando currentLocation es null (estado inicial)
const frontendPayload = {
  status: 'heading_to_pickup',
  notes: 'Estado actualizado: Ir a recoger',
  location: null  // currentLocation está null al inicio
};

console.log('Frontend payload when currentLocation is null:');
console.log(JSON.stringify(frontendPayload, null, 2));

const { error, value } = updateStatusSchema.validate(frontendPayload);

if (error) {
  console.log('\n❌ THIS IS THE PROBLEM!');
  console.log('Error details:');
  error.details.forEach(detail => {
    console.log(`  - Field: ${detail.path.join('.')}`);
    console.log(`    Message: ${detail.message}`);
    console.log(`    Value: ${JSON.stringify(detail.context?.value)}`);
  });
} else {
  console.log('\n✅ No problem found with null location');
}