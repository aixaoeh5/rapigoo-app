#!/usr/bin/env node
/**
 * Script para probar el endpoint de registro de dispositivos directamente
 */

require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testDeviceEndpoint() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Crear usuario de prueba si no existe
    let testUser = await User.findOne({ email: 'consumidor@test.com' });
    
    if (!testUser) {
      console.log('👤 Creando usuario de prueba...');
      testUser = new User({
        name: 'Usuario Consumidor Test',
        email: 'consumidor@test.com',
        password: 'hashedpassword123',
        role: 'cliente',
        phone: '+1809555000'
      });
      await testUser.save();
      console.log('✅ Usuario creado:', testUser._id);
    } else {
      console.log('👤 Usuario existente encontrado:', testUser._id);
    }

    // Generar token JWT válido
    const token = jwt.sign(
      { 
        id: testUser._id,
        email: testUser.email,
        role: testUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    console.log('🔑 Token JWT generado para usuario:', testUser._id);

    // Preparar payload para el endpoint
    const devicePayload = {
      deviceToken: 'expo_go_endpoint_test_123456789',
      platform: 'android',
      deviceInfo: {
        model: 'Test Device Endpoint',
        version: '13',
        appVersion: '1.0.0'
      }
    };

    console.log('📱 Enviando petición al endpoint...');
    console.log('📱 Payload:', JSON.stringify(devicePayload, null, 2));

    // Hacer petición al endpoint
    const response = await axios.post(
      `${BASE_URL}/notifications/register`,
      devicePayload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Respuesta del endpoint:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
    
    if (error.response) {
      console.error('❌ Status:', error.response.status);
      console.error('❌ Data:', JSON.stringify(error.response.data, null, 2));
      
      // Log más detallado del error de validación
      if (error.response.data?.details) {
        console.error('❌ Detalles de validación:');
        error.response.data.details.forEach((detail, index) => {
          console.error(`  ${index + 1}. Campo: ${detail.field}`);
          console.error(`     Mensaje: ${detail.message}`);
        });
      }
    }
    
    console.error('❌ Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testDeviceEndpoint();
}

module.exports = { testDeviceEndpoint };