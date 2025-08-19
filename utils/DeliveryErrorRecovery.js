/**
 * DeliveryErrorRecovery - Comprehensive error handling and recovery system
 * Handles ParallelSaveError, network failures, and data consistency issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/src';
import { apiClient } from '../api/apiClient';

class DeliveryErrorRecovery {
  constructor() {
    this.isOnline = true;
    this.errorQueue = [];
    this.recoveryStrategies = new Map();
    this.maxRetryAttempts = 5;
    this.baseRetryDelay = 1000; // 1 second
    this.maxRetryDelay = 30000; // 30 seconds
    
    // Error patterns and their recovery strategies
    this.initializeRecoveryStrategies();
    
    // Network state monitoring
    this.setupNetworkMonitoring();
    
    this.init();
  }

  async init() {
    try {
      // Restore error queue from storage
      const savedErrors = await AsyncStorage.getItem('deliveryErrorQueue');
      if (savedErrors) {
        this.errorQueue = JSON.parse(savedErrors);
        console.log(`🔄 Restored ${this.errorQueue.length} errors for recovery`);
      }
    } catch (error) {
      console.error('Failed to restore error queue:', error);
    }
  }

  /**
   * Initialize error recovery strategies
   */
  initializeRecoveryStrategies() {
    // ParallelSaveError recovery
    this.recoveryStrategies.set('ParallelSaveError', {
      maxRetries: 5,
      strategy: 'exponential_backoff',
      customHandler: this.handleParallelSaveError.bind(this)
    });

    // Version conflict recovery
    this.recoveryStrategies.set('VersionError', {
      maxRetries: 3,
      strategy: 'refresh_and_retry',
      customHandler: this.handleVersionConflict.bind(this)
    });

    // Network timeout recovery
    this.recoveryStrategies.set('NetworkTimeout', {
      maxRetries: 10,
      strategy: 'network_aware_retry',
      customHandler: this.handleNetworkTimeout.bind(this)
    });

    // Status transition error recovery
    this.recoveryStrategies.set('InvalidTransition', {
      maxRetries: 1,
      strategy: 'state_refresh',
      customHandler: this.handleInvalidTransition.bind(this)
    });

    // Generic 500 error recovery
    this.recoveryStrategies.set('ServerError', {
      maxRetries: 3,
      strategy: 'exponential_backoff',
      customHandler: this.handleServerError.bind(this)
    });
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected;
      
      if (!wasOnline && this.isOnline) {
        console.log('📶 Network reconnected, processing error queue');
        this.processErrorQueue();
      }
    });
  }

  /**
   * Handle delivery operation errors
   */
  async handleDeliveryError(error, originalOperation, context = {}) {
    try {
      console.log('🚨 Handling delivery error:', {
        error: error.message,
        operation: originalOperation?.type || 'unknown',
        context
      });

      // Classify error type
      const errorType = this.classifyError(error);
      
      // Get recovery strategy
      const strategy = this.recoveryStrategies.get(errorType);
      
      if (!strategy) {
        // No specific strategy, use default
        return this.handleGenericError(error, originalOperation, context);
      }

      // Create error record
      const errorRecord = {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: errorType,
        originalError: {
          message: error.message,
          stack: error.stack,
          code: error.code
        },
        operation: originalOperation,
        context,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: strategy.maxRetries,
        strategy: strategy.strategy,
        status: 'pending'
      };

      // Add to error queue
      this.errorQueue.push(errorRecord);
      await this.persistErrorQueue();

      // Try immediate recovery if strategy allows
      if (strategy.customHandler) {
        try {
          const result = await strategy.customHandler(errorRecord);
          if (result.success) {
            // Remove from queue on success
            this.removeFromQueue(errorRecord.id);
            return result;
          }
        } catch (handlerError) {
          console.log('⚠️ Custom handler failed, will retry later:', handlerError.message);
        }
      }

      // Schedule retry
      this.scheduleRetry(errorRecord);

      return {
        success: false,
        error: errorType,
        recoveryScheduled: true,
        errorId: errorRecord.id
      };

    } catch (recoveryError) {
      console.error('❌ Error in error recovery system:', recoveryError);
      return {
        success: false,
        error: 'RecoverySystemFailure',
        originalError: error.message
      };
    }
  }

  /**
   * Classify error type based on error message and context
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('parallelsaveerror') || message.includes('parallel save')) {
      return 'ParallelSaveError';
    }
    
    if (message.includes('version') || message.includes('conflict')) {
      return 'VersionError';
    }
    
    if (message.includes('timeout') || message.includes('network')) {
      return 'NetworkTimeout';
    }
    
    if (message.includes('transition') || message.includes('invalid status')) {
      return 'InvalidTransition';
    }
    
    if (error.code >= 500 && error.code < 600) {
      return 'ServerError';
    }
    
    return 'GenericError';
  }

  /**
   * Handle ParallelSaveError specifically
   */
  async handleParallelSaveError(errorRecord) {
    console.log('🔄 Handling ParallelSaveError:', errorRecord.id);
    
    try {
      // Wait with exponential backoff
      const delay = Math.min(
        this.baseRetryDelay * Math.pow(2, errorRecord.retryCount),
        this.maxRetryDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 1000;
      await this.wait(delay + jitter);

      // If it's a location update, refresh the delivery data first
      if (errorRecord.operation?.type === 'location_update') {
        const freshDelivery = await this.refreshDeliveryData(errorRecord.operation.deliveryId);
        if (freshDelivery) {
          errorRecord.context.freshDelivery = freshDelivery;
        }
      }

      // Retry the original operation
      const result = await this.retryOperation(errorRecord);
      
      if (result.success) {
        errorRecord.status = 'resolved';
        this.removeFromQueue(errorRecord.id);
        return { success: true, result };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.log('❌ ParallelSaveError handler failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle version conflicts
   */
  async handleVersionConflict(errorRecord) {
    console.log('🔄 Handling VersionError:', errorRecord.id);
    
    try {
      // Always refresh delivery data for version conflicts
      const freshDelivery = await this.refreshDeliveryData(errorRecord.operation.deliveryId);
      
      if (!freshDelivery) {
        throw new Error('Could not refresh delivery data');
      }

      // Update context with fresh data
      errorRecord.context.freshDelivery = freshDelivery;
      
      // Check if the operation is still valid
      if (errorRecord.operation.type === 'status_update') {
        const { status } = errorRecord.operation;
        const currentStatus = freshDelivery.status;
        
        // If already at target status, consider it resolved
        if (currentStatus === status) {
          console.log('✅ Target status already achieved, marking as resolved');
          return { success: true, result: { skipped: true, reason: 'already_at_target_status' } };
        }
        
        // Check if transition is still valid from current status
        if (!this.isValidStatusTransition(currentStatus, status)) {
          console.log('⚠️ Status transition no longer valid, skipping');
          return { success: true, result: { skipped: true, reason: 'invalid_transition' } };
        }
      }

      // Retry with fresh data
      const result = await this.retryOperation(errorRecord);
      
      if (result.success) {
        errorRecord.status = 'resolved';
        this.removeFromQueue(errorRecord.id);
        return { success: true, result };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.log('❌ VersionError handler failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle network timeouts
   */
  async handleNetworkTimeout(errorRecord) {
    console.log('🔄 Handling NetworkTimeout:', errorRecord.id);
    
    try {
      // Check if we're online
      if (!this.isOnline) {
        console.log('📱 Offline, will retry when network is available');
        return { success: false, error: 'offline' };
      }

      // Progressive delay for network issues
      const delay = Math.min(
        this.baseRetryDelay * (errorRecord.retryCount + 1) * 2,
        this.maxRetryDelay
      );
      
      await this.wait(delay);

      // Retry the operation
      const result = await this.retryOperation(errorRecord);
      
      if (result.success) {
        errorRecord.status = 'resolved';
        this.removeFromQueue(errorRecord.id);
        return { success: true, result };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.log('❌ NetworkTimeout handler failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle invalid status transitions
   */
  async handleInvalidTransition(errorRecord) {
    console.log('🔄 Handling InvalidTransition:', errorRecord.id);
    
    try {
      // Refresh delivery data to get current status
      const freshDelivery = await this.refreshDeliveryData(errorRecord.operation.deliveryId);
      
      if (!freshDelivery) {
        throw new Error('Could not refresh delivery data');
      }

      const currentStatus = freshDelivery.status;
      const targetStatus = errorRecord.operation.status;
      
      console.log(`📊 Status check: ${currentStatus} -> ${targetStatus}`);
      
      // If already at target status, mark as resolved
      if (currentStatus === targetStatus) {
        console.log('✅ Already at target status');
        return { success: true, result: { skipped: true, reason: 'already_at_target' } };
      }

      // If transition is now valid, retry
      if (this.isValidStatusTransition(currentStatus, targetStatus)) {
        errorRecord.context.freshDelivery = freshDelivery;
        const result = await this.retryOperation(errorRecord);
        
        if (result.success) {
          errorRecord.status = 'resolved';
          this.removeFromQueue(errorRecord.id);
          return { success: true, result };
        }
      } else {
        // Transition still invalid, mark as unrecoverable
        console.log('⚠️ Transition still invalid, marking as unrecoverable');
        return { success: true, result: { skipped: true, reason: 'invalid_transition' } };
      }

    } catch (error) {
      console.log('❌ InvalidTransition handler failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle server errors
   */
  async handleServerError(errorRecord) {
    console.log('🔄 Handling ServerError:', errorRecord.id);
    
    try {
      // Exponential backoff for server errors
      const delay = Math.min(
        this.baseRetryDelay * Math.pow(2, errorRecord.retryCount),
        this.maxRetryDelay
      );
      
      await this.wait(delay);

      // Retry the operation
      const result = await this.retryOperation(errorRecord);
      
      if (result.success) {
        errorRecord.status = 'resolved';
        this.removeFromQueue(errorRecord.id);
        return { success: true, result };
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.log('❌ ServerError handler failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle generic errors
   */
  async handleGenericError(error, originalOperation, context) {
    console.log('🔄 Handling generic error:', error.message);
    
    // For generic errors, we'll just log and optionally queue for later
    return {
      success: false,
      error: 'GenericError',
      message: error.message,
      handled: true
    };
  }

  /**
   * Retry operation based on its type
   */
  async retryOperation(errorRecord) {
    try {
      const { operation } = errorRecord;
      
      switch (operation.type) {
        case 'location_update':
          return await this.retryLocationUpdate(operation, errorRecord.context);
          
        case 'status_update':
          return await this.retryStatusUpdate(operation, errorRecord.context);
          
        case 'delivery_completion':
          return await this.retryDeliveryCompletion(operation, errorRecord.context);
          
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Retry location update
   */
  async retryLocationUpdate(operation, context) {
    const { deliveryId, data, operationId } = operation;
    
    const response = await apiClient.put(`/delivery/${deliveryId}/location`, {
      ...data,
      operationId: `retry_${operationId}_${Date.now()}`
    });

    return { success: response.data.success, data: response.data };
  }

  /**
   * Retry status update
   */
  async retryStatusUpdate(operation, context) {
    const { deliveryId, status, notes, location, operationId } = operation;
    
    const payload = {
      status,
      notes,
      operationId: `retry_${operationId}_${Date.now()}`
    };

    if (location) {
      payload.location = location;
    }

    const response = await apiClient.put(`/delivery/${deliveryId}/status`, payload);

    return { success: response.data.success, data: response.data };
  }

  /**
   * Retry delivery completion
   */
  async retryDeliveryCompletion(operation, context) {
    const { deliveryId, deliveryData, operationId } = operation;
    
    const response = await apiClient.post(`/delivery/${deliveryId}/complete`, {
      ...deliveryData,
      operationId: `retry_${operationId}_${Date.now()}`
    });

    return { success: response.data.success, data: response.data };
  }

  /**
   * Refresh delivery data from server
   */
  async refreshDeliveryData(deliveryId) {
    try {
      const response = await apiClient.get(`/delivery/${deliveryId}`);
      if (response.data.success) {
        return response.data.data.deliveryTracking;
      }
      return null;
    } catch (error) {
      console.error('Failed to refresh delivery data:', error);
      return null;
    }
  }

  /**
   * Check if status transition is valid
   */
  isValidStatusTransition(currentStatus, targetStatus) {
    const validTransitions = {
      assigned: ['heading_to_pickup', 'cancelled'],
      heading_to_pickup: ['at_pickup', 'cancelled'],
      at_pickup: ['picked_up', 'cancelled'],
      picked_up: ['heading_to_delivery', 'at_delivery', 'cancelled'],
      heading_to_delivery: ['at_delivery', 'cancelled'],
      at_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };

    return validTransitions[currentStatus]?.includes(targetStatus) || false;
  }

  /**
   * Schedule retry for error
   */
  scheduleRetry(errorRecord) {
    const strategy = this.recoveryStrategies.get(errorRecord.type);
    if (!strategy) return;

    setTimeout(() => {
      this.processErrorRecord(errorRecord);
    }, this.baseRetryDelay);
  }

  /**
   * Process error queue
   */
  async processErrorQueue() {
    if (this.errorQueue.length === 0) return;

    console.log(`🔄 Processing ${this.errorQueue.length} queued errors`);

    const batchSize = 3;
    const batch = this.errorQueue.slice(0, batchSize);

    for (const errorRecord of batch) {
      await this.processErrorRecord(errorRecord);
    }
  }

  /**
   * Process single error record
   */
  async processErrorRecord(errorRecord) {
    if (errorRecord.status === 'resolved' || errorRecord.status === 'failed') {
      return;
    }

    if (errorRecord.retryCount >= errorRecord.maxRetries) {
      errorRecord.status = 'failed';
      console.log(`❌ Error ${errorRecord.id} failed after ${errorRecord.maxRetries} attempts`);
      return;
    }

    errorRecord.retryCount++;
    
    const strategy = this.recoveryStrategies.get(errorRecord.type);
    if (strategy?.customHandler) {
      try {
        const result = await strategy.customHandler(errorRecord);
        if (!result.success) {
          // Schedule next retry
          this.scheduleRetry(errorRecord);
        }
      } catch (error) {
        console.error(`Error processing ${errorRecord.id}:`, error);
        this.scheduleRetry(errorRecord);
      }
    }

    await this.persistErrorQueue();
  }

  /**
   * Remove error from queue
   */
  removeFromQueue(errorId) {
    this.errorQueue = this.errorQueue.filter(error => error.id !== errorId);
    this.persistErrorQueue();
  }

  /**
   * Persist error queue to storage
   */
  async persistErrorQueue() {
    try {
      await AsyncStorage.setItem('deliveryErrorQueue', JSON.stringify(this.errorQueue));
    } catch (error) {
      console.error('Failed to persist error queue:', error);
    }
  }

  /**
   * Clear error queue
   */
  async clearErrorQueue() {
    this.errorQueue = [];
    await AsyncStorage.removeItem('deliveryErrorQueue');
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorQueue.length,
      pending: this.errorQueue.filter(e => e.status === 'pending').length,
      resolved: this.errorQueue.filter(e => e.status === 'resolved').length,
      failed: this.errorQueue.filter(e => e.status === 'failed').length,
      byType: {}
    };

    this.errorQueue.forEach(error => {
      if (!stats.byType[error.type]) {
        stats.byType[error.type] = 0;
      }
      stats.byType[error.type]++;
    });

    return stats;
  }

  /**
   * Wait utility function
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export default new DeliveryErrorRecovery();