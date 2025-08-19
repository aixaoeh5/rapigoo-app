/**
 * Utilidad para manejar errores de API de forma consistente en toda la aplicación
 */

import { Alert } from 'react-native';

// Mensajes de error amigables para el usuario
const ERROR_MESSAGES = {
  // Errores de red/conexión
  'NETWORK_ERROR': 'No se pudo conectar al servidor. Verifica tu conexión a internet.',
  'TIMEOUT': 'La solicitud tardó demasiado. Intenta de nuevo.',
  'CONNECTION_REFUSED': 'No se pudo conectar al servidor. El servicio podría estar temporalmente no disponible.',
  
  // Errores HTTP específicos
  400: 'Los datos enviados no son válidos.',
  401: 'Tu sesión ha expirado. Por favor inicia sesión de nuevo.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'El recurso solicitado no fue encontrado.',
  422: 'Los datos enviados contienen errores.',
  429: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.',
  500: 'Error interno del servidor. Intenta de nuevo más tarde.',
  502: 'El servidor está temporalmente no disponible.',
  503: 'El servicio está en mantenimiento. Intenta más tarde.',
  504: 'El servidor tardó demasiado en responder.',
  
  // Errores por defecto
  'DEFAULT': 'Ocurrió un error inesperado. Intenta de nuevo.'
};

/**
 * Analiza un error de Axios y devuelve información estructurada
 * @param {Error} error - El error de Axios
 * @returns {Object} Información del error estructurada
 */
export const analyzeError = (error) => {
  const errorInfo = {
    code: null,
    message: ERROR_MESSAGES.DEFAULT,
    isNetworkError: false,
    isServerError: false,
    isClientError: false,
    canRetry: false,
    originalError: error
  };

  if (!error) {
    return errorInfo;
  }

  // Error de red (sin respuesta del servidor)
  if (error.code === 'ECONNREFUSED' || error.code === 'ERR_NETWORK') {
    errorInfo.code = 'CONNECTION_REFUSED';
    errorInfo.message = ERROR_MESSAGES.CONNECTION_REFUSED;
    errorInfo.isNetworkError = true;
    errorInfo.canRetry = true;
    return errorInfo;
  }

  // Error de timeout
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    errorInfo.code = 'TIMEOUT';
    errorInfo.message = ERROR_MESSAGES.TIMEOUT;
    errorInfo.isNetworkError = true;
    errorInfo.canRetry = true;
    return errorInfo;
  }

  // Error con respuesta del servidor
  if (error.response) {
    const status = error.response.status;
    errorInfo.code = status;

    // Errores del cliente (4xx)
    if (status >= 400 && status < 500) {
      errorInfo.isClientError = true;
      errorInfo.canRetry = status === 429; // Solo retry para rate limiting
      
      // Usar mensaje específico del servidor si está disponible
      const serverMessage = error.response.data?.error?.message || error.response.data?.message;
      errorInfo.message = serverMessage || ERROR_MESSAGES[status] || ERROR_MESSAGES.DEFAULT;
    }
    
    // Errores del servidor (5xx)
    else if (status >= 500) {
      errorInfo.isServerError = true;
      errorInfo.canRetry = true;
      errorInfo.message = ERROR_MESSAGES[status] || ERROR_MESSAGES[500];
    }
  }

  return errorInfo;
};

/**
 * Maneja errores de API con logging y notificación opcional al usuario
 * @param {Error} error - El error de Axios
 * @param {Object} options - Opciones de manejo
 * @param {string} options.context - Contexto donde ocurrió el error
 * @param {boolean} options.showAlert - Si mostrar alerta al usuario
 * @param {string} options.customMessage - Mensaje personalizado para mostrar
 * @param {Function} options.onRetry - Función a llamar para reintentar
 * @returns {Object} Información del error analizada
 */
export const handleApiError = (error, options = {}) => {
  const {
    context = 'API Call',
    showAlert = true,
    customMessage = null,
    onRetry = null
  } = options;

  const errorInfo = analyzeError(error);

  // Log detallado del error para debugging
  console.group(`❌ ${context} Error`);
  console.error('Error Code:', errorInfo.code);
  console.error('Error Message:', errorInfo.message);
  console.error('Is Network Error:', errorInfo.isNetworkError);
  console.error('Can Retry:', errorInfo.canRetry);
  console.error('Original Error:', error);
  if (error?.response) {
    console.error('Response Status:', error.response.status);
    console.error('Response Data:', error.response.data);
  }
  console.groupEnd();

  // Mostrar alerta al usuario si se solicita
  if (showAlert) {
    const messageToShow = customMessage || errorInfo.message;
    
    if (errorInfo.canRetry && onRetry) {
      Alert.alert(
        'Error',
        messageToShow,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Reintentar', onPress: onRetry }
        ]
      );
    } else {
      Alert.alert('Error', messageToShow);
    }
  }

  return errorInfo;
};

/**
 * Wrapper para llamadas a la API con manejo de errores automático
 * @param {Function} apiCall - Función que realiza la llamada a la API
 * @param {Object} options - Opciones de manejo de error
 * @returns {Promise} Promesa con el resultado de la API
 */
export const safeApiCall = async (apiCall, options = {}) => {
  const {
    context = 'API Call',
    showAlert = true,
    fallbackValue = null,
    maxRetries = 0,
    retryDelay = 1000
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      lastError = error;
      const errorInfo = analyzeError(error);

      // Si no se puede reintentar o es el último intento
      if (!errorInfo.canRetry || attempt === maxRetries) {
        handleApiError(error, { context, showAlert });
        return fallbackValue;
      }

      // Esperar antes del siguiente intento
      if (attempt < maxRetries && retryDelay > 0) {
        console.log(`⏳ Retrying ${context} in ${retryDelay}ms... (Attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // Esto no debería ejecutarse nunca, pero por seguridad
  return fallbackValue;
};

/**
 * Utilitarios específicos para endpoints comunes
 */
export const EndpointHandlers = {
  // Para endpoints que pueden fallar sin afectar la UX (como categorías, featured merchants, etc.)
  optional: {
    context: 'Optional Data',
    showAlert: false,
    fallbackValue: []
  },

  // Para endpoints críticos que requieren autenticación
  authenticated: {
    context: 'Authenticated Request',
    showAlert: true,
    maxRetries: 1
  },

  // Para endpoints de datos de usuario
  userSpecific: {
    context: 'User Data',
    showAlert: false, // No mostrar alert para datos opcionales del usuario
    fallbackValue: null
  }
};

export default {
  analyzeError,
  handleApiError,
  safeApiCall,
  EndpointHandlers
};