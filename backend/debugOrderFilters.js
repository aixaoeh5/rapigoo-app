/**
 * Script de debug para verificar filtros de pedidos del comerciante
 */

const mongoose = require('mongoose');
const Order = require('./models/Order');
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

async function debugOrderFilters() {
  console.log('\n🔍 === DEBUG: FILTROS DE PEDIDOS DEL COMERCIANTE ===\n');
  
  try {
    // 1. Buscar un comerciante
    console.log('👨‍💼 1. Buscando comerciante...');
    const merchant = await User.findOne({ 
      $or: [
        { role: 'merchant' },
        { role: 'comerciante' }
      ]
    });
    
    if (!merchant) {
      console.log('❌ No se encontró comerciante en la base de datos');
      return;
    }
    
    console.log(`✅ Comerciante encontrado: ${merchant.name} (${merchant._id})`);
    
    // 2. Buscar todos los pedidos del comerciante
    console.log('\n📦 2. Analizando todos los pedidos del comerciante...');
    const allOrders = await Order.find({ merchantId: merchant._id })
      .populate('deliveryPersonId', 'name')
      .sort({ createdAt: -1 });
    
    console.log(`📊 Total de pedidos del comerciante: ${allOrders.length}`);
    
    // 3. Agrupar por estado
    const ordersByStatus = {};
    allOrders.forEach(order => {
      const status = order.status;
      if (!ordersByStatus[status]) {
        ordersByStatus[status] = [];
      }
      ordersByStatus[status].push(order);
    });
    
    console.log('\n📈 Distribución por estados:');
    Object.keys(ordersByStatus).forEach(status => {
      console.log(`   ${status}: ${ordersByStatus[status].length} pedidos`);
      ordersByStatus[status].forEach(order => {
        console.log(`      - Pedido ${order.orderNumber}: delivery=${!!order.deliveryPersonId}`);
      });
    });
    
    // 4. Simular query del filtro "ready_and_assigned"
    console.log('\n🎯 3. Simulando filtro "ready_and_assigned"...');
    const statusArray = ['ready', 'assigned', 'picked_up'];
    const filteredQuery = {
      merchantId: merchant._id,
      status: { $in: statusArray }
    };
    
    console.log('Query simulada:', JSON.stringify(filteredQuery, null, 2));
    
    const filteredOrders = await Order.find(filteredQuery)
      .populate('deliveryPersonId', 'name')
      .sort({ createdAt: -1 });
    
    console.log(`\n📋 Resultados del filtro "ready_and_assigned": ${filteredOrders.length} pedidos`);
    filteredOrders.forEach(order => {
      console.log(`   - ${order.orderNumber}: estado="${order.status}", delivery="${order.deliveryPersonId?.name || 'Sin asignar'}"`);
    });
    
    // 5. Verificar query individual por estado
    console.log('\n🔍 4. Verificando queries individuales...');
    for (const status of statusArray) {
      const individualQuery = {
        merchantId: merchant._id,
        status: status
      };
      
      const individualOrders = await Order.find(individualQuery);
      console.log(`   ${status}: ${individualOrders.length} pedidos`);
      individualOrders.forEach(order => {
        console.log(`      - ${order.orderNumber}`);
      });
    }
    
    // 6. Verificar endpoint específico
    console.log('\n🌐 5. Verificando endpoint /orders/merchant/list...');
    console.log('Para probar el endpoint manualmente:');
    console.log(`GET /api/orders/merchant/list?status=ready,assigned,picked_up`);
    console.log(`Authorization: Bearer [TOKEN_DEL_COMERCIANTE]`);
    console.log(`Merchant ID: ${merchant._id}`);
    
    // 7. Recomendaciones
    console.log('\n💡 6. Recomendaciones:');
    console.log('1. Verificar que el frontend envía el parámetro status correctamente');
    console.log('2. Verificar que el backend procesa la cadena con comas');
    console.log('3. Verificar logs del servidor cuando se hace la petición');
    console.log('4. Verificar que el token del comerciante es válido');
    
  } catch (error) {
    console.error('❌ Error durante el debug:', error);
  }
}

async function main() {
  await connectToDatabase();
  await debugOrderFilters();
  
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

module.exports = { debugOrderFilters };