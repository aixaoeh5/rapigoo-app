/**
 * Script para debuggear el problema con las estadísticas del delivery
 */

const mongoose = require('mongoose');
const User = require('./models/User');
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

async function debugDeliveryStats() {
  console.log('\n🔍 === DEBUG: ESTADÍSTICAS DE DELIVERY ===\n');
  
  try {
    // 1. Buscar todos los usuarios delivery
    console.log('🚚 1. Verificando usuarios delivery...');
    const deliveries = await User.find({ role: 'delivery' });
    
    console.log(`📊 Total deliveries encontrados: ${deliveries.length}`);
    
    for (const delivery of deliveries) {
      console.log(`\n👤 Delivery: ${delivery.name} (${delivery._id})`);
      console.log(`   Email: ${delivery.email}`);
      console.log(`   Role: ${delivery.role}`);
      console.log(`   DeliveryStats exists: ${!!delivery.deliveryStats}`);
      
      if (delivery.deliveryStats) {
        console.log(`   Stats:`, delivery.deliveryStats);
      } else {
        console.log(`   ⚠️  DeliveryStats no inicializado`);
      }
      
      // Contar pedidos entregados por este delivery
      const deliveredOrders = await Order.countDocuments({
        deliveryPersonId: delivery._id,
        status: 'delivered'
      });
      
      console.log(`   Pedidos delivered en DB: ${deliveredOrders}`);
    }

    // 2. Verificar el método de actualización
    console.log('\n🔧 2. Probando método updateDeliveryStats...');
    
    const testOrder = await Order.findOne({
      status: 'delivered',
      deliveryPersonId: { $ne: null }
    });
    
    if (testOrder) {
      console.log(`📦 Usando pedido: ${testOrder.orderNumber}`);
      console.log(`   Delivery ID: ${testOrder.deliveryPersonId}`);
      console.log(`   Total: RD$${testOrder.total}`);
      
      // Ejecutar método manualmente
      await Order.updateDeliveryStats(testOrder._id);
      
      // Verificar resultado
      const updatedDelivery = await User.findById(testOrder.deliveryPersonId);
      console.log(`📊 Stats después del update manual:`);
      console.log(updatedDelivery.deliveryStats);
      
    } else {
      console.log('❌ No se encontró pedido delivered para test');
    }

    // 3. Verificar estructura del schema
    console.log('\n📋 3. Verificando schema de User...');
    const userSchema = User.schema;
    const deliveryPath = userSchema.path('deliveryStats');
    
    if (deliveryPath) {
      console.log('✅ Campo deliveryStats existe en schema');
      console.log('   Tipo:', deliveryPath.constructor.name);
    } else {
      console.log('❌ Campo deliveryStats NO existe en schema');
    }

  } catch (error) {
    console.error('❌ Error durante debug:', error);
  }
}

async function fixDeliveryStats() {
  console.log('\n🔧 === FIX: INICIALIZAR DELIVERY STATS ===\n');
  
  try {
    const deliveries = await User.find({ 
      role: 'delivery',
      deliveryStats: { $exists: false }
    });
    
    console.log(`🚚 Deliveries sin stats: ${deliveries.length}`);
    
    for (const delivery of deliveries) {
      delivery.deliveryStats = {
        totalDeliveries: 0,
        completedDeliveries: 0,
        cancelledDeliveries: 0,
        averageRating: 0,
        totalEarnings: 0
      };
      
      await delivery.save();
      console.log(`✅ Stats inicializados para: ${delivery.name}`);
    }

  } catch (error) {
    console.error('❌ Error inicializando stats:', error);
  }
}

async function main() {
  await connectToDatabase();
  await debugDeliveryStats();
  await fixDeliveryStats();
  
  console.log('\n✅ Debug completado.');
  process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando debug:', error);
    process.exit(1);
  });
}

module.exports = { debugDeliveryStats, fixDeliveryStats };