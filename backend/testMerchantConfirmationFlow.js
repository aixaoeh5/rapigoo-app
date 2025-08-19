/**
 * Script de prueba para verificar el flujo de confirmación del comerciante
 * Simula el proceso completo desde asignación hasta confirmación
 */

const mongoose = require('mongoose');
const Order = require('./models/Order');
const DeliveryTracking = require('./models/DeliveryTracking');
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

async function testMerchantConfirmationFlow() {
  console.log('\n🧪 === PRUEBA: FLUJO DE CONFIRMACIÓN DEL COMERCIANTE ===\n');
  
  try {
    // 1. Buscar una orden assigned con delivery
    console.log('📦 1. Buscando orden assigned con delivery...');
    const assignedOrder = await Order.findOne({
      status: 'assigned',
      deliveryPersonId: { $exists: true, $ne: null }
    }).populate('deliveryPersonId', 'name');
    
    if (!assignedOrder) {
      console.log('⚠️ No se encontró orden assigned con delivery. Creando datos de prueba...');
      return await createTestData();
    }
    
    console.log(`✅ Encontrada orden: ${assignedOrder.orderNumber}`);
    console.log(`   Delivery: ${assignedOrder.deliveryPersonId?.name || 'N/A'}`);
    
    // 2. Buscar delivery tracking correspondiente
    const deliveryTracking = await DeliveryTracking.findOne({
      orderId: assignedOrder._id
    });
    
    if (!deliveryTracking) {
      console.log('❌ No se encontró delivery tracking para la orden');
      return;
    }
    
    console.log(`✅ Delivery tracking encontrado: ${deliveryTracking._id}`);
    console.log(`   Estado actual: ${deliveryTracking.status}`);
    
    // 3. Simular llegada del delivery al pickup
    if (deliveryTracking.status !== 'at_pickup') {
      console.log('\n🚚 2. Simulando llegada del delivery al pickup...');
      
      await deliveryTracking.updateStatus(
        'heading_to_pickup',
        'Dirigiéndose al restaurante'
      );
      console.log('   Estado actualizado a: heading_to_pickup');
      
      // Simular llegada automática
      await deliveryTracking.updateStatus(
        'at_pickup',
        'Llegada detectada automáticamente'
      );
      console.log('   Estado actualizado a: at_pickup');
    }
    
    // 4. Verificar que el delivery no puede continuar manualmente
    console.log('\n🚫 3. Verificando que el delivery no puede continuar manualmente...');
    
    try {
      await deliveryTracking.updateStatus(
        'picked_up',
        'Intento manual del delivery'
      );
      console.log('❌ ERROR: El delivery pudo cambiar el estado manualmente (esto no debería pasar)');
    } catch (error) {
      console.log('✅ Correcto: El delivery no puede cambiar el estado manualmente');
      console.log(`   Error esperado: ${error.message}`);
    }
    
    // 5. Simular confirmación del comerciante
    console.log('\n🏪 4. Simulando confirmación del comerciante...');
    
    // Actualizar directamente usando el método del comerciante
    const operationId = `merchant_confirm_${Date.now()}_test`;
    await deliveryTracking.updateStatus(
      'picked_up',
      'Comerciante confirmó entrega al delivery',
      null,
      operationId
    );
    
    console.log('✅ Comerciante confirmó la entrega');
    console.log(`   Estado actualizado a: ${deliveryTracking.status}`);
    
    // Cambiar automáticamente a heading_to_delivery
    await deliveryTracking.updateStatus(
      'heading_to_delivery',
      'Dirigiéndose al cliente para entrega'
    );
    
    console.log('✅ Estado actualizado automáticamente a: heading_to_delivery');
    
    // 6. Verificar que el delivery ahora puede continuar
    console.log('\n✅ 5. Verificando que el delivery ahora puede continuar...');
    
    try {
      await deliveryTracking.updateStatus(
        'at_delivery',
        'Llegada al cliente'
      );
      console.log('✅ Correcto: El delivery puede continuar después de la confirmación del comerciante');
    } catch (error) {
      console.log(`❌ Error inesperado: ${error.message}`);
    }
    
    // 7. Verificar el estado final
    console.log('\n📊 6. Estado final del flujo:');
    const finalOrder = await Order.findById(assignedOrder._id);
    const finalDelivery = await DeliveryTracking.findById(deliveryTracking._id);
    
    console.log(`   Orden ${finalOrder.orderNumber}:`);
    console.log(`   - Estado orden: ${finalOrder.status}`);
    console.log(`   - Estado delivery: ${finalDelivery.status}`);
    console.log(`   - Pickup arrived: ${finalDelivery.pickupLocation?.arrived || false}`);
    console.log(`   - Delivery arrived: ${finalDelivery.deliveryLocation?.arrived || false}`);
    
    console.log('\n✅ Prueba del flujo de confirmación completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
}

async function createTestData() {
  console.log('\n🏗️ Creando datos de prueba...');
  
  // Buscar usuarios existentes
  const delivery = await User.findOne({ role: 'delivery' });
  const merchant = await User.findOne({ role: 'merchant' });
  const customer = await User.findOne({ role: 'customer' });
  
  if (!delivery || !merchant || !customer) {
    console.log('❌ No se encontraron usuarios necesarios (delivery, merchant, customer)');
    return;
  }
  
  console.log('✅ Usuarios encontrados para prueba');
  
  // Crear orden de prueba
  const testOrder = new Order({
    orderNumber: `TEST_${Date.now()}`,
    customerId: customer._id,
    merchantId: merchant._id,
    deliveryPersonId: delivery._id,
    status: 'assigned',
    items: [{
      serviceId: new mongoose.Types.ObjectId(),
      name: 'Producto de prueba',
      price: 100,
      quantity: 1
    }],
    total: 100,
    deliveryInfo: {
      address: {
        street: 'Calle de prueba 123',
        city: 'Santo Domingo'
      },
      coordinates: [-69.9312, 18.4861]
    }
  });
  
  await testOrder.save();
  console.log(`✅ Orden de prueba creada: ${testOrder.orderNumber}`);
  
  // Crear delivery tracking
  const testDelivery = new DeliveryTracking({
    orderId: testOrder._id,
    deliveryPersonId: delivery._id,
    status: 'assigned',
    pickupLocation: {
      coordinates: [-69.9000, 18.5000],
      address: 'Restaurante de prueba'
    },
    deliveryLocation: {
      coordinates: [-69.9312, 18.4861],
      address: 'Dirección del cliente'
    },
    isLive: true
  });
  
  await testDelivery.save();
  console.log(`✅ Delivery tracking creado: ${testDelivery._id}`);
  
  console.log('\n🔄 Reintentando prueba con datos nuevos...');
  await testMerchantConfirmationFlow();
}

async function main() {
  await connectToDatabase();
  await testMerchantConfirmationFlow();
  
  console.log('\n✅ Todas las pruebas completadas.');
  process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando pruebas:', error);
    process.exit(1);
  });
}

module.exports = { testMerchantConfirmationFlow };