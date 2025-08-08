const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function createMerchant() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Datos del comerciante
    const merchantData = {
      name: 'Comerciante Principal',
      email: 'mi-comerciante@rapigoo.com',
      password: await bcrypt.hash('123456', 10),
      role: 'comerciante',
      phone: '809-555-0123',
      isVerified: true,
      merchantStatus: 'aprobado', // Ya aprobado para acceso inmediato
      business: {
        businessName: 'Restaurante El Sabroso',
        rnc: '123456789',
        category: 'Restaurante',
        address: 'Av. Principal #123, Santo Domingo',
        description: 'Deliciosa comida dominicana tradicional con un toque moderno. Especialistas en mangu, pollo guisado y tostones.',
        phone: '809-555-0123',
        socials: 'instagram.com/elsabroso',
        schedule: {
          opening: '08:00',
          closing: '22:00'
        }
      },
      notificationPreferences: {
        orderUpdates: true,
        promotions: true,
        newMerchants: false,
        sound: true,
        vibrate: true,
        quiet_hours: {
          enabled: false,
          start: '22:00',
          end: '07:00'
        }
      }
    };

    // Verificar si ya existe
    const existingMerchant = await User.findOne({ email: merchantData.email });
    if (existingMerchant) {
      console.log('⚠️  El comerciante ya existe');
      await mongoose.disconnect();
      return;
    }

    // Crear comerciante
    const merchant = new User(merchantData);
    await merchant.save();

    console.log('🎉 ¡Comerciante creado exitosamente!');
    console.log('\n📋 CREDENCIALES DEL COMERCIANTE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${merchantData.email}`);
    console.log(`🔑 Contraseña: 123456`);
    console.log(`🏪 Negocio: ${merchantData.business.businessName}`);
    console.log(`📱 Teléfono: ${merchantData.phone}`);
    console.log(`✅ Estado: ${merchantData.merchantStatus}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Puedes usar estas credenciales en la app móvil');
    console.log('   para acceder directamente al dashboard de comerciante.');

    await mongoose.disconnect();
    console.log('\n✅ Desconectado de MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

createMerchant();