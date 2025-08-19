const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    
    const DeliveryTracking = require('./models/DeliveryTracking');
    const Order = require('./models/Order');
    const User = require('./models/User');
    
    const deliveryPersonId = new mongoose.Types.ObjectId('689d12a8fe01511fa9092e2d');
    
    console.log('\n🔍 Buscando entregas activas para delivery:', deliveryPersonId);
    
    // Usar el método estático del modelo
    const activeDeliveries = await DeliveryTracking.findActiveDeliveries(deliveryPersonId);
    
    console.log('\n📦 Entregas activas encontradas:', activeDeliveries.length);
    
    if (activeDeliveries.length > 0) {
      activeDeliveries.forEach((delivery, index) => {
        console.log(`\n🚚 Entrega ${index + 1}:`);
        console.log('  - Tracking ID:', delivery._id);
        console.log('  - Order ID:', delivery.orderId?._id);
        console.log('  - Order Number:', delivery.orderId?.orderNumber);
        console.log('  - Order Status:', delivery.orderId?.status);
        console.log('  - Tracking Status:', delivery.status);
        console.log('  - Is Live:', delivery.isLive);
        console.log('  - Pickup:', {
          address: delivery.pickupLocation?.address,
          arrived: delivery.pickupLocation?.arrived
        });
        console.log('  - Delivery:', {
          address: delivery.deliveryLocation?.address,
          arrived: delivery.deliveryLocation?.arrived
        });
      });
    } else {
      console.log('\n⚠️ No hay entregas activas');
      
      // Buscar todos los trackings de este delivery
      console.log('\n🔍 Buscando TODOS los trackings del delivery...');
      const allTrackings = await DeliveryTracking.find({
        deliveryPersonId: deliveryPersonId
      }).populate('orderId');
      
      console.log('📊 Total de trackings:', allTrackings.length);
      
      allTrackings.forEach((tracking, index) => {
        console.log(`\n📍 Tracking ${index + 1}:`);
        console.log('  - ID:', tracking._id);
        console.log('  - Order:', tracking.orderId?.orderNumber);
        console.log('  - Status:', tracking.status);
        console.log('  - Is Live:', tracking.isLive);
      });
    }
    
    // Verificar órdenes directamente
    console.log('\n🔍 Verificando órdenes asignadas directamente...');
    const assignedOrders = await Order.find({
      deliveryPersonId: deliveryPersonId,
      status: { $in: ['assigned', 'picked_up', 'on_the_way'] }
    });
    
    console.log('📦 Órdenes asignadas directamente:', assignedOrders.length);
    
    if (assignedOrders.length > 0) {
      for (const order of assignedOrders) {
        console.log(`\n📋 Orden ${order.orderNumber}:`);
        console.log('  - ID:', order._id);
        console.log('  - Status:', order.status);
        console.log('  - Delivery Person ID:', order.deliveryPersonId);
        
        // Verificar si tiene tracking
        const tracking = await DeliveryTracking.findOne({ orderId: order._id });
        if (tracking) {
          console.log('  ✅ Tiene DeliveryTracking');
          console.log('    - Tracking Status:', tracking.status);
          console.log('    - Is Live:', tracking.isLive);
        } else {
          console.log('  ❌ NO tiene DeliveryTracking');
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();