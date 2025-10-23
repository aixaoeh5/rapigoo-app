const mongoose = require('mongoose');
const Order = require('../models/Order');

async function migrateOrderVersioning() {
  try {
    // Connect to database
    require('dotenv').config();
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
    
    console.log('\n🔄 MIGRATING ORDER VERSIONING\n');
    
    // Find all orders without version field
    const ordersWithoutVersion = await Order.find({ __v: { $exists: false } });
    console.log(`📦 Found ${ordersWithoutVersion.length} orders without version field`);
    
    if (ordersWithoutVersion.length === 0) {
      console.log('✅ All orders already have version field');
      return;
    }
    
    // Add version field to all orders without it
    const result = await Order.updateMany(
      { __v: { $exists: false } },
      { $set: { __v: 0 } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} orders with version field`);
    
    // Verify migration
    const remainingOrders = await Order.find({ __v: { $exists: false } });
    if (remainingOrders.length === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log(`⚠️ ${remainingOrders.length} orders still missing version field`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  migrateOrderVersioning();
}

module.exports = { migrateOrderVersioning };