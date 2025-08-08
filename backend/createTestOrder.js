const mongoose = require('mongoose');
const Order = require('./models/Order');
const User = require('./models/User');
require('dotenv').config();

async function createTestOrder() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Find merchant
    const merchant = await User.findOne({ email: 'comerciante@test.com' });
    if (!merchant) {
      console.log('❌ No se encontró el comerciante');
      return;
    }
    console.log('👤 Comerciante encontrado:', merchant.name);

    // Find a customer
    let customer = await User.findOne({ email: 'cliente@test.com' });
    if (!customer) {
      customer = new User({
        name: 'Cliente Prueba',
        email: 'cliente@test.com',
        phone: '+1234567890',
        role: 'customer'
      });
      await customer.save();
      console.log('✅ Cliente de prueba creado');
    }

    // Create test order with all required fields
    const testOrder = new Order({
      customerId: customer._id,
      merchantId: merchant._id,
      orderNumber: 'TEST-' + Date.now(),
      items: [
        {
          serviceId: new mongoose.Types.ObjectId(),
          name: 'Pizza Margherita',
          description: 'Pizza con salsa de tomate, mozzarella y albahaca',
          price: 15.99,
          quantity: 2,
          subtotal: 31.98
        }
      ],
      subtotal: 31.98,
      deliveryFee: 3.50,
      serviceFee: 1.75,
      tax: 3.72,
      total: 40.95,
      status: 'pending',
      deliveryInfo: {
        address: {
          street: 'Calle Principal 123',
          city: 'Santo Domingo',
          state: 'Distrito Nacional',
          zipCode: '10101',
          coordinates: [-69.9312, 18.4861]
        },
        instructions: 'Casa azul con portón blanco',
        contactPhone: '+1234567890'
      },
      paymentInfo: {
        method: 'cash',
        amount: 40.95,
        status: 'pending'
      },
      platform: 'mobile'
    });

    await testOrder.save();
    console.log('✅ Orden de prueba creada:', testOrder.orderNumber);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

createTestOrder();