const mongoose = require('mongoose');
const Order = require('./models/Order');
const User = require('./models/User');

async function debugOrderDeliveryInfo() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    
    console.log('🔍 DEBUGGING ORDER DELIVERY INFO');
    console.log('================================');
    
    // Buscar la orden específica
    const order = await Order.findOne({ orderNumber: 'RP250814855484' });
    
    if (!order) {
      console.log('❌ Orden no encontrada');
      return;
    }
    
    console.log('\n📦 INFORMACIÓN DE LA ORDEN:');
    console.log('Order ID:', order._id);
    console.log('Order Number:', order.orderNumber);
    console.log('Status:', order.status);
    
    console.log('\n🏠 DELIVERY INFO:');
    console.log('deliveryInfo:', JSON.stringify(order.deliveryInfo, null, 2));
    console.log('deliveryAddress:', JSON.stringify(order.deliveryAddress, null, 2));
    console.log('customerAddress:', JSON.stringify(order.customerAddress, null, 2));
    
    console.log('\n🔍 CUSTOMER INFO:');
    if (order.customerId) {
      const customer = await User.findById(order.customerId);
      console.log('Customer:', customer?.name);
      console.log('Customer address:', customer?.address);
    }
    
    // Buscar todas las órdenes para ver estructura general
    console.log('\n📊 ANÁLISIS GENERAL DE ÓRDENES:');
    const allOrders = await Order.find({}).limit(5);
    
    allOrders.forEach((ord, i) => {
      console.log(`\nOrder ${i + 1} - ${ord.orderNumber}:`);
      console.log('  deliveryInfo.coordinates:', ord.deliveryInfo?.coordinates);
      console.log('  deliveryAddress:', ord.deliveryAddress);
      console.log('  customerAddress:', ord.customerAddress);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de MongoDB');
  }
}

debugOrderDeliveryInfo();