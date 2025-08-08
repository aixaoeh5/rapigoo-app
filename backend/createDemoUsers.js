const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function createDemoUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Crear usuarios de demostración
    const users = [
      {
        name: 'Cliente Test',
        email: 'cliente-test@rapigoo.com',
        password: await bcrypt.hash('123456', 10),
        role: 'cliente',
        phone: '809-555-0100',
        isVerified: true
      },
      {
        name: 'Admin Rapigoo',
        email: 'admin@rapigoo.com',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
        phone: '809-555-9999',
        isVerified: true
      }
    ];

    console.log('\n📋 Creando usuarios de demostración...');
    
    for (const userData of users) {
      // Verificar si ya existe
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`⚠️  El usuario ${userData.email} ya existe`);
      } else {
        const newUser = new User(userData);
        await newUser.save();
        console.log(`✅ Usuario creado: ${userData.email} (${userData.role})`);
      }
    }

    console.log('\n🎉 ¡USUARIOS CREADOS!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 CLIENTE:');
    console.log('   Email: cliente-test@rapigoo.com');
    console.log('   Contraseña: 123456');
    console.log('');
    console.log('👨‍💼 ADMIN:');
    console.log('   Email: admin@rapigoo.com');
    console.log('   Contraseña: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    await mongoose.disconnect();
    console.log('\n✅ Desconectado de MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

createDemoUsers();