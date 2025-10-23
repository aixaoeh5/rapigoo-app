import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// URL fija para desarrollo - CAMBIA SEGÚN TU ENTORNO
const API_BASE_URL = 'http://10.0.0.198:5000/api'; // TU IP LOCAL DETECTADA

// NOTA: Tu IP local Windows detectada es 10.0.0.198
// Si esta IP no funciona, puedes probar estas alternativas:

// Para Android Emulator:
// const API_BASE_URL = 'http://10.0.2.2:5000/api';

// Para iOS Simulator:
// const API_BASE_URL = 'http://localhost:5000/api';

console.log('📍 API configurada en:', API_BASE_URL);

// Crear cliente axios con configuración simple
const simpleApiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 segundos
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Request interceptor simple
simpleApiClient.interceptors.request.use(
  async (config) => {
    console.log(`📤 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    
    // Agregar token si existe
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔐 Token incluido');
      }
    } catch (error) {
      console.warn('⚠️ Error obteniendo token:', error);
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Error configurando request:', error);
    return Promise.reject(error);
  }
);

// Response interceptor simple
simpleApiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response) {
      // El servidor respondió con error
      console.error(`❌ Error ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      // No hubo respuesta
      console.error('❌ No hubo respuesta del servidor');
      console.error('URL intentada:', error.config?.baseURL + error.config?.url);
      console.error('Verifica que el servidor esté corriendo en:', API_BASE_URL);
    } else {
      // Error configurando la petición
      console.error('❌ Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default simpleApiClient;
export { API_BASE_URL };