const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    
    const DeliveryTracking = require('./models/DeliveryTracking');
    const Order = require('./models/Order');
    const User = require('./models/User'); // Agregar modelo User para referencias
    
    // Buscar órdenes con status 'assigned' y deliveryPersonId
    const assignedOrders = await Order.find({ 
      status: 'assigned',
      deliveryPersonId: new mongoose.Types.ObjectId('689d12a8fe01511fa9092e2d')
    }).populate('merchantId');
    
    console.log('📦 Órdenes asignadas al delivery:', assignedOrders.length);
    
    if (assignedOrders.length > 0) {
      assignedOrders.forEach(order => {
        console.log(`  - Order: ${order.orderNumber}, ID: ${order._id}`);
      });
    }
    
    // Buscar DeliveryTrackings para este delivery
    const trackings = await DeliveryTracking.find({
      deliveryPersonId: new mongoose.Types.ObjectId('689d12a8fe01511fa9092e2d')
    }).populate('orderId');
    
    console.log('📍 DeliveryTrackings encontrados:', trackings.length);
    
    if (trackings.length > 0) {
      trackings.forEach(t => {
        console.log(`  - Tracking ID: ${t._id}`);
        console.log(`    Order: ${t.orderId?.orderNumber || t.orderId}`);
        console.log(`    Status: ${t.status}`);
      });
    }
    
    // Crear DeliveryTracking si no existe para las órdenes asignadas
    if (assignedOrders.length > 0) {
      console.log('\n🔧 Verificando y creando DeliveryTrackings faltantes...\n');
      
      for (const order of assignedOrders) {
        const existingTracking = await DeliveryTracking.findOne({ orderId: order._id });
        
        if (!existingTracking) {
          console.log(`⚠️ No hay tracking para orden ${order.orderNumber}, creando...`);
          
          // Obtener coordenadas reales del comerciante
          const pickupCoordinates = order.merchantId?.business?.location?.coordinates || [-77.0428, -12.0464];
          const deliveryCoordinates = order.deliveryInfo?.coordinates || [-77.0328, -12.0364];
          
          console.log(`📍 Usando coordenadas del comerciante: ${JSON.stringify(pickupCoordinates)}`);
          console.log(`🏠 Usando coordenadas del cliente: ${JSON.stringify(deliveryCoordinates)}`);
          
          const newTracking = new DeliveryTracking({
            orderId: order._id,
            deliveryPersonId: order.deliveryPersonId,
            status: 'assigned',
            pickupLocation: {
              coordinates: pickupCoordinates,
              address: order.merchantId?.business?.pickupAddress?.street || 
                       order.merchantId?.business?.address || 
                       'Dirección del comerciante'
            },
            deliveryLocation: {
              coordinates: deliveryCoordinates,
              address: order.deliveryInfo?.address ? 
                `${order.deliveryInfo.address.street}, ${order.deliveryInfo.address.city}` : 
                'Dirección del cliente'
            },
            isLive: true
          });
          
          await newTracking.save();
          console.log(`✅ DeliveryTracking creado para orden: ${order.orderNumber}`);
        } else {
          console.log(`✓ Ya existe tracking para orden ${order.orderNumber} (Status: ${existingTracking.status})`);
        }
      }
    }
    
    // Verificar de nuevo después de crear
    console.log('\n📊 Estado final:');
    const finalTrackings = await DeliveryTracking.findActiveDeliveries(
      new mongoose.Types.ObjectId('689d12a8fe01511fa9092e2d')
    );
    console.log(`DeliveryTrackings activos para el delivery: ${finalTrackings.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();