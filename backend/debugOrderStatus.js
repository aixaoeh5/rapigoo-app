const mongoose = require('mongoose');
const Order = require('./models/Order');
const DeliveryTracking = require('./models/DeliveryTracking');
const User = require('./models/User');

async function debugOrderStatus() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔍 DEBUGGING ORDER STATUS DISCREPANCY');
    console.log('====================================');
    
    // Buscar pedidos con estado assigned
    const assignedOrders = await Order.find({ status: 'assigned' })
      .populate('customerId', 'name email')
      .populate('merchantId', 'name business.businessName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    console.log(`\n📋 Encontrados ${assignedOrders.length} pedidos con status 'assigned':`);
    
    for (const order of assignedOrders) {
      console.log(`\n🔸 ORDEN: ${order._id}`);
      console.log(`   📊 Order Status: ${order.status}`);
      console.log(`   👤 Cliente: ${order.customerId?.name || 'Sin nombre'}`);
      console.log(`   🏪 Comercio: ${order.merchantId?.name || order.merchantId?.business?.businessName || 'Sin nombre'}`);
      console.log(`   💰 Total: $${order.total || 0}`);
      console.log(`   🕒 Creado: ${order.createdAt}`);
      
      // Buscar delivery tracking asociado
      const delivery = await DeliveryTracking.findOne({ orderId: order._id })
        .populate('deliveryPersonId', 'name phone');
      
      if (delivery) {
        console.log(`   📍 DELIVERY TRACKING ENCONTRADO:`);
        console.log(`      🚚 Delivery Status: ${delivery.status}`);
        console.log(`      👨‍🚚 Repartidor: ${delivery.deliveryPersonId?.name || 'Sin asignar'}`);
        console.log(`      📱 Teléfono: ${delivery.deliveryPersonId?.phone || 'Sin teléfono'}`);
        console.log(`      🕒 Última actualización: ${delivery.updatedAt}`);
        
        // Verificar historial de estados
        if (delivery.statusHistory && delivery.statusHistory.length > 0) {
          console.log(`      📝 Historial de estados (últimos 3):`);
          const lastThree = delivery.statusHistory.slice(-3);
          lastThree.forEach((history, index) => {
            console.log(`         ${index + 1}. ${history.status} - ${history.timestamp} - ${history.notes || 'Sin notas'}`);
          });
        } else {
          console.log(`      📝 Sin historial de estados`);
        }
        
        // Verificar ubicaciones
        console.log(`      🗺️  Ubicación actual: ${delivery.currentLocation ? 
          `[${delivery.currentLocation.coordinates[0]}, ${delivery.currentLocation.coordinates[1]}]` : 
          'Sin ubicación'}`);
        console.log(`      🎯 Destino entrega: ${delivery.deliveryLocation ? 
          `[${delivery.deliveryLocation.coordinates[0]}, ${delivery.deliveryLocation.coordinates[1]}]` : 
          'Sin destino'}`);
        
      } else {
        console.log(`   ❌ NO HAY DELIVERY TRACKING ASOCIADO`);
      }
      
      console.log(`   ${'='.repeat(50)}`);
    }
    
    // Verificar también si hay delivery tracking sin orden asociada
    console.log(`\n🔍 Buscando delivery tracking sin orden válida...`);
    const orphanedDeliveries = await DeliveryTracking.find()
      .populate('orderId')
      .populate('deliveryPersonId', 'name')
      .limit(5);
    
    for (const delivery of orphanedDeliveries) {
      if (!delivery.orderId) {
        console.log(`\n⚠️  DELIVERY HUÉRFANO: ${delivery._id}`);
        console.log(`   Status: ${delivery.status}`);
        console.log(`   Repartidor: ${delivery.deliveryPersonId?.name || 'Sin asignar'}`);
        console.log(`   Creado: ${delivery.createdAt}`);
      }
    }
    
    // Verificar estados inconsistentes
    console.log(`\n🔍 Buscando inconsistencias entre Order y DeliveryTracking...`);
    const allOrders = await Order.find({ status: { $in: ['assigned', 'picked_up', 'in_transit', 'delivered'] } });
    
    for (const order of allOrders) {
      const delivery = await DeliveryTracking.findOne({ orderId: order._id });
      
      if (delivery) {
        // Verificar si los estados son consistentes
        const orderStatus = order.status;
        const deliveryStatus = delivery.status;
        
        // Mapeo esperado
        const expectedMappings = {
          'assigned': ['assigned', 'heading_to_pickup', 'at_pickup'],
          'picked_up': ['picked_up', 'heading_to_delivery'],
          'in_transit': ['heading_to_delivery', 'at_delivery'],
          'delivered': ['delivered']
        };
        
        const expectedDeliveryStates = expectedMappings[orderStatus] || [];
        
        if (!expectedDeliveryStates.includes(deliveryStatus)) {
          console.log(`\n❌ INCONSISTENCIA DETECTADA:`);
          console.log(`   Orden ${order._id}:`);
          console.log(`   📦 Order Status: ${orderStatus}`);
          console.log(`   🚚 Delivery Status: ${deliveryStatus}`);
          console.log(`   ✅ Estados esperados para delivery: ${expectedDeliveryStates.join(', ')}`);
        }
      }
    }
    
    console.log(`\n✅ Debug completado`);
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  } finally {
    mongoose.disconnect();
  }
}

if (require.main === module) {
  debugOrderStatus();
}

module.exports = { debugOrderStatus };