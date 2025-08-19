/**
 * Script para diagnosticar problemas de sincronización entre delivery y pedidos
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

async function debugDeliveryArrival() {
  console.log('\n🔍 === DEBUG: SINCRONIZACIÓN DELIVERY-PEDIDO ===\n');
  
  try {
    // 1. Buscar pedidos assigned o picked_up recientes
    console.log('📦 1. Buscando pedidos en estados de delivery...');
    const activeOrders = await Order.find({
      status: { $in: ['assigned', 'picked_up', 'in_transit'] },
      deliveryPersonId: { $ne: null }
    })
    .populate('deliveryPersonId', 'name phone')
    .populate('merchantId', 'name business')
    .populate('customerId', 'name phone')
    .sort({ createdAt: -1 })
    .limit(10);

    console.log(`📊 Pedidos activos con delivery: ${activeOrders.length}\n`);

    for (const order of activeOrders) {
      console.log(`🔍 === PEDIDO ${order.orderNumber} ===`);
      console.log(`   Estado del pedido: ${order.status}`);
      console.log(`   Delivery asignado: ${order.deliveryPersonId?.name || 'N/A'}`);
      console.log(`   Comerciante: ${order.merchantId?.name || 'N/A'}`);
      console.log(`   Creado: ${order.createdAt.toLocaleString()}`);

      // 2. Buscar tracking de delivery para este pedido
      const deliveryTracking = await DeliveryTracking.findOne({
        orderId: order._id
      }).populate('deliveryPersonId', 'name');

      if (deliveryTracking) {
        console.log(`   📍 Delivery Tracking encontrado:`);
        console.log(`      Estado: ${deliveryTracking.status}`);
        console.log(`      Última actualización: ${deliveryTracking.updatedAt.toLocaleString()}`);
        console.log(`      Coordenadas actuales: ${deliveryTracking.currentLocation}`);
        console.log(`      Distancia al pickup: ${deliveryTracking.distanceToPickup || 'N/A'} metros`);
        
        // 3. Verificar si hay desincronización
        const isAtPickup = deliveryTracking.status === 'at_pickup';
        const orderStillAssigned = order.status === 'assigned';
        
        if (isAtPickup && orderStillAssigned) {
          console.log(`   ⚠️  DESINCRONIZACIÓN DETECTADA:`);
          console.log(`      - DeliveryTracking dice: ${deliveryTracking.status}`);
          console.log(`      - Order dice: ${order.status}`);
          console.log(`      - El pedido debería cambiar a 'at_pickup' o similar`);
        }
      } else {
        console.log(`   ❌ No se encontró DeliveryTracking para este pedido`);
      }

      console.log(''); // Separador
    }

    // 4. Buscar deliveries que están "at_pickup" pero sus pedidos no
    console.log('\n🎯 2. Buscando desincronizaciones específicas...');
    const deliveriesAtPickup = await DeliveryTracking.find({
      status: 'at_pickup'
    }).populate('orderId').populate('deliveryPersonId', 'name');

    console.log(`📍 Deliveries marcados como "at_pickup": ${deliveriesAtPickup.length}`);

    for (const delivery of deliveriesAtPickup) {
      if (delivery.orderId) {
        const order = delivery.orderId;
        console.log(`   📦 Pedido ${order.orderNumber}:`);
        console.log(`      Delivery status: ${delivery.status}`);
        console.log(`      Order status: ${order.status}`);
        
        if (order.status === 'assigned') {
          console.log(`      ⚠️  PROBLEMA: Delivery llegó pero pedido sigue 'assigned'`);
          console.log(`      🔧 SOLUCIÓN: Actualizar pedido a estado que indique llegada`);
        }
      }
    }

    // 5. Verificar configuración de estados válidos
    console.log('\n📋 3. Estados válidos del Order model...');
    const { ORDER_STATUS } = require('./utils/statusConstants');
    console.log('Estados disponibles:', Object.values(ORDER_STATUS));
    
    // 6. Recomendaciones
    console.log('\n💡 4. Recomendaciones:');
    console.log('1. Verificar que DeliveryNavigationScreen actualice el estado del Order');
    console.log('2. Verificar que el endpoint de delivery actualice ambos estados');
    console.log('3. Considerar agregar estado "at_pickup" al Order model si no existe');
    console.log('4. Verificar que los listeners de cambio de ubicación funcionen correctamente');

  } catch (error) {
    console.error('❌ Error durante el debug:', error);
  }
}

async function main() {
  await connectToDatabase();
  await debugDeliveryArrival();
  
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

module.exports = { debugDeliveryArrival };