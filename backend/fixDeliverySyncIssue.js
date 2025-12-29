/**
 * Script para sincronizar estado del delivery tracking con el pedido
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

async function fixSpecificOrder(orderNumber) {
  console.log(`\n🔧 === ARREGLANDO PEDIDO ${orderNumber} ===\n`);
  
  try {
    // 1. Buscar el pedido específico
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      console.log(`❌ Pedido ${orderNumber} no encontrado`);
      return;
    }

    console.log(`📦 Pedido encontrado: ${order.orderNumber}`);
    console.log(`   Estado actual: ${order.status}`);
    console.log(`   Delivery ID: ${order.deliveryPersonId}`);

    // 2. Buscar su delivery tracking
    const deliveryTracking = await DeliveryTracking.findOne({ orderId: order._id });
    if (!deliveryTracking) {
      console.log(`❌ No se encontró delivery tracking para este pedido`);
      return;
    }

    console.log(`📍 Delivery tracking encontrado:`);
    console.log(`   Estado del tracking: ${deliveryTracking.status}`);
    console.log(`   Última actualización: ${deliveryTracking.updatedAt}`);

    // 3. Verificar si hay desincronización
    if (deliveryTracking.status === 'at_pickup' && order.status === 'assigned') {
      console.log(`\n⚠️  DESINCRONIZACIÓN DETECTADA`);
      console.log(`   - Delivery tracking: ${deliveryTracking.status}`);
      console.log(`   - Order status: ${order.status}`);
      console.log(`\n🔧 APLICANDO FIX...`);

      // 4. Actualizar el estado del pedido
      try {
        await order.updateStatus('at_pickup', 'Delivery llegó al restaurante - Sincronización automática');
        console.log(`✅ Estado del pedido actualizado: assigned → at_pickup`);
        
        // 5. Verificar la actualización
        const updatedOrder = await Order.findById(order._id);
        console.log(`✅ Verificación: Estado actual = ${updatedOrder.status}`);
        
      } catch (error) {
        console.error(`❌ Error actualizando estado:`, error.message);
      }

    } else if (deliveryTracking.status === order.status) {
      console.log(`✅ Estados sincronizados correctamente`);
    } else {
      console.log(`ℹ️  Estados diferentes pero no requieren sync automático:`);
      console.log(`   - Delivery: ${deliveryTracking.status}`);
      console.log(`   - Order: ${order.status}`);
    }

  } catch (error) {
    console.error('❌ Error durante el fix:', error);
  }
}

async function fixAllDesynchronizedOrders() {
  console.log('\n🔧 === ARREGLANDO TODAS LAS DESINCRONIZACIONES ===\n');
  
  try {
    // Buscar todos los deliveries at_pickup cuyo pedido sigue assigned
    const desyncDeliveries = await DeliveryTracking.find({
      status: 'at_pickup'
    }).populate('orderId');

    console.log(`📍 Deliveries "at_pickup" encontrados: ${desyncDeliveries.length}`);

    for (const delivery of desyncDeliveries) {
      if (delivery.orderId && delivery.orderId.status === 'assigned') {
        console.log(`\n🔧 Arreglando ${delivery.orderId.orderNumber}...`);
        await fixSpecificOrder(delivery.orderId.orderNumber);
      }
    }

  } catch (error) {
    console.error('❌ Error durante el fix masivo:', error);
  }
}

async function main() {
  await connectToDatabase();
  
  // Arreglar el pedido específico que mencionó el usuario
  await fixSpecificOrder('RP250819663022');
  
  // También arreglar cualquier otro pedido con el mismo problema
  await fixAllDesynchronizedOrders();
  
  console.log('\n✅ Fix completado.');
  console.log('\n💡 SIGUIENTE PASO: Prevenir futuras desincronizaciones');
  console.log('   - Actualizar el endpoint de delivery para sincronizar ambos estados');
  console.log('   - Verificar que DeliveryNavigationScreen actualice el Order status');
  
  process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando fix:', error);
    process.exit(1);
  });
}

module.exports = { fixSpecificOrder, fixAllDesynchronizedOrders };