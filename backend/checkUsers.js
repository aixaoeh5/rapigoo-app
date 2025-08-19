/**
 * Script para verificar qué usuarios hay en la base de datos
 */

const mongoose = require('mongoose');
const User = require('./models/User');

// Configurar variables de entorno
require('dotenv').config();

// Configuración de MongoDB
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function checkUsers() {
  console.log('\n👥 === VERIFICANDO USUARIOS EN LA BASE DE DATOS ===\n');
  
  try {
    const users = await User.find({}).select('name email role');
    
    console.log(`📊 Total de usuarios: ${users.length}`);
    
    if (users.length === 0) {
      console.log('❌ No hay usuarios en la base de datos');
      return;
    }
    
    // Agrupar por rol
    const usersByRole = {};
    users.forEach(user => {
      const role = user.role;
      if (!usersByRole[role]) {
        usersByRole[role] = [];
      }
      usersByRole[role].push(user);
    });
    
    console.log('\n📈 Distribución por roles:');
    Object.keys(usersByRole).forEach(role => {
      console.log(`\n   ${role.toUpperCase()}: ${usersByRole[role].length} usuarios`);
      usersByRole[role].forEach(user => {
        console.log(`      - ${user.name} (${user.email}) [${user._id}]`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error verificando usuarios:', error);
  }
}

async function main() {
  await connectToDatabase();
  await checkUsers();
  
  console.log('\n✅ Verificación completada.');
  process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando script:', error);
    process.exit(1);
  });
}

module.exports = { checkUsers };