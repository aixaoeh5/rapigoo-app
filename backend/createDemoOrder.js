const mongoose = require('mongoose');
const Order = require('./models/Order');
require('dotenv').config();

// Create demo order for delivery testing
async function createDemoOrder() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Delete existing demo orders
    await Order.deleteMany({ customer: 'demo-customer-1' });
    
    const demoOrder = new Order({
      customer: 'demo-customer-1',
      customerName: 'Cliente Demo',
      merchant: 'demo-merchant-1',
      merchantName: 'Restaurante La Demo',
      items: [
        {
          name: 'Pizza Margherita',
          price: 12.99,
          quantity: 1,
          total: 12.99
        }
      ],
      subtotal: 12.99,
      deliveryFee: 2.50,
      total: 15.49,
      status: 'ready_for_delivery', // Ready for delivery pickup
      paymentMethod: 'cash',
      deliveryAddress: {
        street: 'Av. Winston Churchill 1234',
        city: 'Santo Domingo',
        coordinates: [-69.9312, 18.4861]
      },
      merchantAddress: {
        street: 'Calle El Conde 567',
        city: 'Santo Domingo',
        coordinates: [-69.9310, 18.4860]
      },
      estimatedDeliveryTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await demoOrder.save();
    console.log('✅ Demo order created:', demoOrder._id);
    console.log('🚚 Order status:', demoOrder.status);
    console.log('📍 Delivery address:', demoOrder.deliveryAddress.street);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating demo order:', error);
    process.exit(1);
  }
}

createDemoOrder();