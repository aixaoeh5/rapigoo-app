/**
 * DeliveryStateManager - Centralized state management for delivery operations
 * Prevents concurrent status updates and maintains data consistency
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/apiClient';

class DeliveryStateManager {
  constructor() {
    this.currentDelivery = null;
    this.pendingOperations = new Map();
    this.statusTransitionLock = false;
    this.lastStatusUpdate = 0;
    this.statusUpdateInterval = 2000; // 2 seconds minimum between status updates
    
    // Valid status transitions
    this.validTransitions = {
      assigned: ['heading_to_pickup', 'cancelled'],
      heading_to_pickup: ['at_pickup', 'cancelled'],
      at_pickup: ['picked_up', 'cancelled'],
      picked_up: ['heading_to_delivery', 'at_delivery', 'cancelled'],
      heading_to_delivery: ['at_delivery', 'cancelled'],
      at_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };

    this.init();
  }

  async init() {
    try {
      // Restore current delivery from storage
      const savedDelivery = await AsyncStorage.getItem('currentDelivery');
      if (savedDelivery) {
        this.currentDelivery = JSON.parse(savedDelivery);
      }

      // Restore pending operations
      const pendingOps = await AsyncStorage.getItem('pendingDeliveryOps');
      if (pendingOps) {
        const ops = JSON.parse(pendingOps);
        ops.forEach(op => {
          this.pendingOperations.set(op.operationId, op);
        });
      }
    } catch (error) {
      console.error('Failed to restore delivery state:', error);
    }
  }

  /**
   * Set current delivery being tracked
   */
  async setCurrentDelivery(deliveryData) {
    try {
      this.currentDelivery = {
        ...deliveryData,
        lastUpdate: Date.now()
      };
      
      await this.persistState();
      console.log('📦 Current delivery set:', deliveryData._id);
      
    } catch (error) {
      console.error('Error setting current delivery:', error);
    }
  }

  /**
   * Update delivery status with concurrency control
   */
  async updateDeliveryStatus(newStatus, notes = null, location = null, force = false) {
    try {
      if (!this.currentDelivery) {
        throw new Error('No active delivery to update');
      }

      // Check if transition is valid
      if (!force && !this.isValidTransition(this.currentDelivery.status, newStatus)) {
        throw new Error(`Invalid status transition from ${this.currentDelivery.status} to ${newStatus}`);
      }

      // Check for concurrent operations
      if (this.statusTransitionLock) {
        console.log('⏳ Status transition in progress, queuing request...');
        return await this.queueStatusUpdate(newStatus, notes, location);
      }

      // Respect minimum interval between status updates
      const now = Date.now();
      if (!force && (now - this.lastStatusUpdate) < this.statusUpdateInterval) {
        console.log('🕒 Respecting status update interval');
        await this.wait(this.statusUpdateInterval - (now - this.lastStatusUpdate));
      }

      this.statusTransitionLock = true;
      
      try {
        const operationId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🚚 Updating delivery status:`, {
          deliveryId: this.currentDelivery._id,
          from: this.currentDelivery.status,
          to: newStatus,
          operationId
        });

        // Prepare request payload
        const payload = {
          status: newStatus,
          notes,
          operationId
        };

        // Add location if provided
        if (location && typeof location === 'object') {
          payload.location = {
            latitude: parseFloat(location.latitude),
            longitude: parseFloat(location.longitude),
            accuracy: location.accuracy || 0,
            speed: location.speed || 0,
            heading: location.heading || 0
          };
        }

        // Make API request
        const response = await apiClient.put(
          `/delivery/${this.currentDelivery._id}/status`, 
          payload
        );

        if (response.data.success) {
          // Update local state
          const updatedDelivery = response.data.data.deliveryTracking;
          this.currentDelivery = {
            ...updatedDelivery,
            lastUpdate: Date.now()
          };

          await this.persistState();
          this.lastStatusUpdate = now;

          console.log(`✅ Status updated successfully: ${newStatus}`);
          
          // Remove from pending operations if it was queued
          this.pendingOperations.delete(operationId);
          
          return {
            success: true,
            delivery: this.currentDelivery,
            operationId
          };
        } else {
          throw new Error(response.data.error?.message || 'Status update failed');
        }

      } finally {
        this.statusTransitionLock = false;
        this.processQueuedOperations();
      }

    } catch (error) {
      this.statusTransitionLock = false;
      console.error('❌ Error updating delivery status:', error);
      
      // Handle specific error cases
      if (error.message.includes('Invalid status transition')) {
        throw new Error(`Cannot change status from ${this.currentDelivery?.status} to ${newStatus}`);
      }
      
      if (error.message.includes('version') || error.message.includes('conflict')) {
        console.log('🔄 Version conflict detected, will retry...');
        throw new Error('Status update conflict - please try again');
      }
      
      throw error;
    }
  }

  /**
   * Queue status update for later processing
   */
  async queueStatusUpdate(newStatus, notes, location) {
    const operationId = `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const operation = {
      type: 'status_update',
      operationId,
      deliveryId: this.currentDelivery._id,
      status: newStatus,
      notes,
      location,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.pendingOperations.set(operationId, operation);
    await this.persistPendingOperations();

    console.log('📝 Status update queued:', operationId);
    
    return {
      success: true,
      queued: true,
      operationId
    };
  }

  /**
   * Process queued operations
   */
  async processQueuedOperations() {
    if (this.pendingOperations.size === 0) return;

    console.log(`📤 Processing ${this.pendingOperations.size} queued operations`);

    for (const [operationId, operation] of this.pendingOperations.entries()) {
      try {
        if (operation.type === 'status_update') {
          await this.updateDeliveryStatus(
            operation.status,
            operation.notes,
            operation.location,
            true // force = true for queued operations
          );
          
          this.pendingOperations.delete(operationId);
        }
      } catch (error) {
        console.error(`Failed to process queued operation ${operationId}:`, error);
        
        // Increment retry count
        operation.retryCount++;
        if (operation.retryCount >= 3) {
          console.log(`❌ Removing failed operation after 3 retries: ${operationId}`);
          this.pendingOperations.delete(operationId);
        }
      }
    }

    await this.persistPendingOperations();
  }

  /**
   * Complete delivery with final confirmation
   */
  async completeDelivery(deliveryData = {}) {
    try {
      if (!this.currentDelivery) {
        throw new Error('No active delivery to complete');
      }

      if (this.currentDelivery.status !== 'at_delivery') {
        throw new Error('Cannot complete delivery unless at delivery location');
      }

      console.log('🏁 Completing delivery:', this.currentDelivery._id);

      const operationId = `complete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response = await apiClient.post(
        `/delivery/${this.currentDelivery._id}/complete`,
        {
          ...deliveryData,
          operationId
        }
      );

      if (response.data.success) {
        this.currentDelivery = {
          ...response.data.data.deliveryTracking,
          lastUpdate: Date.now()
        };

        await this.persistState();
        
        console.log('✅ Delivery completed successfully');
        
        return {
          success: true,
          delivery: this.currentDelivery,
          operationId
        };
      } else {
        throw new Error(response.data.error?.message || 'Delivery completion failed');
      }

    } catch (error) {
      console.error('❌ Error completing delivery:', error);
      throw error;
    }
  }

  /**
   * Check if status transition is valid
   */
  isValidTransition(currentStatus, newStatus) {
    return this.validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Get next valid statuses for current delivery
   */
  getNextValidStatuses() {
    if (!this.currentDelivery) return [];
    return this.validTransitions[this.currentDelivery.status] || [];
  }

  /**
   * Get current delivery data
   */
  getCurrentDelivery() {
    return this.currentDelivery;
  }

  /**
   * Clear current delivery (when completed or cancelled)
   */
  async clearCurrentDelivery() {
    this.currentDelivery = null;
    this.pendingOperations.clear();
    
    await AsyncStorage.multiRemove([
      'currentDelivery',
      'pendingDeliveryOps'
    ]);
    
    console.log('🧹 Current delivery cleared');
  }

  /**
   * Persist state to storage
   */
  async persistState() {
    try {
      if (this.currentDelivery) {
        await AsyncStorage.setItem(
          'currentDelivery', 
          JSON.stringify(this.currentDelivery)
        );
      }
    } catch (error) {
      console.error('Failed to persist delivery state:', error);
    }
  }

  /**
   * Persist pending operations
   */
  async persistPendingOperations() {
    try {
      const operations = Array.from(this.pendingOperations.values());
      await AsyncStorage.setItem(
        'pendingDeliveryOps',
        JSON.stringify(operations)
      );
    } catch (error) {
      console.error('Failed to persist pending operations:', error);
    }
  }

  /**
   * Wait utility function
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get manager status
   */
  getStatus() {
    return {
      hasActiveDelivery: !!this.currentDelivery,
      currentStatus: this.currentDelivery?.status,
      pendingOperations: this.pendingOperations.size,
      isLocked: this.statusTransitionLock,
      lastStatusUpdate: this.lastStatusUpdate
    };
  }

  /**
   * Force unlock (use with caution)
   */
  forceUnlock() {
    this.statusTransitionLock = false;
    console.log('🔓 Status transition lock force released');
  }
}

// Export singleton instance
export default new DeliveryStateManager();