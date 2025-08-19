const mongoose = require('mongoose');
const DeliveryTracking = require('../models/DeliveryTracking');
const Order = require('../models/Order');

async function checkOrphanedDeliveryRecords() {
  try {
    // Connect to database
    require('dotenv').config();
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
    
    console.log('\n🔍 CHECKING ORPHANED DELIVERY RECORDS\n');
    
    // Find all DeliveryTracking records
    const allDeliveries = await DeliveryTracking.find({});
    console.log(`📦 Total DeliveryTracking records: ${allDeliveries.length}`);
    
    // Check for null orderIds
    const nullOrderIds = await DeliveryTracking.find({ orderId: null });
    console.log(`❌ Records with null orderId: ${nullOrderIds.length}`);
    
    if (nullOrderIds.length > 0) {
      console.log('\n❌ CRITICAL ISSUE: Records with null orderId found:');
      nullOrderIds.forEach((delivery, index) => {
        console.log(`  ${index + 1}. ID: ${delivery._id}, Status: ${delivery.status}, Created: ${delivery.createdAt}`);
      });
    }
    
    // Check for undefined orderIds
    const undefinedOrderIds = await DeliveryTracking.find({ orderId: { $exists: false } });
    console.log(`❌ Records with undefined orderId: ${undefinedOrderIds.length}`);
    
    if (undefinedOrderIds.length > 0) {
      console.log('\n❌ CRITICAL ISSUE: Records with undefined orderId found:');
      undefinedOrderIds.forEach((delivery, index) => {
        console.log(`  ${index + 1}. ID: ${delivery._id}, Status: ${delivery.status}, Created: ${delivery.createdAt}`);
      });
    }
    
    // Check for invalid ObjectId references
    let invalidOrderRefs = 0;
    const validDeliveries = [];
    
    for (const delivery of allDeliveries) {
      if (delivery.orderId) {
        const order = await Order.findById(delivery.orderId);
        if (!order) {
          invalidOrderRefs++;
          console.log(`❌ Orphaned reference: DeliveryTracking ${delivery._id} references non-existent Order ${delivery.orderId}`);
        } else {
          validDeliveries.push(delivery);
        }
      }
    }
    
    console.log(`\n❌ Records with invalid Order references: ${invalidOrderRefs}`);
    console.log(`✅ Valid DeliveryTracking records: ${validDeliveries.length}`);
    
    // Check active deliveries specifically
    const activeStatuses = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'];
    const activeDeliveries = await DeliveryTracking.find({ 
      status: { $in: activeStatuses } 
    });
    
    console.log(`\n🚚 Active deliveries: ${activeDeliveries.length}`);
    
    let activeWithNullOrder = 0;
    let activeWithInvalidOrder = 0;
    
    for (const delivery of activeDeliveries) {
      if (!delivery.orderId) {
        activeWithNullOrder++;
        console.log(`❌ CRITICAL: Active delivery ${delivery._id} has null orderId, Status: ${delivery.status}`);
      } else {
        const order = await Order.findById(delivery.orderId);
        if (!order) {
          activeWithInvalidOrder++;
          console.log(`❌ CRITICAL: Active delivery ${delivery._id} references invalid order ${delivery.orderId}`);
        }
      }
    }
    
    console.log(`❌ Active deliveries with null orderId: ${activeWithNullOrder}`);
    console.log(`❌ Active deliveries with invalid orderId: ${activeWithInvalidOrder}`);
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`- Total DeliveryTracking records: ${allDeliveries.length}`);
    console.log(`- Records with null orderId: ${nullOrderIds.length}`);
    console.log(`- Records with undefined orderId: ${undefinedOrderIds.length}`);
    console.log(`- Records with invalid Order references: ${invalidOrderRefs}`);
    console.log(`- Active deliveries with data integrity issues: ${activeWithNullOrder + activeWithInvalidOrder}`);
    
    const totalIssues = nullOrderIds.length + undefinedOrderIds.length + invalidOrderRefs;
    if (totalIssues > 0) {
      console.log(`\n🚨 TOTAL DATA INTEGRITY ISSUES: ${totalIssues}`);
      console.log('These issues are causing the null reference errors in the frontend!');
    } else {
      console.log('\n✅ NO DATA INTEGRITY ISSUES FOUND');
    }
    
  } catch (error) {
    console.error('❌ Error checking orphaned records:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the check
checkOrphanedDeliveryRecords();