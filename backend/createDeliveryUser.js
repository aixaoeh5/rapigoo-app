const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function createDeliveryUser() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Verificar si ya existe el usuario
    const existingUser = await User.findOne({ email: 'carlos-delivery@rapigoo.com' });
    if (existingUser) {
      console.log('⚠️ El usuario delivery Carlos ya existe');
      console.log('   Email: carlos-delivery@rapigoo.com');
      console.log('   Contraseña: 123456');
      await mongoose.disconnect();
      return;
    }

    // Crear el hash de la contraseña
    const hashedPassword = await bcrypt.hash('123456', 10);

    // Crear el usuario delivery
    const deliveryUser = new User({
      name: 'Carlos Delivery',
      email: 'carlos-delivery@rapigoo.com',
      password: hashedPassword,
      role: 'delivery',
      phone: '809-555-0300',
      avatar: 'https://ui-avatars.com/api/?name=Carlos+Delivery&background=2196F3&color=fff',
      isVerified: true,
      deliveryStatus: 'aprobado',
      
      // Información específica del delivery
      delivery: {
        vehicleType: 'motocicleta',
        vehicleModel: 'Honda CB190R',
        licensePlate: 'H123456',
        licenseNumber: 'LIC789012',
        licenseExpiry: new Date('2025-12-31'),
        isAvailable: true,
        
        // Ubicación actual (Plaza de la Cultura, Santo Domingo)
        currentLocation: {
          type: 'Point',
          coordinates: [-69.9312, 18.4861]
        },
        
        // Zona de trabajo (Santo Domingo centro)
        workZone: {
          center: [-69.9312, 18.4861],
          radius: 15 // 15 km de radio
        },
        
        // Estadísticas iniciales
        deliveryStats: {
          totalDeliveries: 45,
          completedDeliveries: 43,
          cancelledDeliveries: 2,
          averageRating: 4.7,
          totalEarnings: 12850 // RD$12,850
        }
      },
      
      // Preferencias de notificaciones
      notificationPreferences: {
        orderUpdates: true,
        promotions: false,
        newMerchants: false,
        sound: true,
        vibrate: true,
        quiet_hours: {
          enabled: true,
          start: '23:00',
          end: '06:00'
        }
      }
    });

    await deliveryUser.save();

    console.log('✅ Usuario delivery creado exitosamente!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚚 CUENTA DELIVERY:');
    console.log(`   Email: carlos-delivery@rapigoo.com`);
    console.log(`   Contraseña: 123456`);
    console.log(`   Nombre: Carlos Delivery`);
    console.log(`   Teléfono: 809-555-0300`);
    console.log(`   Vehículo: Honda CB190R (Motocicleta)`);
    console.log(`   Placa: H123456`);
    console.log(`   Status: Aprobado y disponible`);
    console.log(`   Rating promedio: ⭐ 4.7`);
    console.log(`   Total entregas: 43 completadas, 2 canceladas`);
    console.log(`   Zona de trabajo: Santo Domingo centro (15km radio)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('❌ Error creando usuario delivery:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  createDeliveryUser();
}

module.exports = createDeliveryUser;