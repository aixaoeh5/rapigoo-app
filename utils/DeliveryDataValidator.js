// Comprehensive utility for validating delivery data and preventing undefined object conversion errors
import { Alert } from 'react-native';

export class DeliveryDataValidator {
  static logValidationError(field, value, expected, context = '') {
    const errorDetails = {
      timestamp: new Date().toISOString(),
      field,
      receivedValue: value,
      receivedType: typeof value,
      expected,
      context,
      stack: new Error().stack
    };
    
    console.group('🔍 DELIVERY DATA VALIDATION ERROR');
    console.error('❌ Validation failed for field:', field);
    console.error('📥 Received:', value, `(type: ${typeof value})`);
    console.error('✅ Expected:', expected);
    console.error('📍 Context:', context);
    console.error('📊 Full details:', errorDetails);
    console.groupEnd();
    
    return errorDetails;
  }

  static isValidObject(obj, fieldName = 'object', context = '') {
    if (obj === null || obj === undefined) {
      this.logValidationError(fieldName, obj, 'non-null object', context);
      return false;
    }
    
    if (typeof obj !== 'object') {
      this.logValidationError(fieldName, obj, 'object type', context);
      return false;
    }
    
    return true;
  }

  static isValidArray(arr, fieldName = 'array', context = '') {
    if (!Array.isArray(arr)) {
      this.logValidationError(fieldName, arr, 'array', context);
      return false;
    }
    
    return true;
  }

  static isValidString(str, fieldName = 'string', context = '', allowEmpty = true) {
    if (typeof str !== 'string') {
      this.logValidationError(fieldName, str, 'string', context);
      return false;
    }
    
    if (!allowEmpty && str.trim() === '') {
      this.logValidationError(fieldName, str, 'non-empty string', context);
      return false;
    }
    
    return true;
  }

