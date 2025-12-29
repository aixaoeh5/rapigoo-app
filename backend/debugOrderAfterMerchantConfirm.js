/**
 * Script para diagnosticar el estado después de que el comerciante confirma
 */

const mongoose = require('mongoose');
const Order = require('./models/Order');
const DeliveryTracking = require('./models/DeliveryTracking');
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

async function debugAfterMerchantConfirm() {
  console.log('\n🔍 === DEBUG: ESTADO DESPUÉS DE CONFIRMACIÓN DEL COMERCIANTE ===\n');
  
  try {
    // 1. Verificar el estado actual del pedido específico
    const order = await Order.findOne({ orderNumber: 'RP250819663022' })
      .populate('deliveryPersonId', 'name phone')
      .populate('merchantId', 'name business')
      .populate('customerId', 'name phone');

    if (!order) {
      console.log('❌ Pedido RP250819663022 no encontrado');
      return;
    }

    console.log(`📦 === ESTADO ACTUAL DEL PEDIDO ${order.orderNumber} ===`);
    console.log(`   Estado: ${order.status}`);
    console.log(`   Delivery: ${order.deliveryPersonId?.name || 'N/A'}`);
    console.log(`   Última actualización: ${order.updatedAt}`);
    console.log(`   Versión: ${order.__v}`);

    // 2. Mostrar historial de tracking del pedido
    console.log(`\n📈 Historial de tracking del pedido:`);
    if (order.tracking && order.tracking.length > 0) {
      order.tracking.forEach((track, index) => {
        console.log(`   ${index + 1}. ${track.status} - ${track.timestamp} - ${track.description || 'Sin descripción'}`);
      });
    } else {
      console.log('   ❌ No hay historial de tracking en el pedido');
    }

    // 3. Verificar el delivery tracking
    const deliveryTracking = await DeliveryTracking.findOne({ orderId: order._id })
      .populate('deliveryPersonId', 'name');

    if (deliveryTracking) {
      console.log(`\n📍 === ESTADO DEL DELIVERY TRACKING ===`);
      console.log(`   Estado: ${deliveryTracking.status}`);
      console.log(`   Delivery: ${deliveryTracking.deliveryPersonId?.name || 'N/A'}`);
      console.log(`   Última actualización: ${deliveryTracking.updatedAt}`);
      console.log(`   Coordenadas: ${JSON.stringify(deliveryTracking.currentLocation?.coordinates || 'N/A')}`);

      // 4. Verificar inconsistencias
      console.log(`\n🔍 === ANÁLISIS DE CONSISTENCIA ===`);
      console.log(`   Order status: ${order.status}`);
      console.log(`   Delivery status: ${deliveryTracking.status}`);

      if (order.status === 'picked_up' && deliveryTracking.status === 'at_pickup') {
        console.log(`   ⚠️  INCONSISTENCIA DETECTADA:`);
        console.log(`      - Order fue actualizado a 'picked_up' (comerciante confirmó)`);
        console.log(`      - DeliveryTracking sigue en 'at_pickup'`);
        console.log(`      - El delivery debería ver que puede continuar`);
      } else if (order.status === 'picked_up' && deliveryTracking.status === 'picked_up') {
        console.log(`   ✅ Estados sincronizados correctamente`);
      } else {
        console.log(`   ❓ Combinación de estados: revisar lógica de negocio`);
      }

    } else {
      console.log(`\n❌ No se encontró DeliveryTracking para este pedido`);
    }

    // 5. Verificar qué debería mostrar la app del delivery
    console.log(`\n📱 === LO QUE DEBERÍA VER EL DELIVERY ===`);
    
    if (order.status === 'picked_up') {
      console.log(`   ✅ Pedido recogido exitosamente`);
      console.log(`   📍 Puede iniciar navegación hacia el cliente`);
      console.log(`   🚗 Siguiente estado: in_transit`);
    } else if (order.status === 'at_pickup') {
      console.log(`   ⏳ Esperando confirmación del comerciante`);
      console.log(`   🏪 Delivery llegó, pero comerciante no ha entregado`);
    } else {
      console.log(`   ❓ Estado no esperado para delivery: ${order.status}`);
    }

    // 6. Recomendaciones
    console.log(`\n💡 === RECOMENDACIONES ===`);
    if (deliveryTracking && deliveryTracking.status !== order.status) {
      console.log(`1. Sincronizar DeliveryTracking con Order status`);
      console.log(`2. Verificar que el endpoint de merchant actualice ambos`);
      console.log(`3. Verificar que el frontend del delivery reaccione a cambios`);
    }
    console.log(`4. Verificar que el polling/websockets funcionen correctamente`);
    console.log(`5. Revisar si hay caché que evite actualizaciones en tiempo real`);

  } catch (error) {
    console.error('❌ Error durante el debug:', error);
  }
}

async function main() {
  await connectToDatabase();
  await debugAfterMerchantConfirm();
  
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

module.exports = { debugAfterMerchantConfirm };