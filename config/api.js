// Configuración centralizada de la API con detección automática
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Función para detectar si estamos en un emulador Android
const isAndroidEmulator = () => {
  return Platform.OS === 'android' && (
    Constants.isDevice === false ||
    Constants.deviceName?.includes('sdk_gphone') ||
    Constants.deviceName?.includes('emulator')
  );
};

// Obtener la IP del manifest de Expo (detecta automáticamente la IP del servidor)
const getExpoHostIP = () => {
  try {
    const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      return ip;
    }
  } catch (e) {
    console.warn('No se pudo obtener IP de Expo:', e);
  }
  return null;
};

// Configuración dinámica
const API_CONFIG = {
  // Puerto del backend
  BACKEND_PORT: 5000,
  
  // Timeout en milisegundos
  TIMEOUT: 10000,
  
  // Obtener URL base dinámicamente
  getBaseUrl: () => {
    // Para web, siempre localhost
    if (Platform.OS === 'web') {
      return `http://localhost:${API_CONFIG.BACKEND_PORT}/api`;
    }
    
    // Para emulador Android
    if (isAndroidEmulator()) {
      return `http://10.0.2.2:${API_CONFIG.BACKEND_PORT}/api`;
    }
    
    // Para dispositivo físico, usar IP detectada por Expo
    const expoIP = getExpoHostIP();
    if (expoIP) {
      return `http://${expoIP}:${API_CONFIG.BACKEND_PORT}/api`;
    }
    
    // Fallback
    console.warn('⚠️  No se pudo detectar IP, usando localhost');
    return `http://localhost:${API_CONFIG.BACKEND_PORT}/api`;
  }
};

// Función principal para obtener la URL de la API
export const getApiUrl = () => {
  const url = API_CONFIG.getBaseUrl();
  console.log('🔗 API URL:', url);
  return url;
};

export default API_CONFIG;