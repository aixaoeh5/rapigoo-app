#!/usr/bin/env node
/**
 * Script para probar el registro de dispositivos
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const DeviceToken = require('./models/DeviceToken');

async function testDeviceRegistration() {
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
        password: 'hashedpassword123', // En realidad debería ser hasheado
        role: 'cliente',
        phone: '+1809555000'
      });
      await testUser.save();
      console.log('✅ Usuario creado:', testUser._id);
    } else {
      console.log('👤 Usuario existente encontrado:', testUser._id);
    }

    // Probar registro de dispositivo
    console.log('📱 Probando registro de dispositivo...');
    
    const deviceData = {
      userId: testUser._id,
      deviceToken: 'expo_go_test_device_123456789',
      platform: 'android',
      deviceInfo: {
        model: 'Test Device',
        version: '13',
        appVersion: '1.0.0'
      },
      isActive: true
    };

    // Buscar registro existente
    let device = await DeviceToken.findOne({ deviceToken: deviceData.deviceToken });
    
    if (device) {
      console.log('📱 Dispositivo existente encontrado:', device._id);
      device.isActive = true;
      device.lastUpdated = new Date();
      await device.save();
      console.log('✅ Dispositivo actualizado');
    } else {
      console.log('📱 Creando nuevo dispositivo...');
      device = new DeviceToken(deviceData);
      await device.save();
      console.log('✅ Dispositivo creado:', device._id);
    }

    // Desactivar otros tokens del mismo usuario/plataforma
    console.log('🔄 Desactivando otros tokens...');
    const updateResult = await DeviceToken.updateMany(
      { 
        userId: testUser._id, 
        platform: deviceData.platform, 
        deviceToken: { $ne: deviceData.deviceToken },
        isActive: true 
      },
      { isActive: false, unregisteredAt: new Date() }
    );
    console.log(`✅ Tokens desactivados: ${updateResult.modifiedCount}`);

    // Verificar estadísticas
    console.log('📊 Estadísticas de dispositivos:');
    const stats = await DeviceToken.aggregate([
      {
        $group: {
          _id: { platform: '$platform', isActive: '$isActive' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.platform',
          active: {
            $sum: { $cond: [{ $eq: ['$_id.isActive', true] }, '$count', 0] }
          },
          inactive: {
            $sum: { $cond: [{ $eq: ['$_id.isActive', false] }, '$count', 0] }
          }
        }
      }
    ]);
    
    console.log('Stats:', JSON.stringify(stats, null, 2));

    console.log('✅ Prueba completada exitosamente');

  } catch (error) {
    console.error('❌ Error en prueba:', error);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testDeviceRegistration();
}

module.exports = { testDeviceRegistration };