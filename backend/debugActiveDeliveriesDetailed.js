const mongoose = require('mongoose');
const DeliveryTracking = require('./models/DeliveryTracking');
const Order = require('./models/Order');
const User = require('./models/User');

// Función de debug detallado para revisar el problema
async function debugActiveDeliveries() {
  try {
    console.log('🔍 DEBUGGING ACTIVE DELIVERIES - Análisis detallado');
    console.log('================================================');
    
    // 1. Buscar todos los deliveries en estados "activos"
    const allActiveStatuses = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'];
    
    console.log('\n📊 1. TODOS LOS DELIVERIES EN ESTADOS ACTIVOS:');
    const allDeliveries = await DeliveryTracking.find({
      status: { $in: allActiveStatuses }
    })
    .populate('orderId', 'orderNumber')
    .populate('deliveryPersonId', 'name')
    .sort({ createdAt: -1 });
    
    console.log(`Total encontrados: ${allDeliveries.length}`);
    allDeliveries.forEach((delivery, i) => {
      console.log(`  ${i + 1}. ID: ${delivery._id}`);
      console.log(`     Order: #${delivery.orderId?.orderNumber || 'N/A'}`);
      console.log(`     Delivery Person: ${delivery.deliveryPersonId?.name || 'N/A'} (${delivery.deliveryPersonId?._id})`);
      console.log(`     Status: ${delivery.status}`);
      console.log(`     isLive: ${delivery.isLive}`);
      console.log(`     Created: ${delivery.createdAt}`);
      console.log('     ---');
    });
    
    // 2. Buscar específicamente con isLive: true
    console.log('\n🔥 2. DELIVERIES CON isLive: true:');
    const liveDeliveries = await DeliveryTracking.find({
      status: { $in: allActiveStatuses },
      isLive: true
    })
    .populate('orderId', 'orderNumber')
    .populate('deliveryPersonId', 'name')
    .sort({ createdAt: -1 });
    
    console.log(`Total con isLive=true: ${liveDeliveries.length}`);
    liveDeliveries.forEach((delivery, i) => {
      console.log(`  ${i + 1}. ID: ${delivery._id}`);
      console.log(`     Order: #${delivery.orderId?.orderNumber || 'N/A'}`);
      console.log(`     Delivery Person: ${delivery.deliveryPersonId?.name || 'N/A'} (${delivery.deliveryPersonId?._id})`);
      console.log(`     Status: ${delivery.status}`);
      console.log('     ---');
    });
    
    // 3. Probar la función findActiveDeliveries para cada delivery person
    console.log('\n🎯 3. PROBANDO findActiveDeliveries() POR DELIVERY PERSON:');
    const deliveryPersons = [...new Set(allDeliveries.map(d => d.deliveryPersonId?._id?.toString()).filter(Boolean))];
    
    for (const deliveryPersonId of deliveryPersons) {
      console.log(`\n   Delivery Person ID: ${deliveryPersonId}`);
      
      const activeForPerson = await DeliveryTracking.findActiveDeliveries(deliveryPersonId);
      console.log(`   findActiveDeliveries() result: ${activeForPerson.length} deliveries`);
      
      activeForPerson.forEach((delivery, i) => {
        console.log(`     ${i + 1}. Order #${delivery.orderId?.orderNumber} - Status: ${delivery.status}`);
      });
      
      // Comparar con query manual
      const manualQuery = await DeliveryTracking.find({
        deliveryPersonId: deliveryPersonId,
        status: { $in: allActiveStatuses },
        isLive: true
      });
      console.log(`   Manual query result: ${manualQuery.length} deliveries`);
      
      if (activeForPerson.length !== manualQuery.length) {
        console.log('   ⚠️ DISCREPANCIA DETECTADA!');
      }
    }
    
    // 4. Buscar entregas con isLive: false pero status activo
    console.log('\n🚨 4. DELIVERIES CON STATUS ACTIVO PERO isLive: false:');
    const inactiveButActiveStatus = await DeliveryTracking.find({
      status: { $in: allActiveStatuses },
      isLive: false
    })
    .populate('orderId', 'orderNumber')
    .populate('deliveryPersonId', 'name');
    
    console.log(`Total con isLive=false pero status activo: ${inactiveButActiveStatus.length}`);
    inactiveButActiveStatus.forEach((delivery, i) => {
      console.log(`  ${i + 1}. ID: ${delivery._id}`);
      console.log(`     Order: #${delivery.orderId?.orderNumber || 'N/A'}`);
      console.log(`     Delivery Person: ${delivery.deliveryPersonId?.name || 'N/A'}`);
      console.log(`     Status: ${delivery.status}`);
      console.log(`     Created: ${delivery.createdAt}`);
      console.log('     ---');
    });
    
    // 5. Verificar órden relacionadas
    console.log('\n📦 5. VERIFICANDO ÓRDENES RELACIONADAS:');
    for (const delivery of allDeliveries) {
      if (delivery.orderId) {
        const order = await Order.findById(delivery.orderId._id);
        console.log(`Order #${delivery.orderId.orderNumber}:`);
        console.log(`  Status: ${order?.status}`);
        console.log(`  deliveryPersonId: ${order?.deliveryPersonId}`);
        console.log(`  Matches delivery? ${order?.deliveryPersonId?.toString() === delivery.deliveryPersonId?._id?.toString()}`);
        console.log('  ---');
      }
    }
    
    console.log('\n✅ Debug completado');
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  }
}

// Conectar a MongoDB y ejecutar
const connectAndDebug = async () => {
  try {
    // Usar la URI del .env
    require('dotenv').config();
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo-delivery';
    console.log('🔗 Conectando a:', mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');
    
    await debugActiveDeliveries();
    
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  connectAndDebug();
}

module.exports = { debugActiveDeliveries };