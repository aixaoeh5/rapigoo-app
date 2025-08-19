/**
 * LocationSyncService - Handles location synchronization with backend
 * Prevents concurrent operations and implements proper retry logic
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/apiClient';

class LocationSyncService {
  constructor() {
    this.isOnline = true;
    this.syncQueue = [];
    this.pendingOperations = new Map();
    this.lastSyncTime = 0;
    this.syncInterval = 5000; // 5 seconds minimum interval
    this.maxRetries = 3;
    this.operationLock = false;
    
    // Location buffer for batch updates
    this.locationBuffer = [];
    this.bufferTimeout = null;
    this.bufferInterval = 3000; // 3 seconds
    
    this.init();
  }

  async init() {
    try {
      // Restore pending operations from storage
      const pendingOps = await AsyncStorage.getItem('pendingLocationOps');
      if (pendingOps) {
        this.syncQueue = JSON.parse(pendingOps);
      }
    } catch (error) {
      console.error('Failed to restore pending operations:', error);
    }
  }

  /**
   * Queue location update with deduplication and throttling
   */
  async queueLocationUpdate(deliveryId, locationData, priority = 'normal') {
    try {
      // Validate inputs
      if (!deliveryId || !locationData?.latitude || !locationData?.longitude) {
        console.warn('Invalid location data for sync');
        return false;
      }

      // Generate operation ID
      const operationId = `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create standardized location object
      const standardLocation = {
        latitude: parseFloat(locationData.latitude),
        longitude: parseFloat(locationData.longitude),
        accuracy: locationData.accuracy || 0,
        speed: locationData.speed || 0,
        heading: locationData.heading || 0,
        timestamp: locationData.timestamp || new Date().toISOString()
      };

      // Check if we have a recent similar location (prevent spam)
      if (this.isDuplicateLocation(standardLocation)) {
        console.log('🔄 Skipping duplicate location update');
        return false;
      }

      const operation = {
        type: 'location_update',
        deliveryId,
        data: standardLocation,
        operationId,
        priority,
        timestamp: Date.now(),
        retryCount: 0
      };

      // Add to buffer for batch processing
      this.locationBuffer.push(operation);
      
      // Schedule buffer flush
      this.scheduleBufferFlush();

      // For high priority, process immediately
      if (priority === 'high') {
        await this.processLocationQueue();
      }

      return operationId;

    } catch (error) {
      console.error('Error queuing location update:', error);
      return false;
    }
  }

  /**
   * Check if location is duplicate of recent update
   */
  isDuplicateLocation(newLocation) {
    if (this.locationBuffer.length === 0) return false;
    
    const lastLocation = this.locationBuffer[this.locationBuffer.length - 1]?.data;
    if (!lastLocation) return false;

    const distance = this.calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      newLocation.latitude,
      newLocation.longitude
    );

    // Consider duplicate if within 5 meters and less than 2 seconds apart
    const timeDiff = Date.now() - new Date(lastLocation.timestamp).getTime();
    return distance < 0.005 && timeDiff < 2000;
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Schedule buffer flush with debouncing
   */
  scheduleBufferFlush() {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout);
    }

    this.bufferTimeout = setTimeout(() => {
      this.flushLocationBuffer();
    }, this.bufferInterval);
  }

  /**
   * Flush location buffer and add to sync queue
   */
  async flushLocationBuffer() {
    if (this.locationBuffer.length === 0) return;

    // Get the most recent location for each delivery
    const latestByDelivery = {};
    
    this.locationBuffer.forEach(operation => {
      const deliveryId = operation.deliveryId;
      if (!latestByDelivery[deliveryId] || 
          operation.timestamp > latestByDelivery[deliveryId].timestamp) {
        latestByDelivery[deliveryId] = operation;
      }
    });

    // Add latest locations to sync queue
    Object.values(latestByDelivery).forEach(operation => {
      this.syncQueue.push(operation);
    });

    // Clear buffer
    this.locationBuffer = [];

    // Persist queue
    await this.persistQueue();

    // Process queue
    this.processLocationQueue();
  }

  /**
   * Process location sync queue with concurrency control
   */
  async processLocationQueue() {
    if (this.operationLock || this.syncQueue.length === 0) {
      return;
    }

    this.operationLock = true;

    try {
      const now = Date.now();
      
      // Respect sync interval
      if (now - this.lastSyncTime < this.syncInterval) {
        console.log('🕒 Respecting sync interval, delaying queue processing');
        setTimeout(() => {
          this.operationLock = false;
          this.processLocationQueue();
        }, this.syncInterval - (now - this.lastSyncTime));
        return;
      }

      // Process operations in batches
      const batchSize = 3;
      const batch = this.syncQueue.splice(0, batchSize);
      
      console.log(`📡 Processing ${batch.length} location updates`);

      const results = await Promise.allSettled(
        batch.map(operation => this.syncSingleLocation(operation))
      );

      // Handle results
      const failed = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const operation = batch[index];
          operation.retryCount++;
          
          if (operation.retryCount < this.maxRetries) {
            // Add back to queue for retry
            failed.push(operation);
            console.log(`⚠️ Retrying location sync ${operation.operationId} (${operation.retryCount}/${this.maxRetries})`);
          } else {
            console.error(`❌ Failed to sync location after ${this.maxRetries} retries:`, operation.operationId);
          }
        }
      });

      // Add failed operations back to beginning of queue
      this.syncQueue.unshift(...failed);

      this.lastSyncTime = now;
      await this.persistQueue();

      // Continue processing if there are more operations
      if (this.syncQueue.length > 0) {
        setTimeout(() => {
          this.operationLock = false;
          this.processLocationQueue();
        }, 1000);
      } else {
        this.operationLock = false;
      }

    } catch (error) {
      console.error('Error processing location queue:', error);
      this.operationLock = false;
    }
  }

  /**
   * Sync single location to backend
   */
  async syncSingleLocation(operation) {
    try {
      const { deliveryId, data, operationId } = operation;
      
      console.log(`📡 Syncing location for delivery ${deliveryId}:`, {
        operationId,
        lat: data.latitude,
        lng: data.longitude,
        accuracy: data.accuracy
      });

      const response = await apiClient.put(`/delivery/${deliveryId}/location`, {
        ...data,
        operationId
      });

      console.log(`✅ Location synced successfully:`, operationId);
      return response.data;

    } catch (error) {
      console.error(`❌ Failed to sync location:`, error.message);
      throw error;
    }
  }

  /**
   * Persist queue to storage
   */
  async persistQueue() {
    try {
      await AsyncStorage.setItem('pendingLocationOps', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to persist location queue:', error);
    }
  }

  /**
   * Clear all pending operations
   */
  async clearQueue() {
    this.syncQueue = [];
    this.locationBuffer = [];
    await AsyncStorage.removeItem('pendingLocationOps');
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      syncQueueLength: this.syncQueue.length,
      bufferLength: this.locationBuffer.length,
      isProcessing: this.operationLock,
      lastSyncTime: this.lastSyncTime
    };
  }

  /**
   * Force immediate sync of all pending operations
   */
  async forceSyncAll() {
    await this.flushLocationBuffer();
    
    // Override sync interval temporarily
    const originalInterval = this.syncInterval;
    this.syncInterval = 0;
    
    await this.processLocationQueue();
    
    // Restore original interval
    this.syncInterval = originalInterval;
  }
}

// Export singleton instance
export default new LocationSyncService();