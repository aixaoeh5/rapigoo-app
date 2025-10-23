const mongoose = require('mongoose');
const DeliveryTracking = require('./models/DeliveryTracking');
const Order = require('./models/Order');

async function cleanOrphanedDeliveries() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🧹 LIMPIANDO DELIVERY TRACKINGS HUÉRFANOS');
    console.log('=======================================');
    
    // Encontrar delivery trackings huérfanos
    const allDeliveries = await DeliveryTracking.find({});
    const orphanedDeliveries = [];
    
    console.log(`🔍 Verificando ${allDeliveries.length} delivery trackings...`);
    
    for (const delivery of allDeliveries) {
      const order = await Order.findById(delivery.orderId);
      if (!order) {
        orphanedDeliveries.push(delivery);
      }
    }
    
    console.log(`\n📋 Encontrados ${orphanedDeliveries.length} delivery trackings huérfanos:`);
    
    if (orphanedDeliveries.length === 0) {
      console.log('✅ No hay delivery trackings huérfanos para limpiar');
      return;
    }
    
    // Mostrar detalles antes de eliminar
    orphanedDeliveries.forEach((delivery, index) => {
      console.log(`\n${index + 1}. Delivery ID: ${delivery._id}`);
      console.log(`   Orden referenciada: ${delivery.orderId} (NO EXISTE)`);
      console.log(`   Estado: ${delivery.status}`);
      console.log(`   Creado: ${delivery.createdAt}`);
      console.log(`   Repartidor: ${delivery.deliveryPersonId || 'Sin asignar'}`);
    });
    
    // Confirmar eliminación
    console.log(`\n⚠️  Se eliminarán ${orphanedDeliveries.length} registros huérfanos`);
    
    // Proceder con la eliminación
    const deletedIds = orphanedDeliveries.map(d => d._id);
    const deleteResult = await DeliveryTracking.deleteMany({ _id: { $in: deletedIds } });
    
    console.log(`\n✅ Eliminados ${deleteResult.deletedCount} delivery trackings huérfanos`);
    
    // Verificar que se limpiaron correctamente
    const remainingOrphaned = [];
    const remainingDeliveries = await DeliveryTracking.find({});
    
    for (const delivery of remainingDeliveries) {
      const order = await Order.findById(delivery.orderId);
      if (!order) {
        remainingOrphaned.push(delivery);
      }
    }
    
    if (remainingOrphaned.length === 0) {
      console.log('✅ Todos los delivery trackings huérfanos han sido eliminados');
    } else {
      console.log(`⚠️  Todavía hay ${remainingOrphaned.length} delivery trackings huérfanos`);
    }
    
    console.log(`\n📊 Resumen:`);
    console.log(`   - Delivery trackings iniciales: ${allDeliveries.length}`);
    console.log(`   - Huérfanos eliminados: ${deleteResult.deletedCount}`);
    console.log(`   - Delivery trackings restantes: ${remainingDeliveries.length - deleteResult.deletedCount}`);
    
  } catch (error) {
    console.error('❌ Error limpiando huérfanos:', error);
  } finally {
    mongoose.disconnect();
  }
}

if (require.main === module) {
  cleanOrphanedDeliveries();
}

module.exports = { cleanOrphanedDeliveries };