/**
 * Script para limpiar órdenes de test
 */

const mongoose = require('mongoose');
const Order = require('./models/Order');

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

async function cleanupTestOrders() {
  console.log('\n🧹 === LIMPIANDO ÓRDENES DE TEST ===\n');
  
  try {
    // Buscar órdenes que empiecen con TEST
    const testOrders = await Order.find({
      orderNumber: { $regex: /^TEST_/i }
    });

    console.log(`🔍 Órdenes de test encontradas: ${testOrders.length}`);

    if (testOrders.length === 0) {
      console.log('✅ No hay órdenes de test para limpiar');
      return;
    }

    // Mostrar órdenes que se van a eliminar
    console.log('\n📋 Órdenes que se eliminarán:');
    testOrders.forEach(order => {
      console.log(`   - ${order.orderNumber} (${order.status}) - ${order.createdAt.toLocaleDateString()}`);
    });

    // Eliminar órdenes de test
    const result = await Order.deleteMany({
      orderNumber: { $regex: /^TEST_/i }
    });

    console.log(`\n✅ Eliminadas ${result.deletedCount} órdenes de test`);

  } catch (error) {
    console.error('❌ Error limpiando órdenes de test:', error);
  }
}

async function main() {
  await connectToDatabase();
  await cleanupTestOrders();
  
  console.log('\n✅ Limpieza completada.');
  process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando limpieza:', error);
    process.exit(1);
  });
}

module.exports = { cleanupTestOrders };