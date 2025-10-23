#!/usr/bin/env node

/**
 * Migration Script for ParallelSaveError Fix
 * Adds new concurrency control fields to existing DeliveryTracking documents
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function migrateDeliveryTracking() {
  console.log('🔄 Starting DeliveryTracking Migration');
  console.log('=====================================');

  try {
    // Connect to database
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';
    console.log('🔌 Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Database connected');

    // Get the DeliveryTracking collection
    const db = mongoose.connection.db;
    const collection = db.collection('deliverytrackings');

    // Check current state
    const totalDocuments = await collection.countDocuments();
    console.log(`📊 Total DeliveryTracking documents: ${totalDocuments}`);

    if (totalDocuments === 0) {
      console.log('ℹ️ No documents to migrate');
      return;
    }

    // Check for existing version field
    const documentsWithVersion = await collection.countDocuments({ version: { $exists: true } });
    console.log(`📈 Documents with version field: ${documentsWithVersion}`);

    if (documentsWithVersion === totalDocuments) {
      console.log('✅ All documents already migrated');
      return;
    }

    const documentsToMigrate = totalDocuments - documentsWithVersion;
    console.log(`🔄 Documents to migrate: ${documentsToMigrate}`);

    // Backup collection first
    console.log('💾 Creating backup...');
    const backupCollectionName = `deliverytrackings_backup_${Date.now()}`;
    await db.createCollection(backupCollectionName);
    
    const documentsToBackup = await collection.find({}).toArray();
    if (documentsToBackup.length > 0) {
      await db.collection(backupCollectionName).insertMany(documentsToBackup);
      console.log(`✅ Backup created: ${backupCollectionName} (${documentsToBackup.length} documents)`);
    }

    // Perform migration in batches
    const batchSize = 100;
    let migratedCount = 0;
    let batchNumber = 1;

    console.log('🔄 Starting migration...');

    while (true) {
      // Find documents without version field
      const documentsToUpdate = await collection
        .find({ version: { $exists: false } })
        .limit(batchSize)
        .toArray();

      if (documentsToUpdate.length === 0) {
        break; // No more documents to migrate
      }

      console.log(`📦 Processing batch ${batchNumber} (${documentsToUpdate.length} documents)`);

      // Prepare bulk operations
      const bulkOps = documentsToUpdate.map(doc => ({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              version: 0,
              operationLock: null,
              lastOperationId: null
            }
          }
        }
      }));

      // Execute bulk update
      const result = await collection.bulkWrite(bulkOps);
      migratedCount += result.modifiedCount;

      console.log(`✅ Batch ${batchNumber} completed: ${result.modifiedCount} documents updated`);
      batchNumber++;

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🎉 Migration completed successfully!`);
    console.log(`📊 Total documents migrated: ${migratedCount}`);

    // Create indexes for new fields
    console.log('🔍 Creating indexes...');
    
    try {
      // Index for operationLock with TTL
      await collection.createIndex(
        { operationLock: 1 },
        { 
          expireAfterSeconds: 30,
          name: 'operationLock_ttl',
          sparse: true // Only index documents that have the field
        }
      );
      console.log('✅ Created TTL index for operationLock');

      // Index for version field
      await collection.createIndex(
        { version: 1 },
        { name: 'version_1' }
      );
      console.log('✅ Created index for version field');

      // Compound index for optimistic locking queries
      await collection.createIndex(
        { _id: 1, version: 1 },
        { name: 'id_version_compound' }
      );
      console.log('✅ Created compound index for _id and version');

    } catch (indexError) {
      console.warn('⚠️ Some indexes may already exist:', indexError.message);
    }

    // Verify migration
    console.log('🔍 Verifying migration...');
    const verificationResult = await collection.countDocuments({
      version: { $exists: true },
      operationLock: { $exists: true },
      lastOperationId: { $exists: true }
    });

    if (verificationResult === totalDocuments) {
      console.log('✅ Migration verification successful');
      console.log(`📊 All ${totalDocuments} documents have new fields`);
    } else {
      throw new Error(`Migration verification failed: ${verificationResult}/${totalDocuments} documents have new fields`);
    }

    // List created indexes
    console.log('📋 Listing indexes:');
    const indexes = await collection.listIndexes().toArray();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('');
    console.log('🎯 Migration Summary:');
    console.log(`  • Total documents: ${totalDocuments}`);
    console.log(`  • Documents migrated: ${migratedCount}`);
    console.log(`  • Backup collection: ${backupCollectionName}`);
    console.log(`  • New indexes created: 3`);
    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run validation script: node scripts/validateParallelSaveFix.js');
    console.log('2. Deploy updated application code');
    console.log('3. Monitor delivery operations for stability');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('');
    console.log('🔄 Rollback instructions:');
    console.log('If you need to rollback, you can restore from the backup collection created.');
    console.log('However, the new fields are data-safe and can be left in place.');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
}

// Utility function to check migration status
async function checkMigrationStatus() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';
    await mongoose.connect(mongoUri);
    
    const db = mongoose.connection.db;
    const collection = db.collection('deliverytrackings');
    
    const total = await collection.countDocuments();
    const migrated = await collection.countDocuments({
      version: { $exists: true },
      operationLock: { $exists: true },
      lastOperationId: { $exists: true }
    });
    
    console.log('Migration Status:');
    console.log(`  Total documents: ${total}`);
    console.log(`  Migrated documents: ${migrated}`);
    console.log(`  Migration complete: ${migrated === total ? 'Yes' : 'No'}`);
    
    if (migrated < total) {
      console.log(`  Documents remaining: ${total - migrated}`);
    }
    
  } catch (error) {
    console.error('Error checking migration status:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'status':
      checkMigrationStatus();
      break;
    case 'migrate':
    default:
      migrateDeliveryTracking();
      break;
  }
}

module.exports = {
  migrateDeliveryTracking,
  checkMigrationStatus
};