#!/usr/bin/env node

/**
 * Validation Script for ParallelSaveError Fix
 * Tests the new atomic operations under various stress conditions
 */

const mongoose = require('mongoose');
const DeliveryTracking = require('../models/DeliveryTracking');
const { deliveryMonitoring } = require('../utils/deliveryMonitoring');

// Load environment variables
require('dotenv').config();

class ParallelSaveValidator {
  constructor() {
    this.results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      parallelSaveErrors: 0,
      tests: []
    };
  }

  async runValidation() {
    console.log('🧪 Starting ParallelSaveError Fix Validation');
    console.log('='.repeat(50));

    try {
      // Connect to database
      await this.connectToDatabase();
      
      // Find existing delivery tracking or create test data
      const deliveryTracking = await this.getOrCreateTestDelivery();
      
      if (!deliveryTracking) {
        throw new Error('No delivery tracking available for testing');
      }

      console.log(`📦 Using delivery tracking: ${deliveryTracking._id}`);
      console.log(`📍 Current status: ${deliveryTracking.status}`);
      console.log('');

      // Run validation tests
      await this.testConcurrentStatusUpdates(deliveryTracking);
      await this.testConcurrentLocationUpdates(deliveryTracking);
      await this.testMixedConcurrentOperations(deliveryTracking);
      await this.testHighFrequencyOperations(deliveryTracking);
      await this.testErrorRecovery(deliveryTracking);

      // Generate final report
      this.generateReport();

    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
    }
  }

  async connectToDatabase() {
    console.log('🔌 Connecting to database...');
    
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';
    await mongoose.connect(mongoUri);
    
    console.log('✅ Database connected');
  }

  async getOrCreateTestDelivery() {
    // Try to find an existing delivery tracking in 'assigned' or 'heading_to_pickup' status
    let delivery = await DeliveryTracking.findOne({
      status: { $in: ['assigned', 'heading_to_pickup'] },
      isLive: true
    });

    if (!delivery) {
      console.log('⚠️ No suitable delivery tracking found');
      console.log('Please ensure you have an active delivery in "assigned" or "heading_to_pickup" status');
      return null;
    }

    return delivery;
  }

  async runTest(testName, testFn) {
    this.results.totalTests++;
    const startTime = Date.now();
    
    console.log(`🧪 Running: ${testName}`);

    try {
      await testFn();
      
      const duration = Date.now() - startTime;
      this.results.passedTests++;
      this.results.tests.push({
        name: testName,
        status: 'PASSED',
        duration,
        error: null
      });
      
      console.log(`✅ ${testName} - PASSED (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.failedTests++;
      
      // Check if it's a ParallelSaveError
      if (error.message.includes('ParallelSaveError')) {
        this.results.parallelSaveErrors++;
        console.log(`🚨 ${testName} - PARALLEL SAVE ERROR DETECTED!`);
      } else {
        console.log(`❌ ${testName} - FAILED: ${error.message}`);
      }
      
      this.results.tests.push({
        name: testName,
        status: 'FAILED',
        duration,
        error: error.message
      });
    }
  }

  async testConcurrentStatusUpdates(deliveryTracking) {
    await this.runTest('Concurrent Status Updates', async () => {
      const promises = [];
      const numOperations = 5;

      // Create multiple concurrent status update operations
      for (let i = 0; i < numOperations; i++) {
        const operationId = `concurrent_status_${i}_${Date.now()}`;
        promises.push(
          deliveryTracking.updateStatus(
            'heading_to_pickup',
            `Concurrent status update ${i}`,
            null,
            operationId
          )
        );
      }

      const results = await Promise.allSettled(promises);
      
      // Check results
      let successCount = 0;
      let parallelSaveErrorCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          if (result.reason.message.includes('ParallelSaveError')) {
            parallelSaveErrorCount++;
          }
        }
      });

      console.log(`    📊 ${successCount}/${numOperations} operations succeeded`);
      
      if (parallelSaveErrorCount > 0) {
        throw new Error(`ParallelSaveError detected in ${parallelSaveErrorCount} operations`);
      }

      if (successCount === 0) {
        throw new Error('All operations failed');
      }
    });
  }

  async testConcurrentLocationUpdates(deliveryTracking) {
    await this.runTest('Concurrent Location Updates', async () => {
      const promises = [];
      const numOperations = 8;

      // Create multiple concurrent location update operations
      for (let i = 0; i < numOperations; i++) {
        const operationId = `concurrent_location_${i}_${Date.now()}`;
        promises.push(
          deliveryTracking.updateLocation({
            latitude: 18.4576 + (i * 0.0001),
            longitude: -69.9671 + (i * 0.0001),
            accuracy: 10 + i,
            speed: Math.random() * 50,
            heading: Math.random() * 360
          }, operationId)
        );
      }

      const results = await Promise.allSettled(promises);
      
      let successCount = 0;
      let parallelSaveErrorCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          if (result.reason.message.includes('ParallelSaveError')) {
            parallelSaveErrorCount++;
          }
        }
      });

      console.log(`    📊 ${successCount}/${numOperations} operations succeeded`);
      
      if (parallelSaveErrorCount > 0) {
        throw new Error(`ParallelSaveError detected in ${parallelSaveErrorCount} operations`);
      }

      if (successCount === 0) {
        throw new Error('All operations failed');
      }
    });
  }

  async testMixedConcurrentOperations(deliveryTracking) {
    await this.runTest('Mixed Concurrent Operations', async () => {
      const promises = [];

      // Mix of location and status updates
      promises.push(
        deliveryTracking.updateLocation({
          latitude: 18.4580,
          longitude: -69.9675,
          accuracy: 8
        }, 'mixed_location_1')
      );

      promises.push(
        deliveryTracking.updateStatus(
          'heading_to_pickup',
          'Mixed operation status update',
          null,
          'mixed_status_1'
        )
      );

      promises.push(
        deliveryTracking.updateLocation({
          latitude: 18.4585,
          longitude: -69.9680,
          accuracy: 12
        }, 'mixed_location_2')
      );

      const results = await Promise.allSettled(promises);
      
      let successCount = 0;
      let parallelSaveErrorCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          if (result.reason.message.includes('ParallelSaveError')) {
            parallelSaveErrorCount++;
          }
        }
      });

      console.log(`    📊 ${successCount}/${promises.length} operations succeeded`);
      
      if (parallelSaveErrorCount > 0) {
        throw new Error(`ParallelSaveError detected in ${parallelSaveErrorCount} operations`);
      }
    });
  }

  async testHighFrequencyOperations(deliveryTracking) {
    await this.runTest('High-Frequency Operations', async () => {
      const promises = [];
      const numOperations = 15;
      const startTime = Date.now();

      // Rapid-fire operations
      for (let i = 0; i < numOperations; i++) {
        const operationId = `highfreq_${i}_${Date.now()}`;
        
        if (i % 3 === 0) {
          // Status update
          promises.push(
            deliveryTracking.updateStatus(
              'heading_to_pickup',
              `High frequency status ${i}`,
              null,
              operationId
            )
          );
        } else {
          // Location update
          promises.push(
            deliveryTracking.updateLocation({
              latitude: 18.4576 + (i * 0.00001),
              longitude: -69.9671 + (i * 0.00001),
              accuracy: 5 + (i % 10)
            }, operationId)
          );
        }
        
        // Small delay to simulate rapid updates
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      let successCount = 0;
      let parallelSaveErrorCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          if (result.reason.message.includes('ParallelSaveError')) {
            parallelSaveErrorCount++;
          }
        }
      });

      console.log(`    📊 ${successCount}/${numOperations} operations succeeded in ${totalTime}ms`);
      console.log(`    ⚡ ${(numOperations / totalTime * 1000).toFixed(2)} operations/second`);
      
      if (parallelSaveErrorCount > 0) {
        throw new Error(`ParallelSaveError detected in ${parallelSaveErrorCount} operations`);
      }

      if (totalTime > 10000) { // 10 seconds
        throw new Error(`Operations took too long: ${totalTime}ms`);
      }
    });
  }

  async testErrorRecovery(deliveryTracking) {
    await this.runTest('Error Recovery', async () => {
      // Test expired lock cleanup
      await DeliveryTracking.findByIdAndUpdate(deliveryTracking._id, {
        operationLock: new Date(Date.now() - 35000), // 35 seconds ago (expired)
        lastOperationId: 'expired_test_operation'
      });

      // Should recover from expired lock
      const result = await deliveryTracking.updateStatus(
        'heading_to_pickup',
        'Recovery test',
        null,
        'recovery_test_operation'
      );

      if (!result) {
        throw new Error('Failed to recover from expired lock');
      }

      // Verify lock was cleared
      const updatedDelivery = await DeliveryTracking.findById(deliveryTracking._id);
      if (updatedDelivery.operationLock !== null) {
        throw new Error('Operation lock was not cleared after operation');
      }

      console.log('    🔧 Successfully recovered from expired lock');
    });
  }

  generateReport() {
    console.log('');
    console.log('📋 VALIDATION REPORT');
    console.log('='.repeat(50));
    
    const successRate = this.results.totalTests > 0 
      ? (this.results.passedTests / this.results.totalTests * 100).toFixed(1)
      : 0;

    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passedTests}`);
    console.log(`Failed: ${this.results.failedTests}`);
    console.log(`Success Rate: ${successRate}%`);
    console.log('');

    // ParallelSaveError specific results
    if (this.results.parallelSaveErrors === 0) {
      console.log('✅ NO PARALLEL SAVE ERRORS DETECTED!');
      console.log('🎉 ParallelSaveError fix is working correctly!');
    } else {
      console.log(`🚨 ${this.results.parallelSaveErrors} PARALLEL SAVE ERRORS DETECTED!`);
      console.log('❌ ParallelSaveError fix needs attention!');
    }

    console.log('');
    console.log('Test Details:');
    console.log('-'.repeat(50));

    this.results.tests.forEach(test => {
      const status = test.status === 'PASSED' ? '✅' : '❌';
      console.log(`${status} ${test.name} (${test.duration}ms)`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });

    console.log('');
    
    // Overall assessment
    if (this.results.parallelSaveErrors === 0 && this.results.passedTests >= this.results.totalTests * 0.8) {
      console.log('🎯 OVERALL ASSESSMENT: SUCCESSFUL');
      console.log('The ParallelSaveError fix is working correctly under stress conditions.');
    } else {
      console.log('⚠️ OVERALL ASSESSMENT: NEEDS ATTENTION');
      console.log('Some issues were detected that may need investigation.');
    }

    // Get monitoring metrics if available
    try {
      const metrics = deliveryMonitoring.getMetrics();
      console.log('');
      console.log('Monitoring Metrics:');
      console.log(`- Total Operations: ${metrics.totalOperations}`);
      console.log(`- Success Rate: ${(metrics.health.overallSuccessRate * 100).toFixed(2)}%`);
      console.log(`- ParallelSaveError Rate: ${(metrics.health.parallelSaveErrorRate * 100).toFixed(4)}%`);
      console.log(`- Average Response Time: ${metrics.health.averageResponseTime.toFixed(0)}ms`);
    } catch (error) {
      // Monitoring metrics not available
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new ParallelSaveValidator();
  validator.runValidation().catch(error => {
    console.error('💥 Validation script crashed:', error);
    process.exit(1);
  });
}

module.exports = ParallelSaveValidator;