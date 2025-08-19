const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Importar modelos
const Order = require('./models/Order');
const User = require('./models/User');

async function checkOrdersInDB() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Conectado a MongoDB');
    
    // Buscar todos los usuarios
    const users = await User.find().select('_id name email role');
    console.log('\n👥 Usuarios en la base de datos:');
    users.forEach(user => {
      console.log(`   ${user.role}: ${user.name} (${user.email}) - ID: ${user._id}`);
    });
    
    // Buscar todos los pedidos
    const orders = await Order.find().populate('customerId merchantId');
    console.log(`\n📋 Total de pedidos en la base de datos: ${orders.length}`);
    
    if (orders.length > 0) {
      orders.forEach((order, index) => {
        console.log(`\n📦 Pedido ${index + 1}:`);
        console.log(`   ID: ${order._id}`);
        console.log(`   Number: ${order.orderNumber}`);
        console.log(`   Customer ID: ${order.customerId?._id || order.customerId}`);
        console.log(`   Customer Name: ${order.customerId?.name || 'No populated'}`);
        console.log(`   Merchant ID: ${order.merchantId?._id || order.merchantId}`);
        console.log(`   Merchant Name: ${order.merchantId?.name || 'No populated'}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: $${order.total}`);
        console.log(`   Items: ${order.items?.length || 0}`);
        console.log(`   Created: ${order.createdAt}`);
      });
    }
    
    // Buscar específicamente pedidos del cliente de prueba
    const testCustomer = await User.findOne({ email: 'cliente@test.com' });
    if (testCustomer) {
      console.log(`\n🔍 Buscando pedidos del cliente de prueba (ID: ${testCustomer._id})...`);
      const customerOrders = await Order.find({ customerId: testCustomer._id });
      console.log(`   Pedidos encontrados: ${customerOrders.length}`);
      
      if (customerOrders.length > 0) {
        customerOrders.forEach((order, index) => {
          console.log(`   Pedido ${index + 1}: ${order.orderNumber} - ${order.status}`);
        });
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Ejecutar la función
checkOrdersInDB();