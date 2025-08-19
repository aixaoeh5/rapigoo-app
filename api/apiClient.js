import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl, getApiUrlAsync, resetApiConfig, API_TIMEOUT } from '../config/universalApiConfig';

// Crear instancia de axios con configuración base
const apiClient = axios.create({
  timeout: API_TIMEOUT,
});

// Configurar baseURL dinámicamente antes de cada request
apiClient.interceptors.request.use(
  async config => {
    try {
      // Intentar obtener URL dinámica
      if (!config.baseURL) {
        try {
          // Primero intentar obtención asíncrona (más confiable)
          config.baseURL = await getApiUrlAsync();
        } catch (error) {
          // Fallback a obtención síncrona
          console.warn('⚠️ Usando URL síncrona como fallback');
          config.baseURL = getApiUrl();
        }
      }
      
      console.log('📡 API Request:', config.method?.toUpperCase(), config.baseURL + config.url);
      
      // Agregar token si existe
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔐 Token configurado en request');
      } else {
        console.log('⚠️ No hay token disponible');
      }
      
      // Headers adicionales
      config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
      config.headers['Accept'] = 'application/json';
      
      return config;
    } catch (error) {
      console.error('❌ Error configurando request:', error);
      return Promise.reject(error);
    }
  },
  err => {
    console.error('❌ Error en interceptor de request:', err);
    return Promise.reject(err);
  }
);

// Interceptor de respuesta con mejor manejo de errores
apiClient.interceptors.response.use(
  res => {
    console.log('✅ API Response:', res.status, res.config.url);
    return res;
  },
  async err => {
    // Log detallado del error
    if (err.response) {
      // El servidor respondió con un código de error
      console.log('❌ API Error Response:', {
        status: err.response.status,
        data: err.response.data,
        url: err.config?.url
      });
      
      if (err.response.status === 401) {
        console.log('🚫 Token expirado o inválido, limpiando storage');
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('userData');
      }
    } else if (err.request) {
      // La petición se hizo pero no hubo respuesta
      console.log('❌ No response received:', {
        url: err.config?.url,
        message: err.message,
        code: err.code
      });
      
      // Si es un error de red, intentar resetear la configuración
      if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || err.message.includes('Network Error')) {
        console.log('🔄 Reseteando configuración de API por error de red');
        try {
          resetApiConfig();
        } catch (resetError) {
          console.warn('⚠️ Error al resetear configuración:', resetError.message);
        }
      }
    } else {
      // Error al configurar la petición
      console.log('❌ Request setup error:', err.message);
    }
    
    return Promise.reject(err);
  }
);

// Función helper para reintentar peticiones fallidas
export const retryRequest = async (requestFunc, maxRetries = 3) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`🔄 Intento ${i + 1}/${maxRetries}`);
      const result = await requestFunc();
      return result;
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        // Resetear configuración antes de reintentar
        resetApiConfig();
        
        // Esperar con backoff exponencial
        const delay = Math.min(1000 * Math.pow(2, i), 5000);
        console.log(`⏳ Esperando ${delay}ms antes de reintentar...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

export { apiClient, resetApiConfig };
export default apiClient;
