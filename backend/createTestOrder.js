const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Importar modelos
const Order = require('./models/Order');
const User = require('./models/User');
const Service = require('./models/Service');

async function createTestOrder() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Conectado a MongoDB');
    
    // Buscar un cliente (consumidor)
    const customer = await User.findOne({ role: 'cliente' });
    if (!customer) {
      console.log('❌ No se encontró ningún cliente en la base de datos');
      process.exit(1);
    }
    
    // Buscar un comerciante
    const merchant = await User.findOne({ role: 'comerciante' });
    if (!merchant) {
      console.log('❌ No se encontró ningún comerciante en la base de datos');
      process.exit(1);
    }
    
    console.log(`👤 Cliente: ${customer.name} (${customer.email})`);
    console.log(`🏪 Comerciante: ${merchant.name} (${merchant.email})`);
    
    // Crear order items ficticios
    const orderItems = [
      {
        serviceId: new mongoose.Types.ObjectId(),
        name: 'Producto Test 1',
        quantity: 2,
        price: 15.50,
        subtotal: 15.50 * 2
      },
      {
        serviceId: new mongoose.Types.ObjectId(),
        name: 'Producto Test 2',
        quantity: 1,
        price: 25.00,
        subtotal: 25.00 * 1
      }
    ];
    
    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = 5;
    const total = subtotal + deliveryFee;
    
    // Crear el pedido
    const newOrder = new Order({
      orderNumber: `ORD-${Date.now()}`,
      customerId: customer._id,
      merchantId: merchant._id,
      items: orderItems,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: total,
      status: 'pending',
      paymentInfo: {
        method: 'cash',
        status: 'pending',
        amount: total
      },
      deliveryAddress: {
        street: 'Calle Prueba 123',
        city: 'Ciudad Prueba',
        coordinates: {
          latitude: -12.0464,
          longitude: -77.0428
        }
      },
      customerInfo: {
        name: customer.name,
        phone: customer.phone || '987654321',
        email: customer.email
      },
      merchantInfo: {
        name: merchant.name,
        businessName: merchant.business?.businessName || merchant.name,
        address: merchant.business?.address || 'Dirección del negocio',
        phone: merchant.business?.phone || merchant.phone || '123456789'
      }
    });
    
    await newOrder.save();
    
    console.log('✅ Pedido de prueba creado exitosamente:');
    console.log(`   - Order Number: ${newOrder.orderNumber}`);
    console.log(`   - Customer ID: ${newOrder.customerId}`);
    console.log(`   - Merchant ID: ${newOrder.merchantId}`);
    console.log(`   - Total: $${newOrder.total}`);
    console.log(`   - Items: ${newOrder.items.length}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creando pedido de prueba:', error);
    process.exit(1);
  }
}

// Ejecutar la función
createTestOrder();