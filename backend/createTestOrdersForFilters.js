/**
 * Script para crear pedidos de prueba para verificar filtros
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

async function createTestOrders() {
  console.log('\n🏗️ === CREANDO PEDIDOS DE PRUEBA PARA FILTROS ===\n');
  
  try {
    // 1. Buscar usuarios necesarios
    console.log('👥 1. Buscando usuarios...');
    const merchant = await User.findOne({ 
      $or: [{ role: 'merchant' }, { role: 'comerciante' }]
    });
    const customer = await User.findOne({ 
      $or: [{ role: 'customer' }, { role: 'cliente' }]
    });
    const delivery = await User.findOne({ role: 'delivery' });
    
    if (!merchant) {
      console.log('❌ No se encontró comerciante');
      return;
    }
    if (!customer) {
      console.log('❌ No se encontró cliente');
      return;
    }
    
    console.log(`✅ Comerciante: ${merchant.name} (${merchant._id})`);
    console.log(`✅ Cliente: ${customer.name} (${customer._id})`);
    console.log(`✅ Delivery: ${delivery?.name || 'No disponible'} (${delivery?._id || 'N/A'})`);
    
    // 2. Crear pedidos en diferentes estados
    console.log('\n📦 2. Creando pedidos de prueba...');
    
    const testOrders = [
      {
        status: 'pending',
        description: 'Pedido pendiente de confirmación'
      },
      {
        status: 'confirmed', 
        description: 'Pedido confirmado'
      },
      {
        status: 'preparing',
        description: 'Pedido en preparación'
      },
      {
        status: 'ready',
        description: 'Pedido listo (sin delivery asignado)'
      },
      {
        status: 'ready',
        description: 'Pedido listo (sin delivery asignado) #2'
      },
      {
        status: 'assigned',
        description: 'Pedido con delivery asignado',
        deliveryPersonId: delivery?._id || null
      },
      {
        status: 'picked_up',
        description: 'Delivery recogió el pedido',
        deliveryPersonId: delivery?._id || null
      }
    ];
    
    const createdOrders = [];
    
    for (let i = 0; i < testOrders.length; i++) {
      const testOrder = testOrders[i];
      
      const orderNumber = `TEST_FILTER_${Date.now()}_${i + 1}`;
      
      const order = new Order({
        orderNumber,
        customerId: customer._id,
        merchantId: merchant._id,
        deliveryPersonId: testOrder.deliveryPersonId,
        status: testOrder.status,
        items: [{
          serviceId: new mongoose.Types.ObjectId(),
          name: `Servicio de prueba ${i + 1}`,
          price: 10 + i,
          quantity: 1,
          subtotal: 10 + i
        }],
        subtotal: 10 + i,
        deliveryFee: 2.50,
        serviceFee: (10 + i) * 0.05,
        tax: (10 + i) * 0.1,
        total: (10 + i) + 2.50 + ((10 + i) * 0.05) + ((10 + i) * 0.1),
        paymentMethod: 'cash',
        deliveryInfo: {
          address: {
            street: `Calle de prueba ${i + 1}`,
            city: 'Santo Domingo',
            state: 'Distrito Nacional',
            zipCode: '10100',
            coordinates: [-69.9312 + (i * 0.001), 18.4861 + (i * 0.001)]
          },
          contactPhone: customer.phone || '8094567890',
          instructions: `Instrucciones de entrega ${i + 1}`
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
      
      await order.save();
      createdOrders.push(order);
      
      console.log(`✅ Creado: ${orderNumber} - ${testOrder.description}`);
    }
    
    // 3. Verificar que se crearon correctamente
    console.log('\n🔍 3. Verificando pedidos creados...');
    
    const allOrders = await Order.find({ merchantId: merchant._id })
      .populate('deliveryPersonId', 'name')
      .sort({ createdAt: -1 });
    
    console.log(`📊 Total de pedidos del comerciante: ${allOrders.length}`);
    
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
        const deliveryName = order.deliveryPersonId?.name || 'Sin asignar';
        console.log(`      - ${order.orderNumber}: delivery="${deliveryName}"`);
      });
    });
    
    // 4. Probar filtro ready_and_assigned
    console.log('\n🎯 4. Probando filtro "ready_and_assigned"...');
    const statusArray = ['ready', 'assigned', 'picked_up'];
    const filteredOrders = await Order.find({
      merchantId: merchant._id,
      status: { $in: statusArray }
    }).populate('deliveryPersonId', 'name');
    
    console.log(`📋 Pedidos en filtro "ready_and_assigned": ${filteredOrders.length}`);
    filteredOrders.forEach(order => {
      const deliveryName = order.deliveryPersonId?.name || 'Sin asignar';
      console.log(`   - ${order.orderNumber}: estado="${order.status}", delivery="${deliveryName}"`);
    });
    
    console.log('\n🎯 Ahora puedes probar el filtro en la app del comerciante!');
    console.log(`📱 Merchant ID: ${merchant._id}`);
    console.log(`🔐 Inicia sesión como: ${merchant.email}`);
    
  } catch (error) {
    console.error('❌ Error creando pedidos de prueba:', error);
  }
}

async function main() {
  await connectToDatabase();
  await createTestOrders();
  
  console.log('\n✅ Creación de pedidos de prueba completada.');
  process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando script:', error);
    process.exit(1);
  });
}

module.exports = { createTestOrders };