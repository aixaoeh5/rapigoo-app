/**
 * Error Interceptor para capturar errores específicos de "Cannot convert undefined value to object"
 */

class ErrorInterceptor {
  static init() {
    // Interceptar errores globales
    const originalError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      if (errorMessage.includes('Cannot convert undefined value to object')) {
        console.log('🚨 INTERCEPTED ERROR:', {
          message: errorMessage,
          stack: new Error().stack,
          timestamp: new Date().toISOString(),
          location: 'Global Error Interceptor'
        });
        
        // Capturar el stack trace completo
        try {
          throw new Error('Stack trace capture');
        } catch (e) {
          console.log('📍 FULL STACK TRACE:', e.stack);
        }
      }
      originalError.apply(console, args);
    };

    // Interceptar warnings también
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const warnMessage = args.join(' ');
      if (warnMessage.includes('Cannot convert undefined value to object') || 
          warnMessage.includes('TypeError')) {
        console.log('⚠️ INTERCEPTED WARNING:', {
          message: warnMessage,
          stack: new Error().stack,
          timestamp: new Date().toISOString(),
          location: 'Global Warning Interceptor'
        });
      }
      originalWarn.apply(console, args);
    };

    // Error Handler global para React Native
    if (global.ErrorUtils) {
      const originalGlobalHandler = global.ErrorUtils.getGlobalHandler();
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        if (error.message && error.message.includes('Cannot convert undefined value to object')) {
          console.log('🔥 GLOBAL ERROR HANDLER INTERCEPTED:', {
            message: error.message,
            stack: error.stack,
            isFatal,
            timestamp: new Date().toISOString(),
            componentStack: error.componentStack
          });
        }
        originalGlobalHandler(error, isFatal);
      });
    }
  }

  static logObjectAccess(obj, propertyName, location) {
    console.log(`🔍 OBJECT ACCESS DEBUG [${location}]:`, {
      object: obj,
      objectType: typeof obj,
      isNull: obj === null,
      isUndefined: obj === undefined,
      propertyName,
      hasProperty: obj && obj.hasOwnProperty ? obj.hasOwnProperty(propertyName) : 'N/A',
      propertyValue: obj && obj[propertyName] !== undefined ? obj[propertyName] : 'UNDEFINED',
      timestamp: new Date().toISOString()
    });
  }

  static safeObjectDestructure(obj, defaultValue = {}, location = 'Unknown') {
    if (!obj || typeof obj !== 'object') {
      console.warn(`⚠️ SAFE DESTRUCTURE [${location}]: Invalid object`, {
        provided: obj,
        type: typeof obj,
        returning: defaultValue
      });
      return defaultValue;
    }
    return obj;
  }
}

export default ErrorInterceptor;