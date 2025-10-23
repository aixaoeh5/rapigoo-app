/**
 * Comprehensive tests for delivery concurrency fixes
 * Tests ParallelSaveError resolution and atomic operations
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DeliveryTracking = require('../models/DeliveryTracking');
const User = require('../models/User');
const Order = require('../models/Order');

describe('Delivery Concurrency Tests', () => {
  let mongoServer;
  let deliveryTracking;
  let order;
  let deliveryPerson;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await DeliveryTracking.deleteMany({});
    await User.deleteMany({});
    await Order.deleteMany({});

    // Create test delivery person
    deliveryPerson = await User.create({
      name: 'Test Delivery Person',
      email: 'delivery@test.com',
      password: 'password123',
      role: 'delivery',
      phone: '+1234567890'
    });

    // Create test order
    order = await Order.create({
      orderNumber: 'TEST001',
      customerId: new mongoose.Types.ObjectId(),
      merchantId: new mongoose.Types.ObjectId(),
      total: 25.50,
      status: 'assigned',
      deliveryInfo: {
        coordinates: [-69.9671, 18.4576],
        address: {
          street: 'Test Street 123',
          city: 'Test City'
        }
      }
    });

    // Create test delivery tracking
    deliveryTracking = await DeliveryTracking.create({
      orderId: order._id,
      deliveryPersonId: deliveryPerson._id,
      status: 'assigned',
      pickupLocation: {
        coordinates: [-69.9700, 18.4600],
        address: 'Pickup Location'
      },
      deliveryLocation: {
        coordinates: [-69.9671, 18.4576],
        address: 'Delivery Location'
      },
      isLive: true
    });
  });

  describe('Atomic Status Updates', () => {
    test('should handle concurrent status updates without ParallelSaveError', async () => {
      const promises = [];
      const operationIds = [];

      // Create 5 concurrent status update operations
      for (let i = 0; i < 5; i++) {
        const operationId = `concurrent_${i}_${Date.now()}`;
        operationIds.push(operationId);
        
        promises.push(
          deliveryTracking.updateStatus('heading_to_pickup', `Concurrent update ${i}`, null, operationId)
        );
      }

      // Wait for all operations to complete
      const results = await Promise.allSettled(promises);

      // Verify that all operations either succeeded or failed gracefully
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          expect(result.value).toBeDefined();
          expect(result.value.status).toBe('heading_to_pickup');
        } else {
          failureCount++;
          // Failures should be version conflicts, not ParallelSaveError
          expect(result.reason.message).not.toContain('ParallelSaveError');
        }
      });

      // At least one should succeed
      expect(successCount).toBeGreaterThan(0);
      
      // Final state should be consistent
      const finalTracking = await DeliveryTracking.findById(deliveryTracking._id);
      expect(finalTracking.status).toBe('heading_to_pickup');
      expect(finalTracking.statusHistory.length).toBeGreaterThan(0);
    });

    test('should handle concurrent location and status updates', async () => {
      const promises = [];

      // Mix of location and status updates
      promises.push(
        deliveryTracking.updateLocation({
          latitude: 18.4580,
          longitude: -69.9675,
          accuracy: 10
        }, 'loc_1')
      );

      promises.push(
        deliveryTracking.updateStatus('heading_to_pickup', 'Status update', null, 'status_1')
      );

      promises.push(
        deliveryTracking.updateLocation({
          latitude: 18.4585,
          longitude: -69.9680,
          accuracy: 12
        }, 'loc_2')
      );

      const results = await Promise.allSettled(promises);

      // Verify no ParallelSaveError occurred
      results.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).not.toContain('ParallelSaveError');
        }
      });

      // Final state should be consistent
      const finalTracking = await DeliveryTracking.findById(deliveryTracking._id);
      expect(finalTracking).toBeDefined();
      expect(finalTracking.currentLocation).toBeDefined();
    });

    test('should properly handle version conflicts with retry logic', async () => {
      const tracking1 = await DeliveryTracking.findById(deliveryTracking._id);
      const tracking2 = await DeliveryTracking.findById(deliveryTracking._id);

      // Simulate version conflict scenario
      const promise1 = tracking1.updateStatus('heading_to_pickup', 'Update 1', null, 'op1');
      const promise2 = tracking2.updateStatus('heading_to_pickup', 'Update 2', null, 'op2');

      const results = await Promise.allSettled([promise1, promise2]);

      // One should succeed, one might fail with version conflict
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThan(0);

      // No ParallelSaveError should occur
      results.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).not.toContain('ParallelSaveError');
        }
      });
    });
  });

  describe('Location Update Concurrency', () => {
    test('should handle rapid location updates without errors', async () => {
      const locations = [
        { latitude: 18.4576, longitude: -69.9671, accuracy: 10 },
        { latitude: 18.4577, longitude: -69.9672, accuracy: 12 },
        { latitude: 18.4578, longitude: -69.9673, accuracy: 8 },
        { latitude: 18.4579, longitude: -69.9674, accuracy: 15 },
        { latitude: 18.4580, longitude: -69.9675, accuracy: 9 }
      ];

      const promises = locations.map((loc, index) => 
        deliveryTracking.updateLocation(loc, `rapid_${index}`)
      );

      const results = await Promise.allSettled(promises);

      // Verify no ParallelSaveError
      results.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).not.toContain('ParallelSaveError');
        }
      });

      // Final tracking should have valid location
      const finalTracking = await DeliveryTracking.findById(deliveryTracking._id);
      expect(finalTracking.currentLocation).toBeDefined();
      expect(finalTracking.route.length).toBeGreaterThan(0);
    });

    test('should handle location updates with automatic status changes', async () => {
      // Update location to pickup point (should trigger automatic status change)
      const pickupLocation = {
        latitude: 18.4600, // Same as pickup location
        longitude: -69.9700,
        accuracy: 5
      };

      const result = await deliveryTracking.updateLocation(pickupLocation, 'pickup_arrival');

      expect(result).toBeDefined();
      
      // Should automatically change to 'at_pickup' status
      const finalTracking = await DeliveryTracking.findById(deliveryTracking._id);
      expect(finalTracking.status).toBe('at_pickup');
      expect(finalTracking.pickupLocation.arrived).toBe(true);
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    test('should recover from lock timeout scenarios', async () => {
      // Simulate a long-running operation by manually setting an old lock
      await DeliveryTracking.findByIdAndUpdate(deliveryTracking._id, {
        operationLock: new Date(Date.now() - 35000), // 35 seconds ago (expired)
        lastOperationId: 'expired_operation'
      });

      // New operation should succeed by clearing expired lock
      const result = await deliveryTracking.updateStatus(
        'heading_to_pickup', 
        'After expired lock', 
        null, 
        'new_operation'
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('heading_to_pickup');

      // Lock should be cleared
      const finalTracking = await DeliveryTracking.findById(deliveryTracking._id);
      expect(finalTracking.operationLock).toBeNull();
    });

    test('should handle invalid status transitions gracefully', async () => {
      // Try to go directly from 'assigned' to 'delivered' (invalid)
      await expect(
        deliveryTracking.updateStatus('delivered', 'Invalid transition', null, 'invalid_op')
      ).rejects.toThrow('Cannot transition from assigned to delivered');

      // Original status should remain unchanged
      const finalTracking = await DeliveryTracking.findById(deliveryTracking._id);
      expect(finalTracking.status).toBe('assigned');
    });
  });

  describe('Delivery Completion Flow', () => {
    test('should complete delivery atomically', async () => {
      // Progress through valid states
      await deliveryTracking.updateStatus('heading_to_pickup', 'Going to pickup');
      await deliveryTracking.updateStatus('at_pickup', 'Arrived at pickup');
      await deliveryTracking.updateStatus('picked_up', 'Package picked up');
      await deliveryTracking.updateStatus('heading_to_delivery', 'Going to customer');
      await deliveryTracking.updateStatus('at_delivery', 'Arrived at customer');

      // Complete delivery
      const result = await deliveryTracking.completeDelivery({
        notes: 'Delivered successfully',
        photo: 'photo_url',
        signature: 'signature_data'
      }, 'completion_op');

      expect(result).toBeDefined();
      expect(result.status).toBe('delivered');
      expect(result.deliveryNotes).toBe('Delivered successfully');
      expect(result.isLive).toBe(false);
      expect(result.actualDeliveryTime).toBeDefined();
    });

    test('should prevent concurrent completion attempts', async () => {
      // Set up delivery at completion stage
      await deliveryTracking.updateStatus('heading_to_pickup', 'Going to pickup');
      await deliveryTracking.updateStatus('at_pickup', 'Arrived at pickup');
      await deliveryTracking.updateStatus('picked_up', 'Package picked up');
      await deliveryTracking.updateStatus('heading_to_delivery', 'Going to customer');
      await deliveryTracking.updateStatus('at_delivery', 'Arrived at customer');

      // Try to complete delivery concurrently
      const completionData1 = { notes: 'Completion 1', operationId: 'comp1' };
      const completionData2 = { notes: 'Completion 2', operationId: 'comp2' };

      const promises = [
        deliveryTracking.completeDelivery(completionData1, 'comp1'),
        deliveryTracking.completeDelivery(completionData2, 'comp2')
      ];

      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThan(0);

      // No ParallelSaveError should occur
      results.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).not.toContain('ParallelSaveError');
        }
      });

      // Final state should be delivered
      const finalTracking = await DeliveryTracking.findById(deliveryTracking._id);
      expect(finalTracking.status).toBe('delivered');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle high-frequency updates within time limits', async () => {
      const startTime = Date.now();
      const updatePromises = [];

      // Create 20 rapid operations
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          // Location update
          updatePromises.push(
            deliveryTracking.updateLocation({
              latitude: 18.4576 + (i * 0.0001),
              longitude: -69.9671 + (i * 0.0001),
              accuracy: 10 + i
            }, `perf_loc_${i}`)
          );
        } else {
          // Status update (alternate between valid statuses)
          const status = i < 10 ? 'heading_to_pickup' : 'assigned';
          updatePromises.push(
            deliveryTracking.updateStatus(status, `Perf test ${i}`, null, `perf_status_${i}`)
          );
        }
      }

      const results = await Promise.allSettled(updatePromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);

      // At least 50% should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(updatePromises.length * 0.5);

      // No ParallelSaveError should occur
      results.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).not.toContain('ParallelSaveError');
        }
      });
    });
  });

  describe('Data Consistency', () => {
    test('should maintain data consistency under concurrent operations', async () => {
      const initialVersion = deliveryTracking.version || 0;
      const operations = [];

      // Mix of different operations
      operations.push(
        deliveryTracking.updateLocation({ latitude: 18.4577, longitude: -69.9672, accuracy: 10 }, 'consistency_loc')
      );
      operations.push(
        deliveryTracking.updateStatus('heading_to_pickup', 'Status change', null, 'consistency_status')
      );

      await Promise.allSettled(operations);

      // Verify data consistency
      const finalTracking = await DeliveryTracking.findById(deliveryTracking._id);
      
      // Version should have incremented
      expect(finalTracking.version).toBeGreaterThan(initialVersion);
      
      // No operation lock should remain
      expect(finalTracking.operationLock).toBeNull();
      
      // Status history should be consistent
      expect(finalTracking.statusHistory.length).toBeGreaterThan(0);
      
      // All history entries should have operation IDs
      finalTracking.statusHistory.forEach(entry => {
        if (entry.operationId) {
          expect(entry.operationId).toMatch(/^(consistency_|auto_)/);
        }
      });
    });
  });
});

module.exports = {
  // Export for integration tests
  createTestDeliveryTracking: async (orderId, deliveryPersonId) => {
    return await DeliveryTracking.create({
      orderId,
      deliveryPersonId,
      status: 'assigned',
      pickupLocation: {
        coordinates: [-69.9700, 18.4600],
        address: 'Test Pickup Location'
      },
      deliveryLocation: {
        coordinates: [-69.9671, 18.4576],
        address: 'Test Delivery Location'
      },
      isLive: true
    });
  }
};