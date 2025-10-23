const mongoose = require('mongoose');
const Order = require('./models/Order');
const DeliveryTracking = require('./models/DeliveryTracking');

async function fixInconsistentOrders() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔧 FIXING INCONSISTENT ORDERS');
    console.log('==============================');
    
    // Buscar órdenes con delivery tracking delivered pero orden no delivered
    const inconsistentOrders = await Order.find({ 
      status: { $in: ['assigned', 'picked_up', 'in_transit'] } 
    });
    
    console.log(`\n📋 Encontradas ${inconsistentOrders.length} órdenes potencialmente inconsistentes`);
    
    let fixedCount = 0;
    
    for (const order of inconsistentOrders) {
      const delivery = await DeliveryTracking.findOne({ orderId: order._id });
      
      if (delivery && delivery.status === 'delivered') {
        console.log(`\n🔧 CORRIGIENDO INCONSISTENCIA:`);
        console.log(`   Orden: ${order._id}`);
        console.log(`   Estado actual orden: ${order.status}`);
        console.log(`   Estado delivery tracking: ${delivery.status}`);
        
        try {
          // Actualizar la orden a delivered
          await order.updateStatus('delivered', 'Corrección automática de inconsistencia');
          console.log(`   ✅ Orden actualizada a: ${order.status}`);
          
          // Actualizar estadísticas del merchant
          await Order.updateMerchantStats(order._id);
          console.log(`   ✅ Estadísticas del merchant actualizadas`);
          
          fixedCount++;
        } catch (error) {
          console.log(`   ❌ Error al actualizar: ${error.message}`);
        }
      }
    }
    
    console.log(`\n✅ Proceso completado: ${fixedCount} órdenes corregidas`);
    
    // Verificar que todo esté correcto ahora
    console.log(`\n🔍 Verificando correcciones...`);
    const remainingInconsistent = await Order.find({ 
      status: { $in: ['assigned', 'picked_up', 'in_transit'] } 
    });
    
    let stillInconsistentCount = 0;
    for (const order of remainingInconsistent) {
      const delivery = await DeliveryTracking.findOne({ orderId: order._id });
      if (delivery && delivery.status === 'delivered') {
        stillInconsistentCount++;
        console.log(`❌ Orden ${order._id} sigue inconsistente: ${order.status} vs ${delivery.status}`);
      }
    }
    
    if (stillInconsistentCount === 0) {
      console.log(`✅ Todas las inconsistencias fueron corregidas`);
    } else {
      console.log(`⚠️  ${stillInconsistentCount} órdenes siguen inconsistentes`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

if (require.main === module) {
  fixInconsistentOrders();
}

module.exports = { fixInconsistentOrders };