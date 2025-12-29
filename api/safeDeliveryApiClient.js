/**
 * Safe API Client for Delivery Operations
 * Wraps apiClient with comprehensive error handling and data validation
 * Prevents "cannot convert undefined value to object" errors
 */

import apiClient from './apiClient';
import DeliveryDataValidator from '../utils/DeliveryDataValidator';

class SafeDeliveryApiClient {
  static async executeWithRetry(operation, maxRetries = 3, context = '') {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempting API call (${attempt}/${maxRetries}): ${context}`);
        const result = await operation();
        
        console.log(`✅ API call successful on attempt ${attempt}: ${context}`);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ API call failed on attempt ${attempt}/${maxRetries}: ${context}`, error.message);
        
        // Don't retry for certain error types
        if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 404) {
          console.log(`🚫 Not retrying due to error status: ${error.response.status}`);
          break;
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    console.error(`❌ All retry attempts failed for: ${context}`, lastError);
    throw lastError;
  }

  static createSafeResponse(response, context = '') {
    try {
      return DeliveryDataValidator.createSafeApiResponse(response, context);
    } catch (error) {
      console.error(`❌ Failed to create safe response for ${context}:`, error);
      return {
        success: false,
        data: {},
        error: { message: 'Response processing failed', code: 'RESPONSE_PROCESSING_ERROR' },
        deliveries: [],
        orders: [],
        tracking: null,
        validation: { isValid: false, errors: [error.message], warnings: [] }
      };
    }
  }

  static async getActiveDeliveries(userId = null) {
    const context = `getActiveDeliveries${userId ? ` for user ${userId}` : ''}`;
    
    try {
      const response = await this.executeWithRetry(
        () => apiClient.get('/delivery/active'),
        3,
        context
      );
      
      const safeResponse = this.createSafeResponse(response, context);
      
      // Validate response structure specifically for active deliveries
      if (safeResponse.success) {
        // The API returns { success: true, data: { deliveries: [...] } }
        const deliveries = DeliveryDataValidator.safeObjectAccess(
          response, 
          'data.data.deliveries', 
          [], 
          context
        );
        
        // Validate each delivery
        const validatedDeliveries = deliveries
          .map((delivery, index) => {
            const validation = DeliveryDataValidator.validateDeliveryTracking(
              delivery, 
              `${context}.delivery[${index}]`
            );
            
            if (validation.isValid) {
              return validation.data;
            } else {
              console.warn(`⚠️ Invalid delivery data at index ${index}:`, validation.errors);
              return null;
            }
          })
          .filter(delivery => delivery !== null);
        
        return {
          success: true,
          deliveries: validatedDeliveries,
          error: null,
          validation: safeResponse.validation
        };
      } else {
        return {
          success: false,
          deliveries: [],
          error: safeResponse.error || { message: 'Unknown error', code: 'UNKNOWN_ERROR' },
          validation: safeResponse.validation
        };
      }
    } catch (error) {
      console.error(`❌ Error in ${context}:`, error);
      
      return {
        success: false,
        deliveries: [],
        error: {
          message: error.response?.data?.error?.message || error.message || 'Network error',
          code: error.response?.data?.error?.code || 'NETWORK_ERROR',
          status: error.response?.status || null
        },
        validation: { isValid: false, errors: [error.message], warnings: [] }
      };
    }
  }

  static async getAvailableOrders() {
    const context = 'getAvailableOrders';
    
    try {
      const response = await this.executeWithRetry(
        () => apiClient.get('/delivery/orders/available'),
        3,
        context
      );
      
      const safeResponse = this.createSafeResponse(response, context);
      
      if (safeResponse.success) {
        const orders = safeResponse.orders || [];
        
        // Validate and clean order data
        const validatedOrders = orders.map((order, index) => {
          if (!DeliveryDataValidator.isValidObject(order, `order[${index}]`, context)) {
            console.warn(`⚠️ Invalid order data at index ${index}`);
            return null;
          }
          
          return {
            _id: DeliveryDataValidator.safeObjectAccess(order, '_id', null, `${context}.order[${index}]._id`),
            orderNumber: DeliveryDataValidator.safeObjectAccess(order, 'orderNumber', 'N/A', `${context}.order[${index}].orderNumber`),
            total: DeliveryDataValidator.safeObjectAccess(order, 'total', 0, `${context}.order[${index}].total`),
            customerInfo: DeliveryDataValidator.safeObjectAccess(order, 'customerInfo', {}, `${context}.order[${index}].customerInfo`),
            merchantInfo: DeliveryDataValidator.safeObjectAccess(order, 'merchantInfo', {}, `${context}.order[${index}].merchantInfo`),
            deliveryInfo: DeliveryDataValidator.safeObjectAccess(order, 'deliveryInfo', {}, `${context}.order[${index}].deliveryInfo`),
            estimatedEarning: DeliveryDataValidator.safeObjectAccess(order, 'estimatedEarning', 0, `${context}.order[${index}].estimatedEarning`)
          };
        }).filter(order => order !== null && order._id);
        
        return {
          success: true,
          orders: validatedOrders,
          error: null,
          validation: safeResponse.validation
        };
      } else {
        return {
          success: false,
          orders: [],
          error: safeResponse.error || { message: 'Unknown error', code: 'UNKNOWN_ERROR' },
          validation: safeResponse.validation
        };
      }
    } catch (error) {
      console.error(`❌ Error in ${context}:`, error);
      
      return {
        success: false,
        orders: [],
        error: {
          message: error.response?.data?.error?.message || error.message || 'Network error',
          code: error.response?.data?.error?.code || 'NETWORK_ERROR',
          status: error.response?.status || null
        },
        validation: { isValid: false, errors: [error.message], warnings: [] }
      };
    }
  }

  static async acceptOrder(orderId) {
    const context = `acceptOrder(${orderId})`;
    
    if (!DeliveryDataValidator.isValidString(orderId, 'orderId', context, false)) {
      throw new Error('Invalid orderId provided');
    }
    
    try {
      const response = await this.executeWithRetry(
        () => apiClient.post(`/delivery/orders/${orderId}/accept`),
        2, // Fewer retries for mutations
        context
      );
      
      const safeResponse = this.createSafeResponse(response, context);
      
      if (safeResponse.success) {
        const tracking = safeResponse.tracking || DeliveryDataValidator.safeObjectAccess(
          response, 
          'data.tracking', 
          null, 
          context
        );
        
        if (tracking) {
          const validation = DeliveryDataValidator.validateDeliveryTracking(tracking, `${context}.tracking`);
          
          if (validation.isValid) {
            return {
              success: true,
              tracking: validation.data,
              error: null,
              validation: safeResponse.validation
            };
          } else {
            console.warn(`⚠️ Invalid tracking data received:`, validation.errors);
          }
        }
        
        return {
          success: true,
          tracking: null,
          error: null,
          validation: safeResponse.validation
        };
      } else {
        return {
          success: false,
          tracking: null,
          error: safeResponse.error || { message: 'Unknown error', code: 'UNKNOWN_ERROR' },
          validation: safeResponse.validation
        };
      }
    } catch (error) {
      console.error(`❌ Error in ${context}:`, error);
      
      return {
        success: false,
        tracking: null,
        error: {
          message: error.response?.data?.error?.message || error.message || 'Network error',
          code: error.response?.data?.error?.code || 'NETWORK_ERROR',
          status: error.response?.status || null
        },
        validation: { isValid: false, errors: [error.message], warnings: [] }
      };
    }
  }

  static async updateDeliveryStatus(trackingId, status, notes = '', location = null) {
    const context = `updateDeliveryStatus(${trackingId}, ${status})`;
    
    if (!DeliveryDataValidator.isValidString(trackingId, 'trackingId', context, false)) {
      throw new Error('Invalid trackingId provided');
    }
    
    if (!DeliveryDataValidator.isValidString(status, 'status', context, false)) {
      throw new Error('Invalid status provided');
    }
    
    try {
      const payload = { status, notes };
      if (location && DeliveryDataValidator.isValidObject(location, 'location', context)) {
        payload.location = location;
      }
      
      const response = await this.executeWithRetry(
        () => apiClient.put(`/delivery/${trackingId}/status`, payload),
        2,
        context
      );
      
      const safeResponse = this.createSafeResponse(response, context);
      
      if (safeResponse.success) {
        const deliveryTracking = DeliveryDataValidator.safeObjectAccess(
          response, 
          'data.data.deliveryTracking', 
          null, 
          context
        );
        
        if (deliveryTracking) {
          const validation = DeliveryDataValidator.validateDeliveryTracking(
            deliveryTracking, 
            `${context}.deliveryTracking`
          );
          
          if (validation.isValid) {
            return {
              success: true,
              deliveryTracking: validation.data,
              error: null,
              validation: safeResponse.validation
            };
          } else {
            console.warn(`⚠️ Invalid delivery tracking data received:`, validation.errors);
          }
        }
        
        return {
          success: true,
          deliveryTracking: null,
          error: null,
          validation: safeResponse.validation
        };
      } else {
        return {
          success: false,
          deliveryTracking: null,
          error: safeResponse.error || { message: 'Unknown error', code: 'UNKNOWN_ERROR' },
          validation: safeResponse.validation
        };
      }
    } catch (error) {
      console.error(`❌ Error in ${context}:`, error);
      
      return {
        success: false,
        deliveryTracking: null,
        error: {
          message: error.response?.data?.error?.message || error.message || 'Network error',
          code: error.response?.data?.error?.code || 'NETWORK_ERROR',
          status: error.response?.status || null
        },
        validation: { isValid: false, errors: [error.message], warnings: [] }
      };
    }
  }

  static async updateDeliveryLocation(trackingId, location) {
    const context = `updateDeliveryLocation(${trackingId})`;
    
    if (!DeliveryDataValidator.isValidString(trackingId, 'trackingId', context, false)) {
      throw new Error('Invalid trackingId provided');
    }
    
    if (!DeliveryDataValidator.isValidObject(location, 'location', context)) {
      throw new Error('Invalid location object provided');
    }
    
    // Validate location properties
    const requiredProps = ['latitude', 'longitude'];
    for (const prop of requiredProps) {
      if (typeof location[prop] !== 'number') {
        throw new Error(`Invalid location.${prop}: expected number, got ${typeof location[prop]}`);
      }
    }
    
    try {
      const response = await this.executeWithRetry(
        () => apiClient.put(`/delivery/${trackingId}/location`, location),
        2,
        context
      );
      
      const safeResponse = this.createSafeResponse(response, context);
      
      return {
        success: safeResponse.success,
        data: safeResponse.data,
        error: safeResponse.error,
        validation: safeResponse.validation
      };
    } catch (error) {
      console.error(`❌ Error in ${context}:`, error);
      
      return {
        success: false,
        data: null,
        error: {
          message: error.response?.data?.error?.message || error.message || 'Network error',
          code: error.response?.data?.error?.code || 'NETWORK_ERROR',
          status: error.response?.status || null
        },
        validation: { isValid: false, errors: [error.message], warnings: [] }
      };
    }
  }

  static async getDeliveryTracking(trackingId) {
    const context = `getDeliveryTracking(${trackingId})`;
    
    if (!DeliveryDataValidator.isValidString(trackingId, 'trackingId', context, false)) {
      throw new Error('Invalid trackingId provided');
    }
    
    try {
      const response = await this.executeWithRetry(
        () => apiClient.get(`/delivery/${trackingId}`),
        3,
        context
      );
      
      const safeResponse = this.createSafeResponse(response, context);
      
      if (safeResponse.success) {
        const deliveryTracking = DeliveryDataValidator.safeObjectAccess(
          response, 
          'data.data.deliveryTracking', 
          null, 
          context
        );
        
        if (deliveryTracking) {
          const validation = DeliveryDataValidator.validateDeliveryTracking(
            deliveryTracking, 
            context
          );
          
          if (validation.isValid) {
            return {
              success: true,
              deliveryTracking: validation.data,
              error: null,
              validation: safeResponse.validation
            };
          } else {
            console.warn(`⚠️ Invalid delivery tracking data:`, validation.errors);
            return {
              success: false,
              deliveryTracking: null,
              error: { message: 'Invalid tracking data structure', code: 'INVALID_DATA' },
              validation: validation
            };
          }
        } else {
          return {
            success: false,
            deliveryTracking: null,
            error: { message: 'No tracking data found', code: 'NO_TRACKING_DATA' },
            validation: safeResponse.validation
          };
        }
      } else {
        return {
          success: false,
          deliveryTracking: null,
          error: safeResponse.error || { message: 'Unknown error', code: 'UNKNOWN_ERROR' },
          validation: safeResponse.validation
        };
      }
    } catch (error) {
      console.error(`❌ Error in ${context}:`, error);
      
      return {
        success: false,
        deliveryTracking: null,
        error: {
          message: error.response?.data?.error?.message || error.message || 'Network error',
          code: error.response?.data?.error?.code || 'NETWORK_ERROR',
          status: error.response?.status || null
        },
        validation: { isValid: false, errors: [error.message], warnings: [] }
      };
    }
  }
}

export default SafeDeliveryApiClient;