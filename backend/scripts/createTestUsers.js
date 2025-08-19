/**
 * Script para crear usuarios de prueba de todos los tipos
 * Ejecutar con: node scripts/createTestUsers.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');

// Cargar variables de entorno
dotenv.config();

const testUsers = [
  {
    name: 'Cliente Test',
    email: 'cliente@test.com',
    password: 'test123',
    role: 'cliente',
    phone: '+505 8888-1111',
    isVerified: true,
    status: 'activo'
  },
  {
    name: 'Comerciante Test',
    email: 'comerciante@test.com', 
    password: 'test123',
    role: 'comerciante',
    phone: '+505 8888-2222',
    isVerified: true,
    status: 'aprobado', // Para comerciantes: aprobado, pendiente, rechazado
    businessName: 'Restaurante Test',
    businessType: 'restaurante',
    businessAddress: 'Managua, Nicaragua',
    description: 'Restaurante de prueba para testing'
  },
  {
    name: 'Delivery Test',
    email: 'delivery@test.com',
    password: 'test123', 
    role: 'delivery',
    phone: '+505 8888-3333',
    isVerified: true,
    deliveryStatus: 'aprobado',
    delivery: {
      vehicleType: 'motocicleta',
      vehicleModel: 'Honda CBR 150',
      licensePlate: 'M-123456',
      licenseNumber: 'D123456789',
      licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
      isAvailable: true,
      currentLocation: {
        type: 'Point',
        coordinates: [-69.9312, 18.4861] // Santo Domingo, RD
      },
      workZone: {
        center: [-69.9312, 18.4861],
        radius: 15 // 15 km de radio
      },
      deliveryStats: {
        totalDeliveries: 0,
        completedDeliveries: 0,
        cancelledDeliveries: 0,
        averageRating: 0,
        totalEarnings: 0
      }
    }
  },
  {
    name: 'Admin Test',
    email: 'admin@test.com',
    password: 'admin123',
    role: 'admin',
    phone: '+505 8888-0000',
    isVerified: true,
    status: 'activo'
  }
];

async function createTestUsers() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    console.log('\n🔄 Creando usuarios de prueba...\n');

    for (const userData of testUsers) {
      try {
        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ email: userData.email });
        
        if (existingUser) {
          console.log(`⚠️  Usuario ${userData.email} ya existe, actualizando...`);
          
          // Actualizar usuario existente
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          await User.updateOne(
            { email: userData.email },
            { 
              ...userData, 
              password: hashedPassword,
              updatedAt: new Date()
            }
          );
          
          console.log(`✅ Usuario ${userData.role} actualizado: ${userData.email}`);
        } else {
          // Crear nuevo usuario
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          
          const user = new User({
            ...userData,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          await user.save();
          console.log(`✅ Usuario ${userData.role} creado: ${userData.email}`);
        }

        // Mostrar info del usuario
        console.log(`   📧 Email: ${userData.email}`);
        console.log(`   🔑 Password: ${userData.password}`);
        console.log(`   👤 Rol: ${userData.role}`);
        console.log(`   📱 Teléfono: ${userData.phone}`);
        if (userData.businessName) {
          console.log(`   🏪 Negocio: ${userData.businessName}`);
        }
        console.log('');

      } catch (userError) {
        console.error(`❌ Error creando usuario ${userData.email}:`, userError.message);
      }
    }

    console.log('📋 RESUMEN DE USUARIOS CREADOS:');
    console.log('='.repeat(50));
    
    for (const userData of testUsers) {
      console.log(`${userData.role.toUpperCase().padEnd(12)} | ${userData.email.padEnd(20)} | ${userData.password}`);
    }
    
    console.log('='.repeat(50));
    console.log('\n✨ ¡Usuarios de prueba listos para usar!');
    console.log('\n💡 Para probar en la app:');
    console.log('   1. Usa cualquiera de los emails y contraseñas de arriba');
    console.log('   2. Ve directamente a la pantalla de login (sin registro)');
    console.log('   3. Los usuarios ya están verificados y activos');
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar solo si el archivo se ejecuta directamente
if (require.main === module) {
  createTestUsers();
}

module.exports = { createTestUsers, testUsers };