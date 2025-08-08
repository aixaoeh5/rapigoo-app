const mongoose = require('mongoose');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testMerchantAuth() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Buscar comerciante
    const comerciante = await User.findOne({ email: 'comerciante@test.com' });
    if (!comerciante) {
      console.log('❌ No se encontró el comerciante comerciante@test.com');
      return;
    }

    console.log('👤 Comerciante encontrado:');
    console.log('   ID:', comerciante._id);
    console.log('   Name:', comerciante.name);
    console.log('   Role:', comerciante.role);
    console.log('   Email:', comerciante.email);

    // Generar token
    const token = jwt.sign(
      { id: comerciante._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('\n🔑 Token generado:', token.substring(0, 50) + '...');

    // Verificar token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token válido, ID decodificado:', decoded.id);
    } catch (error) {
      console.log('❌ Token inválido:', error.message);
    }

    await mongoose.disconnect();
    console.log('\n🔒 Desconectado de MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testMerchantAuth();