const mongoose = require('mongoose');

/**
 * Transaction helper utilities for consistent transaction handling
 */

class TransactionHelper {
  /**
   * Execute a function within a MongoDB transaction
   * @param {Function} operation - Async function to execute in transaction
   * @param {Object} options - Transaction options
   * @returns {Promise} Result of the operation
   */
  static async withTransaction(operation, options = {}) {
    const session = await mongoose.startSession();
    
    try {
      const result = await session.withTransaction(
        async () => {
          return await operation(session);
        },
        {
          readPreference: 'primary',
          readConcern: { level: 'local' },
          writeConcern: { w: 'majority' },
          ...options
        }
      );
      
      return result;
    } catch (error) {
      console.error('Transaction failed:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }
  
  /**
   * Execute multiple operations in a single transaction
   * @param {Array} operations - Array of {model, operation, data} objects
   * @param {Object} options - Transaction options
   * @returns {Promise<Array>} Results of all operations
   */
  static async executeMultiple(operations, options = {}) {
    return this.withTransaction(async (session) => {
      const results = [];
      
      for (const op of operations) {
        let result;
        
        switch (op.operation) {
          case 'create':
            result = await op.model.create([op.data], { session });
            results.push(result[0]);
            break;
            
          case 'update':
            result = await op.model.findByIdAndUpdate(
              op.id,
              op.data,
              { session, new: true, ...op.options }
            );
            results.push(result);
            break;
            
          case 'delete':
            result = await op.model.findByIdAndDelete(op.id, { session });
            results.push(result);
            break;
            
          case 'findAndUpdate':
            result = await op.model.findOneAndUpdate(
              op.filter,
              op.data,
              { session, new: true, ...op.options }
            );
            results.push(result);
            break;
            
          default:
            throw new Error(`Unsupported operation: ${op.operation}`);
        }
      }
      
      return results;
    }, options);
  }
  
  /**
   * Safely execute an order creation with cart clearing
   * @param {Object} orderData - Order data to create
   * @param {Object} cart - Cart to clear
   * @returns {Promise<Object>} Created order
   */
  static async createOrderAndClearCart(orderData, cart) {
    return this.withTransaction(async (session) => {
      // Create order
      const orderArray = await orderData.constructor.create([orderData], { session });
      const order = orderArray[0];
      
      // Clear cart
      await cart.clear({ session });
      
      console.log(`✅ Order ${order.orderNumber} created and cart cleared in transaction`);
      return order;
    });
  }
  
  /**
   * Safely assign delivery person to order
   * @param {Object} order - Order to assign
   * @param {String} deliveryPersonId - Delivery person ID
   * @param {Object} deliveryTracking - Delivery tracking to create/update
   * @returns {Promise<Object>} Updated order and tracking
   */
  static async assignDeliveryPerson(order, deliveryPersonId, deliveryTracking) {
    return this.withTransaction(async (session) => {
      // Check if order is still available
      const currentOrder = await order.constructor.findById(order._id).session(session);
      
      if (currentOrder.deliveryPersonId && 
          currentOrder.deliveryPersonId.toString() !== deliveryPersonId) {
        throw new Error('Order already assigned to another delivery person');
      }
      
      // Update order
      currentOrder.deliveryPersonId = deliveryPersonId;
      if (currentOrder.status === 'ready') {
        await currentOrder.updateStatus('assigned', 'Delivery asignado');
      } else {
        await currentOrder.save({ session });
      }
      
      // Save delivery tracking
      await deliveryTracking.save({ session });
      
      console.log(`✅ Delivery ${deliveryPersonId} assigned to order ${order._id} in transaction`);
      return { order: currentOrder, tracking: deliveryTracking };
    });
  }
  
  /**
   * Retry a transaction operation with exponential backoff
   * @param {Function} operation - Operation to retry
   * @param {Number} maxRetries - Maximum retry attempts
   * @param {Number} baseDelay - Base delay in milliseconds
   * @returns {Promise} Result of the operation
   */
  static async withRetry(operation, maxRetries = 3, baseDelay = 100) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Only retry transient transaction errors
        if (error.errorLabels && error.errorLabels.includes('TransientTransactionError')) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            console.warn(`Transaction attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }
  
  /**
   * Check if MongoDB supports transactions
   * @returns {Promise<Boolean>} True if transactions are supported
   */
  static async isTransactionSupported() {
    try {
      const adminDb = mongoose.connection.db.admin();
      const status = await adminDb.replSetGetStatus();
      return true; // Replica set is available
    } catch (error) {
      console.warn('Transactions not supported:', error.message);
      return false;
    }
  }
}

module.exports = TransactionHelper;