  static isValidCoordinates(coords, fieldName = 'coordinates', context = '') {
    if (!this.isValidArray(coords, fieldName, context)) {
      return false;
    }
    
    if (coords.length !== 2) {
      this.logValidationError(fieldName, coords, 'array with exactly 2 elements', context);
      return false;
    }
    
    const [longitude, latitude] = coords;
    
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      this.logValidationError(fieldName, coords, 'array of two numbers [longitude, latitude]', context);
      return false;
    }
    
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      this.logValidationError(fieldName, coords, 'valid coordinates within bounds', context);
      return false;
    }
    
    return true;
  }

  static validateApiResponse(response, expectedStructure, context = '') {
    console.log(`🔍 Validating API response for: ${context}`);
    
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check if response exists
    if (!this.isValidObject(response, 'response', context)) {
      validation.isValid = false;
      validation.errors.push('Response is null or undefined');
      return validation;
    }

    // Check if response.data exists
    if (!this.isValidObject(response.data, 'response.data', context)) {
      validation.isValid = false;
      validation.errors.push('Response data is null or undefined');
      return validation;
    }

    const { data } = response;

    // Check success field
    if (typeof data.success !== 'boolean') {
      validation.isValid = false;
      validation.errors.push(`Success field is not boolean: ${typeof data.success}`);
    }

    // If response is not successful, check for error structure
    if (data.success === false) {
      if (!this.isValidObject(data.error, 'response.data.error', context)) {
        validation.warnings.push('Error response missing error details');
      }
      return validation; // Don't validate data structure if response failed
    }

    if (validation.errors.length > 0) {
      console.error('❌ API Response validation failed:', validation.errors);
    } else if (validation.warnings.length > 0) {
      console.warn('⚠️ API Response has warnings:', validation.warnings);
    } else {
      console.log('✅ API Response validation passed');
    }

    return validation;
  }

  static createSafeApiResponse(response, context = '') {
    console.log(`🛡️ Creating safe API response for: ${context}`);
    
    const validation = this.validateApiResponse(response, null, context);
    
    const safeResponse = {
      success: this.safeObjectAccess(response, 'data.success', false, context),
      data: this.safeObjectAccess(response, 'data.data', {}, context),
      error: this.safeObjectAccess(response, 'data.error', null, context),
      deliveries: this.safeObjectAccess(response, 'data.deliveries', [], context),
      orders: this.safeObjectAccess(response, 'data.orders', [], context),
      tracking: this.safeObjectAccess(response, 'data.tracking', null, context),
      validation
    };

    console.log(`✅ Safe API response created for: ${context}`, {
      success: safeResponse.success,
      hasData: !!safeResponse.data,
      hasError: !!safeResponse.error,
      deliveriesCount: safeResponse.deliveries.length,
      ordersCount: safeResponse.orders.length,
      hasTracking: !!safeResponse.tracking
    });

    return safeResponse;
  }

  static safeObjectAccess(obj, path, defaultValue = null, context = '') {
    if (!this.isValidObject(obj, 'obj', `safeObjectAccess: ${context}`)) {
      return defaultValue;
    }

    try {
      const keys = path.split('.');
      let current = obj;
      
      for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
          console.warn(`⚠️ Safe object access failed at key '${key}' in path '${path}' for context: ${context}`);
          return defaultValue;
        }
        current = current[key];
      }
      
      return current !== undefined ? current : defaultValue;
    } catch (error) {
      console.error(`❌ Error in safe object access for path '${path}' in context '${context}':`, error);
      return defaultValue;
    }
  }
  /**
   * Validate delivery data structure
   * @param {Object} deliveryData - The delivery data to validate
   * @returns {Object} - Validation result with isValid and errors
   */
  static validateDeliveryData(deliveryData) {
    const errors = [];
    
    if (!deliveryData) {
      errors.push('deliveryData is null or undefined');
      return { isValid: false, errors };
    }
    
    if (!deliveryData._id) {
      errors.push('deliveryData._id is missing');
    }
    
    if (!deliveryData.status) {
      errors.push('deliveryData.status is missing');
    }
    
    if (!deliveryData.orderId) {
      errors.push('deliveryData.orderId is missing');
    }
    
    if (!deliveryData.deliveryPersonId) {
      errors.push('deliveryData.deliveryPersonId is missing');
    }
    
    // Validate locations
    if (!deliveryData.pickupLocation?.coordinates || 
        !Array.isArray(deliveryData.pickupLocation.coordinates) ||
        deliveryData.pickupLocation.coordinates.length !== 2) {
      errors.push('deliveryData.pickupLocation.coordinates is invalid');
    }
    
    if (!deliveryData.deliveryLocation?.coordinates || 
        !Array.isArray(deliveryData.deliveryLocation.coordinates) ||
        deliveryData.deliveryLocation.coordinates.length !== 2) {
      errors.push('deliveryData.deliveryLocation.coordinates is invalid');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate navigation parameters
   * @param {Object} params - Navigation route params
   * @returns {Object} - Validation result with cleaned params
   */
  static validateNavigationParams(params) {
    const cleanedParams = {
      deliveryTracking: null,
      trackingId: null,
      orderId: null
    };
    
    if (!params) {
      return { 
        isValid: false, 
        error: 'No navigation parameters provided',
        params: cleanedParams 
      };
    }
    
    // Extract deliveryTracking
    if (params.deliveryTracking && typeof params.deliveryTracking === 'object') {
      cleanedParams.deliveryTracking = params.deliveryTracking;
    }
    
    // Extract trackingId from various possible sources
    cleanedParams.trackingId = 
      params.trackingId || 
      params.deliveryTrackingId || 
      params._id || 
      params.deliveryTracking?._id || 
      null;
    
    // Extract orderId from various possible sources
    cleanedParams.orderId = 
      params.orderId || 
      params.order?._id || 
      params.deliveryTracking?.orderId || 
      null;
    
    const hasMinimumData = cleanedParams.trackingId || cleanedParams.deliveryTracking?._id;
    
    return {
      isValid: hasMinimumData,
      error: hasMinimumData ? null : 'No valid trackingId or deliveryTracking._id found',
      params: cleanedParams
    };
  }
  
  /**
   * Safe getter for delivery data properties
   * @param {Object} deliveryData - The delivery data
   * @param {string} path - Dot notation path (e.g., 'pickupLocation.coordinates')
   * @param {*} defaultValue - Default value if path not found
   * @returns {*} - The value at path or defaultValue
   */
  static safeGet(deliveryData, path, defaultValue = null) {
    if (!deliveryData || !path) return defaultValue;
    
    const keys = path.split('.');
    let current = deliveryData;
    
    for (const key of keys) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current;
  }
  
  /**
   * Show user-friendly error for validation failures
   * @param {Object} validation - Validation result
   * @param {Function} navigation - Navigation object
   */
  static handleValidationError(validation, navigation) {
    console.error('❌ Delivery data validation failed:', validation.errors);
    
    Alert.alert(
      'Error de Datos',
      'Los datos de delivery están incompletos. Volviendo al inicio.',
      [
        {
          text: 'Volver al Inicio',
          onPress: () => navigation.replace('HomeDelivery')
        }
      ]
    );
  }
  
  /**
   * Create a safe wrapper for delivery operations
   * @param {Object} deliveryData - The delivery data
   * @param {Function} operation - The operation to perform
   * @param {Function} onError - Error handler
   * @returns {Promise<*>} - Operation result or null
   */
  static async safeDeliveryOperation(deliveryData, operation, onError = null) {
    const validation = this.validateDeliveryData(deliveryData);
    
    if (!validation.isValid) {
      console.warn('⚠️ Skipping operation due to invalid delivery data:', validation.errors);
      if (onError) {
        onError(new Error(`Invalid delivery data: ${validation.errors.join(', ')}`));
      }
      return null;
    }
    
    try {
      return await operation(deliveryData);
    } catch (error) {
      console.error('❌ Safe delivery operation failed:', error);
      if (onError) {
        onError(error);
      }
      return null;
    }
  }
  
  /**
   * Repair delivery data by adding missing fields
   * @param {Object} deliveryData - Potentially incomplete delivery data
   * @returns {Object} - Repaired delivery data
   */
  static repairDeliveryData(deliveryData) {
    if (!deliveryData) return null;
    
    const repaired = { ...deliveryData };
    
    // Ensure _id exists
    if (!repaired._id && (repaired.id || repaired.trackingId)) {
      repaired._id = repaired.id || repaired.trackingId;
    }
    
    // Ensure status exists
    if (!repaired.status) {
      repaired.status = 'assigned';
    }
    
    // Ensure locations have proper structure
    if (repaired.pickupLocation && !repaired.pickupLocation.coordinates) {
      repaired.pickupLocation.coordinates = [0, 0];
    }
    
    if (repaired.deliveryLocation && !repaired.deliveryLocation.coordinates) {
      repaired.deliveryLocation.coordinates = [0, 0];
    }
    
    return repaired;
  }
}

export default DeliveryDataValidator;