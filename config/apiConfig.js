// Configuración centralizada de la API con mejor detección de red
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// IPs conocidas del servidor (actualizar según tu red)
const KNOWN_SERVER_IPS = [
  '172.26.236.81', // WSL IP actual (WORKING)
];

// Función para detectar si estamos en un emulador Android
const isAndroidEmulator = () => {
  return Platform.OS === 'android' && (
    Constants.isDevice === false ||
    Constants.deviceName?.includes('sdk_gphone') ||
    Constants.deviceName?.includes('emulator')
  );
};

// Función para detectar si estamos en un simulador iOS
const isIOSSimulator = () => {
  return Platform.OS === 'ios' && !Constants.isDevice;
};

// Obtener la IP del manifest de Expo
const getExpoHostIP = () => {
  try {
    const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      console.log('📱 Expo Host IP detectada:', ip);
      return ip;
    }
  } catch (e) {
    console.warn('⚠️ No se pudo obtener IP de Expo:', e);
  }
  return null;
};

// Configuración de la API
class ApiConfig {
  constructor() {
    this.BACKEND_PORT = 5000;
    this.TIMEOUT = 15000; // Aumentado a 15 segundos
    this.baseUrl = null;
    this.lastWorkingUrl = null;
  }

  // Probar si una URL está disponible usando axios (same as requests)
  async testUrl(url) {
    try {
      console.log(`🔍 Probando URL: ${url}`);
      
      // Use same timeout and method as actual requests
      const axios = require('axios');
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 200) {
        console.log(`✅ URL disponible: ${url}`);
        return true;
      }
    } catch (error) {
      console.log(`❌ URL no disponible: ${url}`, error.message);
    }
    return false;
  }

  // Obtener la mejor URL disponible
  async findBestUrl() {
    // Si tenemos una URL que funcionó antes, probarla primero
    if (this.lastWorkingUrl) {
      const isWorking = await this.testUrl(this.lastWorkingUrl);
      if (isWorking) {
        return this.lastWorkingUrl;
      }
    }

    const urlsToTest = [];

    // Para web
    if (Platform.OS === 'web') {
      urlsToTest.push(`http://localhost:${this.BACKEND_PORT}`);
    }
    
    // Para emulador Android
    if (isAndroidEmulator()) {
      urlsToTest.push(`http://10.0.2.2:${this.BACKEND_PORT}`);
    } else {
      // For physical devices, prioritize WSL IP
      urlsToTest.push(`http://172.26.236.81:${this.BACKEND_PORT}`);
    }
    
    // Para simulador iOS
    if (isIOSSimulator()) {
      urlsToTest.push(`http://localhost:${this.BACKEND_PORT}`);
      urlsToTest.push(`http://127.0.0.1:${this.BACKEND_PORT}`);
    }
    
    // IP detectada por Expo
    const expoIP = getExpoHostIP();
    if (expoIP) {
      urlsToTest.push(`http://${expoIP}:${this.BACKEND_PORT}`);
    }
    
    // IPs conocidas del servidor
    KNOWN_SERVER_IPS.forEach(ip => {
      urlsToTest.push(`http://${ip}:${this.BACKEND_PORT}`);
    });

    // Probar todas las URLs
    for (const baseUrl of urlsToTest) {
      const url = `${baseUrl}/api`;
      const isAvailable = await this.testUrl(url);
      if (isAvailable) {
        this.lastWorkingUrl = url;
        return url;
      }
    }

    // Fallback si nada funciona
    console.warn('⚠️ No se encontró servidor disponible, usando fallback');
    return `http://localhost:${this.BACKEND_PORT}/api`;
  }

  // Obtener URL base con cache
  async getBaseUrl() {
    // Si ya tenemos una URL base, usarla
    if (this.baseUrl) {
      return this.baseUrl;
    }

    // Buscar la mejor URL
    this.baseUrl = await this.findBestUrl();
    console.log('🔗 API URL configurada:', this.baseUrl);
    return this.baseUrl;
  }

  // Resetear la configuración (útil si cambia la red)
  reset() {
    this.baseUrl = null;
    console.log('🔄 Configuración de API reseteada');
  }

  // Obtener URL síncrona (para retrocompatibilidad)
  getBaseUrlSync() {
    if (this.baseUrl) {
      return this.baseUrl;
    }

    // Para web
    if (Platform.OS === 'web') {
      return `http://localhost:${this.BACKEND_PORT}/api`;
    }
    
    // Para emulador Android
    if (isAndroidEmulator()) {
      return `http://10.0.2.2:${this.BACKEND_PORT}/api`;
    }
    
    // Para simulador iOS
    if (isIOSSimulator()) {
      return `http://localhost:${this.BACKEND_PORT}/api`;
    }
    
    // Para dispositivo físico, usar IP detectada por Expo o WSL
    const expoIP = getExpoHostIP();
    if (expoIP) {
      return `http://${expoIP}:${this.BACKEND_PORT}/api`;
    }
    
    // Usar IP WSL directa como fallback (funciona siempre)
    return `http://172.26.236.81:${this.BACKEND_PORT}/api`;
  }
}

// Crear instancia singleton
const apiConfig = new ApiConfig();

// Exportar funciones helper
export const getApiUrl = () => apiConfig.getBaseUrlSync();
export const getApiUrlAsync = async () => await apiConfig.getBaseUrl();
export const resetApiConfig = () => apiConfig.reset();
export const API_TIMEOUT = apiConfig.TIMEOUT;

export default apiConfig;