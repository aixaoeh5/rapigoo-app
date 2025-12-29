const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  try {
    console.log('🔗 Probando conexión a MongoDB...');
    console.log('URI:', process.env.MONGO_URI ? 'Configurado (MongoDB Atlas)' : 'No configurado');
    
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/rapigoo';
    
    // Mostrar solo parte de la URI por seguridad
    const safeDomain = mongoUri.includes('mongodb.net') ? 'MongoDB Atlas' : 
                      mongoUri.includes('localhost') ? 'localhost' : 'Otro servidor';
    console.log('Conectando a:', safeDomain);
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      maxPoolSize: 10
    });
    
    console.log('✅ Conexión exitosa!');
    console.log('📊 Estado de la base de datos:');
    console.log('   - Estado:', mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado');
    console.log('   - Host:', mongoose.connection.host);
    console.log('   - Puerto:', mongoose.connection.port || 'Default');
    console.log('   - Base de datos:', mongoose.connection.name);
    
    // Probar una operación simple
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`   - Colecciones existentes: ${collections.length}`);
    collections.forEach(col => console.log(`     * ${col.name}`));
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    
    if (error.name === 'MongooseServerSelectionError') {
      console.log('\n💡 Diagnóstico:');
      
      if (error.message.includes('ECONNREFUSED')) {
        console.log('• Servidor MongoDB no está corriendo o no es accesible');
      }
      
      if (error.message.includes('authentication failed')) {
        console.log('• Credenciales incorrectas en .env');
      }
      
      if (error.message.includes('timeout')) {
        console.log('• Timeout de conexión - revisar firewall/red');
      }
      
      console.log('\n🔧 Soluciones:');
      console.log('1. Para MongoDB local: Instalar y ejecutar MongoDB');
      console.log('2. Para Atlas: Verificar whitelist de IP en https://cloud.mongodb.com');
      console.log('3. Verificar credenciales en archivo .env');
      console.log('4. Probar desde otra red (a veces ISP bloquea)');
    }
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n👋 Conexión cerrada correctamente');
    }
  }
}

testConnection();