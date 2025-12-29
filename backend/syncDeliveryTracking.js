/**
 * Script para sincronizar DeliveryTracking con Order status
 */

const mongoose = require('mongoose');
const Order = require('./models/Order');
const DeliveryTracking = require('./models/DeliveryTracking');

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

async function syncSpecificOrder(orderNumber) {
  console.log(`\n🔧 === SINCRONIZANDO DELIVERY TRACKING PARA ${orderNumber} ===\n`);
  
  try {
    // 1. Buscar el pedido
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      console.log(`❌ Pedido ${orderNumber} no encontrado`);
      return;
    }

    console.log(`📦 Pedido encontrado: ${order.orderNumber}`);
    console.log(`   Estado del pedido: ${order.status}`);

    // 2. Buscar su delivery tracking
    const deliveryTracking = await DeliveryTracking.findOne({ orderId: order._id });
    if (!deliveryTracking) {
      console.log(`❌ No se encontró delivery tracking para este pedido`);
      return;
    }

    console.log(`📍 Delivery tracking encontrado:`);
    console.log(`   Estado actual: ${deliveryTracking.status}`);

    // 3. Verificar si necesita sincronización
    if (order.status === 'picked_up' && deliveryTracking.status === 'at_pickup') {
      console.log(`\n⚠️  DESINCRONIZACIÓN DETECTADA - APLICANDO FIX...`);
      
      // 4. Actualizar el delivery tracking
      deliveryTracking.status = 'picked_up';
      deliveryTracking.updatedAt = new Date();
      
      // Agregar entrada al historial si existe
      if (deliveryTracking.statusHistory) {
        deliveryTracking.statusHistory.push({
          status: 'picked_up',
          timestamp: new Date(),
          description: 'Comerciante entregó pedido al delivery - Sincronización automática'
        });
      }

      await deliveryTracking.save();
      
      console.log(`✅ DeliveryTracking sincronizado: at_pickup → picked_up`);
      console.log(`✅ Timestamp actualizado: ${deliveryTracking.updatedAt}`);
      
    } else if (order.status === deliveryTracking.status) {
      console.log(`✅ Estados ya sincronizados correctamente`);
    } else {
      console.log(`ℹ️  Estados diferentes - verificar si es correcto:`);
      console.log(`   Order: ${order.status}`);
      console.log(`   DeliveryTracking: ${deliveryTracking.status}`);
    }

  } catch (error) {
    console.error('❌ Error durante la sincronización:', error);
  }
}

async function syncAllMismatchedOrders() {
  console.log('\n🔧 === SINCRONIZANDO TODOS LOS DELIVERY TRACKINGS DESINCRONIZADOS ===\n');
  
  try {
    // Buscar pedidos picked_up con delivery tracking at_pickup
    const pickedUpOrders = await Order.find({ 
      status: 'picked_up',
      deliveryPersonId: { $ne: null }
    });

    console.log(`📦 Pedidos 'picked_up' encontrados: ${pickedUpOrders.length}`);

    for (const order of pickedUpOrders) {
      const deliveryTracking = await DeliveryTracking.findOne({ orderId: order._id });
      
      if (deliveryTracking && deliveryTracking.status === 'at_pickup') {
        console.log(`\n🔧 Sincronizando ${order.orderNumber}...`);
        await syncSpecificOrder(order.orderNumber);
      }
    }

  } catch (error) {
    console.error('❌ Error durante la sincronización masiva:', error);
  }
}

async function main() {
  await connectToDatabase();
  
  // Sincronizar el pedido específico
  await syncSpecificOrder('RP250819663022');
  
  // También sincronizar cualquier otro pedido con el mismo problema
  await syncAllMismatchedOrders();
  
  console.log('\n✅ Sincronización completada.');
  console.log('\n💡 RESULTADO: El delivery ahora debería ver que puede continuar.');
  
  process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando sincronización:', error);
    process.exit(1);
  });
}

module.exports = { syncSpecificOrder, syncAllMismatchedOrders };