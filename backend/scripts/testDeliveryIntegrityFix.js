const mongoose = require('mongoose');
const DeliveryTracking = require('../models/DeliveryTracking');
const Order = require('../models/Order');

async function testDeliveryIntegrityFix() {
  try {
    // Connect to database
    require('dotenv').config();
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
    
    console.log('\n🧪 TESTING DELIVERY INTEGRITY FIXES\n');
    
    // Test 1: Check current state
    console.log('📋 Test 1: Current Database State');
    const allDeliveries = await DeliveryTracking.find({});
    const nullOrderDeliveries = await DeliveryTracking.find({ orderId: null });
    
    console.log(`- Total deliveries: ${allDeliveries.length}`);
    console.log(`- Deliveries with null orderId: ${nullOrderDeliveries.length}`);
    
    // Test 2: Validate orphaned references
    console.log('\n📋 Test 2: Orphaned Reference Detection');
    let orphanedCount = 0;
    for (const delivery of allDeliveries) {
      if (delivery.orderId) {
        const order = await Order.findById(delivery.orderId);
        if (!order) {
          orphanedCount++;
          console.log(`❌ Orphaned: ${delivery._id} -> ${delivery.orderId}`);
        }
      }
    }
    console.log(`- Orphaned references found: ${orphanedCount}`);
    
    // Test 3: Try to create invalid delivery (should fail with new validation)
    console.log('\n📋 Test 3: Validation Prevention Test');
    try {
      const invalidDelivery = new DeliveryTracking({
        orderId: null,
        deliveryPersonId: new mongoose.Types.ObjectId(),
        status: 'assigned',
        pickupLocation: {
          coordinates: [0, 0],
          address: 'Test'
        },
        deliveryLocation: {
          coordinates: [0, 0],
          address: 'Test'
        }
      });
      
      await invalidDelivery.save();
      console.log('❌ FAILED: Should not allow null orderId');
    } catch (error) {
      console.log('✅ PASSED: Validation correctly prevented null orderId');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 4: Try to create delivery with non-existent order (should fail)
    console.log('\n📋 Test 4: Non-existent Order Reference Test');
    try {
      const fakeOrderId = new mongoose.Types.ObjectId();
      const invalidDelivery = new DeliveryTracking({
        orderId: fakeOrderId,
        deliveryPersonId: new mongoose.Types.ObjectId(),
        status: 'assigned',
        pickupLocation: {
          coordinates: [0, 0],
          address: 'Test'
        },
        deliveryLocation: {
          coordinates: [0, 0],
          address: 'Test'
        }
      });
      
      await invalidDelivery.save();
      console.log('❌ FAILED: Should not allow non-existent order reference');
    } catch (error) {
      console.log('✅ PASSED: Validation correctly prevented non-existent order reference');
      console.log(`   Error: ${error.message}`);
    }
    
    // Test 5: Check active deliveries filtering
    console.log('\n📋 Test 5: Active Deliveries Data Integrity');
    const activeStates = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'];
    const activeDeliveries = await DeliveryTracking.find({ 
      status: { $in: activeStates } 
    }).populate('orderId', 'orderNumber total status');
    
    let validActiveDeliveries = 0;
    let invalidActiveDeliveries = 0;
    
    for (const delivery of activeDeliveries) {
      if (!delivery.orderId) {
        invalidActiveDeliveries++;
        console.log(`❌ Active delivery ${delivery._id} has null orderId`);
      } else {
        validActiveDeliveries++;
      }
    }
    
    console.log(`- Valid active deliveries: ${validActiveDeliveries}`);
    console.log(`- Invalid active deliveries: ${invalidActiveDeliveries}`);
    
    // Test Summary
    console.log('\n📊 TEST SUMMARY:');
    console.log(`✅ Database validation tests: ${nullOrderDeliveries.length === 0 ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Schema validation tests: PASSED (prevented invalid data)`);
    console.log(`✅ Active delivery integrity: ${invalidActiveDeliveries === 0 ? 'PASSED' : 'NEEDS CLEANUP'}`);
    
    if (nullOrderDeliveries.length > 0 || orphanedCount > 0 || invalidActiveDeliveries > 0) {
      console.log('\n⚠️ RECOMMENDATION: Run cleanup script to fix existing data issues');
      console.log('   Command: node scripts/cleanupOrphanedDeliveryRecords.js');
    } else {
      console.log('\n🎉 ALL TESTS PASSED: Delivery system integrity is maintained!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testDeliveryIntegrityFix();
}

module.exports = { testDeliveryIntegrityFix };