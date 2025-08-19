const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

// Demo accounts for presentation
const DEMO_ACCOUNTS = [
  {
    name: 'Cliente Demo',
    email: 'cliente@demo.com',
    password: 'demo123',
    role: 'cliente',
    isVerified: true,
    deliveryAddress: {
      coordinates: [-69.9312, 18.4861], // Santo Domingo coords
      street: 'Av. Winston Churchill 1234',
      city: 'Santo Domingo',
      state: 'Distrito Nacional'
    }
  },
  {
    name: 'Restaurante Demo',
    email: 'comerciante@demo.com',
    password: 'demo123',
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
    password: 'demo123',
    role: 'delivery',
    isVerified: true,
    deliveryStatus: 'active',
    location: {
      coordinates: [-69.9312, 18.4861],
      lastUpdated: new Date()
    }
  }
];

async function createDemoAccounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing demo accounts
    await User.deleteMany({ email: { $in: DEMO_ACCOUNTS.map(acc => acc.email) } });
    console.log('🗑️ Cleared existing demo accounts');
    
    // Create new demo accounts
    for (const account of DEMO_ACCOUNTS) {
      const hashedPassword = await bcrypt.hash(account.password, 10);
      const user = new User({
        ...account,
        password: hashedPassword
      });
      
      await user.save();
      console.log(`✅ Created demo account: ${account.email} (${account.role})`);
    }
    
    console.log('\n🎬 DEMO ACCOUNTS READY:');
    console.log('Customer: cliente@demo.com / demo123');
    console.log('Merchant: comerciante@demo.com / demo123');
    console.log('Delivery: delivery@demo.com / demo123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating demo accounts:', error);
    process.exit(1);
  }
}

createDemoAccounts();