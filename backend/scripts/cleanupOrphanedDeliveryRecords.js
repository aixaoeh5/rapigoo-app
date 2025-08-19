const mongoose = require('mongoose');
const DeliveryTracking = require('../models/DeliveryTracking');
const Order = require('../models/Order');

async function cleanupOrphanedDeliveryRecords() {
  try {
    // Connect to database
    require('dotenv').config();
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
    
    console.log('\n🧹 CLEANING UP ORPHANED DELIVERY RECORDS\n');
    
    // Find all DeliveryTracking records
    const allDeliveries = await DeliveryTracking.find({});
    console.log(`📦 Total DeliveryTracking records: ${allDeliveries.length}`);
    
    const orphanedRecords = [];
    const validRecords = [];
    
    // Check each delivery record
    for (const delivery of allDeliveries) {
      if (!delivery.orderId) {
        console.log(`❌ Found delivery with null orderId: ${delivery._id}`);
        orphanedRecords.push(delivery);
        continue;
      }
      
      const order = await Order.findById(delivery.orderId);
      if (!order) {
        console.log(`❌ Found orphaned delivery ${delivery._id} -> invalid order ${delivery.orderId}`);
        orphanedRecords.push(delivery);
      } else {
        validRecords.push(delivery);
      }
    }
    
    console.log(`\n📊 Analysis:`);
    console.log(`- Valid records: ${validRecords.length}`);
    console.log(`- Orphaned records: ${orphanedRecords.length}`);
    
    if (orphanedRecords.length === 0) {
      console.log('✅ No orphaned records found. Database is clean!');
      return;
    }
    
    console.log(`\n🗑️ Deleting ${orphanedRecords.length} orphaned records...`);
    
    // Delete orphaned records
    const deleteResults = [];
    for (const orphaned of orphanedRecords) {
      try {
        await DeliveryTracking.findByIdAndDelete(orphaned._id);
        console.log(`✅ Deleted orphaned delivery: ${orphaned._id}`);
        deleteResults.push({ id: orphaned._id, status: 'deleted' });
      } catch (error) {
        console.error(`❌ Failed to delete ${orphaned._id}:`, error.message);
        deleteResults.push({ id: orphaned._id, status: 'failed', error: error.message });
      }
    }
    
    const successfulDeletes = deleteResults.filter(r => r.status === 'deleted').length;
    const failedDeletes = deleteResults.filter(r => r.status === 'failed').length;
    
    console.log(`\n📈 Cleanup Results:`);
    console.log(`- Successfully deleted: ${successfulDeletes}`);
    console.log(`- Failed to delete: ${failedDeletes}`);
    
    if (failedDeletes > 0) {
      console.log('\n❌ Failed deletions:');
      deleteResults.filter(r => r.status === 'failed').forEach(result => {
        console.log(`  - ${result.id}: ${result.error}`);
      });
    }
    
    // Verify cleanup
    const remainingOrphaned = await DeliveryTracking.find({ orderId: null });
    console.log(`\n🔍 Post-cleanup verification:`);
    console.log(`- Remaining records with null orderId: ${remainingOrphaned.length}`);
    
    if (remainingOrphaned.length === 0) {
      console.log('✅ Database cleanup completed successfully!');
    } else {
      console.log('⚠️ Some orphaned records still remain. Manual intervention may be needed.');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Export for use in other scripts
module.exports = { cleanupOrphanedDeliveryRecords };

// Run directly if called as script
if (require.main === module) {
  cleanupOrphanedDeliveryRecords();
}