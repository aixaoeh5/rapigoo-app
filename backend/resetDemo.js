const mongoose = require('mongoose');
const User = require('./models/User');
const Order = require('./models/Order');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetDemo() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔄 Resetting demo environment...');
    
    // 1. Clear existing demo data
    await Order.deleteMany({});
    await User.deleteMany({ email: { $regex: '@demo.com$' } });
    console.log('🗑️ Cleared existing demo data');
    
    // 2. Recreate demo accounts
    const DEMO_ACCOUNTS = [
      {
        name: 'Cliente Demo',
        email: 'cliente@demo.com',
        password: await bcrypt.hash('demo123', 10),
        role: 'cliente',
        isVerified: true,
        deliveryAddress: {
          coordinates: [-69.9312, 18.4861],
          street: 'Av. Winston Churchill 1234',
          city: 'Santo Domingo',
          state: 'Distrito Nacional'
        }
      },
      {
        name: 'Restaurante Demo',
        email: 'comerciante@demo.com',
        password: await bcrypt.hash('demo123', 10),
        role: 'comerciante',
        isVerified: true,
        merchantStatus: 'approved',
        businessInfo: {
          businessName: 'Restaurante La Demo',
          businessType: 'restaurant',
          address: 'Calle El Conde 567, Santo Domingo'
        }
      },
      {
        name: 'Delivery Demo',
        email: 'delivery@demo.com',
        password: await bcrypt.hash('demo123', 10),
        role: 'delivery',
        isVerified: true,
        deliveryStatus: 'active',
        location: {
          coordinates: [-69.9312, 18.4861],
          lastUpdated: new Date()
        }
      }
    ];
    
    for (const account of DEMO_ACCOUNTS) {
      const user = new User(account);
      await user.save();
      console.log(`✅ Created: ${account.email}`);
    }
    
    // 3. Create demo order ready for delivery
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
      status: 'ready_for_delivery',
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
      estimatedDeliveryTime: new Date(Date.now() + 30 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await demoOrder.save();
    console.log('✅ Created demo order:', demoOrder._id);
    
    console.log('\n🎬 DEMO RESET COMPLETE!');
    console.log('📧 Customer: cliente@demo.com / demo123');
    console.log('🏪 Merchant: comerciante@demo.com / demo123');
    console.log('🚚 Delivery: delivery@demo.com / demo123');
    console.log('📦 Order ID:', demoOrder._id);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting demo:', error);
    process.exit(1);
  }
}

resetDemo();