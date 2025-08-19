/**
 * Script para probar la actualización automática de estadísticas
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

async function testStatsUpdate() {
  console.log('\n📊 === TEST: ACTUALIZACIÓN AUTOMÁTICA DE ESTADÍSTICAS ===\n');
  
  try {
    // 1. Buscar un pedido que pueda marcarse como delivered
    console.log('🔍 1. Buscando pedido apropiado para test...');
    let testOrder = await Order.findOne({
      status: { $in: ['picked_up', 'at_delivery'] },
      deliveryPersonId: { $ne: null }
    }).populate('merchantId', 'name business')
      .populate('deliveryPersonId', 'name deliveryStats')
      .populate('customerId', 'name');

    if (!testOrder) {
      console.log('❌ No se encontró pedido apropiado para test');
      console.log('💡 Creando pedido de prueba...');
      
      // Buscar usuarios para crear pedido de prueba
      const merchant = await User.findOne({ role: 'comerciante' });
      const customer = await User.findOne({ role: 'cliente' });
      const delivery = await User.findOne({ role: 'delivery' });
      
      if (!merchant || !customer || !delivery) {
        console.log('❌ No se encontraron usuarios necesarios para crear pedido de prueba');
        return;
      }
      
      // Crear pedido de prueba
      const newOrder = new Order({
        orderNumber: `TEST_STATS_${Date.now()}`,
        customerId: customer._id,
        merchantId: merchant._id,
        deliveryPersonId: delivery._id,
        status: 'picked_up',
        items: [{
          serviceId: new mongoose.Types.ObjectId(),
          name: 'Servicio de prueba para estadísticas',
          price: 50,
          quantity: 1,
          subtotal: 50
        }],
        subtotal: 50,
        deliveryFee: 5,
        serviceFee: 2.5,
        tax: 5,
        total: 62.5,
        paymentMethod: 'cash',
        deliveryInfo: {
          address: {
            street: 'Calle de prueba',
            city: 'Santo Domingo',
            state: 'Distrito Nacional',
            zipCode: '10100',
            coordinates: [-69.9312, 18.4861]
          },
          contactPhone: customer.phone || '8094567890',
          instructions: 'Prueba de estadísticas'
        },
        customerInfo: {
          name: customer.name,
          phone: customer.phone || '8094567890',
          email: customer.email
        },
        merchantInfo: {
          name: merchant.name,
          phone: merchant.phone || '8091234567'
        }
      });
      
      await newOrder.save();
      console.log(`✅ Pedido de prueba creado: ${newOrder.orderNumber}`);
      
      // Recargar con población
      testOrder = await Order.findById(newOrder._id)
        .populate('merchantId', 'name business')
        .populate('deliveryPersonId', 'name deliveryStats')
        .populate('customerId', 'name');
    }

    console.log(`📦 Pedido seleccionado: ${testOrder.orderNumber}`);
    console.log(`   Estado actual: ${testOrder.status}`);
    console.log(`   Comerciante: ${testOrder.merchantId?.name}`);
    console.log(`   Delivery: ${testOrder.deliveryPersonId?.name}`);
    console.log(`   Total: RD$${testOrder.total}`);

    // 2. Obtener estadísticas previas
    console.log('\n📊 2. Estadísticas previas...');
    
    const merchantBefore = await User.findById(testOrder.merchantId);
    const deliveryBefore = await User.findById(testOrder.deliveryPersonId);
    
    console.log('📈 Comerciante (antes):');
    console.log(`   Total pedidos: ${merchantBefore.business.stats?.totalOrders || 0}`);
    console.log(`   Pedidos completados: ${merchantBefore.business.stats?.completedOrders || 0}`);
    console.log(`   Ingresos totales: RD$${merchantBefore.business.stats?.totalRevenue || 0}`);
    
    console.log('🚚 Delivery (antes):');
    console.log(`   Total entregas: ${deliveryBefore.deliveryStats?.totalDeliveries || 0}`);
    console.log(`   Entregas completadas: ${deliveryBefore.deliveryStats?.completedDeliveries || 0}`);
    console.log(`   Ganancias totales: RD$${deliveryBefore.deliveryStats?.totalEarnings || 0}`);

    // 3. Marcar pedido como delivered
    console.log('\n🚀 3. Marcando pedido como delivered...');
    
    await testOrder.updateStatus('delivered', 'Test de actualización de estadísticas');
    
    console.log('✅ Pedido marcado como delivered');
    
    // 4. Esperar un momento para que se ejecute el post-save hook
    console.log('⏳ Esperando actualización de estadísticas...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Verificar estadísticas después
    console.log('\n📊 4. Estadísticas después...');
    
    const merchantAfter = await User.findById(testOrder.merchantId);
    const deliveryAfter = await User.findById(testOrder.deliveryPersonId);
    
    console.log('📈 Comerciante (después):');
    console.log(`   Total pedidos: ${merchantAfter.business.stats?.totalOrders || 0}`);
    console.log(`   Pedidos completados: ${merchantAfter.business.stats?.completedOrders || 0}`);
    console.log(`   Ingresos totales: RD$${merchantAfter.business.stats?.totalRevenue || 0}`);
    
    console.log('🚚 Delivery (después):');
    console.log(`   Total entregas: ${deliveryAfter.deliveryStats?.totalDeliveries || 0}`);
    console.log(`   Entregas completadas: ${deliveryAfter.deliveryStats?.completedDeliveries || 0}`);
    console.log(`   Ganancias totales: RD$${deliveryAfter.deliveryStats?.totalEarnings || 0}`);

    // 6. Verificar incrementos
    console.log('\n🔍 5. Verificación de incrementos...');
    
    const merchantStatsIncreased = (merchantAfter.business.stats?.completedOrders || 0) > (merchantBefore.business.stats?.completedOrders || 0);
    const deliveryStatsIncreased = (deliveryAfter.deliveryStats?.completedDeliveries || 0) > (deliveryBefore.deliveryStats?.completedDeliveries || 0);
    
    if (merchantStatsIncreased) {
      console.log('✅ Estadísticas del comerciante actualizadas correctamente');
    } else {
      console.log('❌ Estadísticas del comerciante NO se actualizaron');
    }
    
    if (deliveryStatsIncreased) {
      console.log('✅ Estadísticas del delivery actualizadas correctamente');
    } else {
      console.log('❌ Estadísticas del delivery NO se actualizaron');
    }

    // 7. Test de endpoints
    console.log('\n🌐 6. Probando endpoints de estadísticas...');
    console.log(`   📱 GET /api/merchant/stats (Merchant ID: ${testOrder.merchantId._id})`);
    console.log(`   🚚 GET /api/delivery/stats (Delivery ID: ${testOrder.deliveryPersonId._id})`);
    console.log('\n💡 Usa estos endpoints en tu frontend para mostrar las estadísticas actualizadas');

  } catch (error) {
    console.error('❌ Error durante el test:', error);
  }
}

async function main() {
  await connectToDatabase();
  await testStatsUpdate();
  
  console.log('\n✅ Test completado.');
  process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando test:', error);
    process.exit(1);
  });
}

module.exports = { testStatsUpdate };