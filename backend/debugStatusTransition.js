const axios = require('axios');
const mongoose = require('mongoose');
const DeliveryTracking = require('./models/DeliveryTracking');
const User = require('./models/User');

async function debugStatusTransition() {
  try {
    require('dotenv').config();
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');
    
    console.log('🔍 DEBUGGING STATUS TRANSITION ERROR');
    console.log('===================================');
    
    // 1. Buscar un delivery tracking activo
    const activeTracking = await DeliveryTracking.findOne({
      status: 'assigned',
      isLive: true
    }).populate('deliveryPersonId');
    
    if (!activeTracking) {
      console.log('❌ No se encontró delivery tracking activo');
      return;
    }
    
    console.log('\n📋 DELIVERY TRACKING ENCONTRADO:');
    console.log('ID:', activeTracking._id);
    console.log('Status:', activeTracking.status);
    console.log('Delivery Person:', activeTracking.deliveryPersonId?.name);
    console.log('Delivery Person ID:', activeTracking.deliveryPersonId?._id);
    
    // 2. Simular el request del frontend
    console.log('\n🧪 SIMULANDO REQUEST DEL FRONTEND:');
    
    // Token de Carlos Delivery (actualiza si es necesario)
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OWQxMmE4ZmUwMTUxMWZhOTA5MmUyZCIsImlhdCI6MTc1NTM5NTc1NiwiZXhwIjoxNzU2MDAwNTU2fQ.lzzbX2FCmq9H-1HfI_GO6UhAGrFKtSHS0PJvJLho43E';
    
    // Payload exacto del frontend
    const payload = {
      status: 'heading_to_pickup',
      notes: 'Estado actualizado: Ir a recoger',
      location: {
        latitude: 18.4861,     // Santo Domingo coordinates
        longitude: -69.9312,
        accuracy: 10,
        altitude: 0,
        altitudeAccuracy: 5,
        heading: 45,
        speed: 0
      }
    };
    
    console.log('Request URL:', `http://localhost:5000/api/delivery/${activeTracking._id}/status`);
    console.log('Request Headers:', {
      'Authorization': `Bearer ${token.substring(0, 20)}...`,
      'Content-Type': 'application/json'
    });
    console.log('Request Payload:', JSON.stringify(payload, null, 2));
    
    // 3. Validar payload manualmente con Joi
    console.log('\n🔍 VALIDACIÓN JOI MANUAL:');
    const Joi = require('joi');
    
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
    
    const { error, value } = updateStatusSchema.validate(payload);
    
    if (error) {
      console.log('❌ VALIDACIÓN JOI FALLIDA:');
      console.log('Error details:', error.details);
      error.details.forEach(detail => {
        console.log(`  - Field: ${detail.path.join('.')}`);
        console.log(`    Message: ${detail.message}`);
        console.log(`    Value: ${detail.context?.value}`);
      });
    } else {
      console.log('✅ Validación Joi exitosa');
      console.log('Validated payload:', JSON.stringify(value, null, 2));
    }
    
    // 4. Hacer request real al backend
    console.log('\n🌐 HACIENDO REQUEST REAL AL BACKEND:');
    
    try {
      const response = await axios.put(
        `http://localhost:5000/api/delivery/${activeTracking._id}/status`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      console.log('✅ Request exitoso!');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
    } catch (requestError) {
      console.log('❌ REQUEST FALLÓ:');
      console.log('Status:', requestError.response?.status);
      console.log('Status Text:', requestError.response?.statusText);
      console.log('Error Data:', JSON.stringify(requestError.response?.data, null, 2));
      console.log('Error Message:', requestError.message);
      
      if (requestError.response?.data?.error?.details) {
        console.log('\n📋 DETALLES ESPECÍFICOS DEL ERROR:');
        requestError.response.data.error.details.forEach(detail => {
          console.log(`  - Field: ${detail.field}`);
          console.log(`    Message: ${detail.message}`);
        });
      }
    }
    
    // 5. Verificar token JWT
    console.log('\n🔐 VERIFICANDO TOKEN JWT:');
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token válido');
      console.log('User ID:', decoded.id);
      console.log('Issued at:', new Date(decoded.iat * 1000));
      console.log('Expires at:', new Date(decoded.exp * 1000));
      console.log('Is expired?', Date.now() > decoded.exp * 1000);
      
      // Verificar que el user ID coincide con el delivery person
      console.log('Token user matches delivery person?', decoded.id === activeTracking.deliveryPersonId?._id?.toString());
      
    } catch (tokenError) {
      console.log('❌ Token inválido:', tokenError.message);
    }
    
    // 6. Verificar que el delivery person existe
    console.log('\n👤 VERIFICANDO USUARIO:');
    const user = await User.findById(activeTracking.deliveryPersonId._id);
    if (user) {
      console.log('✅ Usuario encontrado');
      console.log('Name:', user.name);
      console.log('Role:', user.role);
      console.log('Active:', user.isActive);
    } else {
      console.log('❌ Usuario no encontrado');
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

debugStatusTransition();