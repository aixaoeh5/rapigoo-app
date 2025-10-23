// Configuración universal de API que funciona en cualquier entorno
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Función para detectar entorno
const detectEnvironment = () => {
  if (Platform.OS === 'web') return 'web';
  if (Platform.OS === 'android' && !Constants.isDevice) return 'android-emulator';
  if (Platform.OS === 'ios' && !Constants.isDevice) return 'ios-simulator';
  return 'device';
};

// Obtener IP del desarrollador automáticamente desde Expo
const getExpoDevServerIP = () => {
  try {
    // Expo Dev Server detecta automáticamente la IP del desarrollador
    const hostUri = Constants.expoConfig?.hostUri || 
                   Constants.manifest2?.extra?.expoClient?.hostUri ||
                   Constants.manifest?.debuggerHost ||
                   Constants.manifest2?.extra?.expoGo?.debuggerHost;
    
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      console.log('🔍 IP detectada automáticamente por Expo:', ip);
      return ip;
    }
  } catch (e) {
    console.warn('⚠️ No se pudo obtener IP de Expo:', e.message);
  }
  return null;
};

class UniversalApiConfig {
  constructor() {
    // Leer configuración desde variables de entorno con fallbacks
    this.PORT = parseInt(process.env.EXPO_PUBLIC_API_PORT) || 5000;
    this.TIMEOUT = parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT) || 15000;
    this.customHost = process.env.EXPO_PUBLIC_API_HOST;
    this.customUrl = process.env.EXPO_PUBLIC_API_URL;
    this.debugNetwork = process.env.EXPO_PUBLIC_DEBUG_NETWORK === 'true';
    
    this.cachedUrl = null;
    this.environment = detectEnvironment();
    
    if (this.debugNetwork) {
      console.log('🔧 Config Universal API:', {
        port: this.PORT,
        timeout: this.TIMEOUT,
        customHost: this.customHost,
        customUrl: this.customUrl,
        environment: this.environment
      });
    }
  }

  // URLs por entorno de desarrollo
  getEnvironmentUrls() {
    // Si hay URL personalizada, usarla directamente
    if (this.customUrl) {
      return [this.customUrl.replace('/api', '')];
    }
    
    // Si hay host personalizado, usarlo
    if (this.customHost) {
      return [`http://${this.customHost}:${this.PORT}`];
    }
    
    const detectedIP = getExpoDevServerIP();
    
    switch (this.environment) {
      case 'web':
        return [`http://localhost:${this.PORT}`];
        
      case 'android-emulator':
        return [
          `http://10.0.2.2:${this.PORT}`, // Android emulator localhost
          detectedIP ? `http://${detectedIP}:${this.PORT}` : null
        ].filter(Boolean);
        
      case 'ios-simulator':
        return [
          `http://localhost:${this.PORT}`,
          `http://127.0.0.1:${this.PORT}`,
          detectedIP ? `http://${detectedIP}:${this.PORT}` : null
        ].filter(Boolean);
        
      case 'device':
      default:
        return [
          detectedIP ? `http://${detectedIP}:${this.PORT}` : null,
          'http://192.168.1.100:5000', // Common router IP range
          'http://192.168.0.100:5000',
          'http://10.0.0.100:5000'
        ].filter(Boolean);
    }
  }

  // Probar conectividad usando axios (igual que las peticiones reales)
  async testConnection(baseUrl) {
    try {
      const url = `${baseUrl}/api`;
      console.log(`🔍 Probando: ${url}`);
      
      // Importar axios dinámicamente para React Native
      const axios = require('axios');
      const response = await axios.get(url, {
        timeout: 3000,
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.status === 200) {
        console.log(`✅ Conectado: ${url}`);
        return url;
      }
    } catch (error) {
      console.log(`❌ Error: ${baseUrl} - ${error.message}`);
    }
    return null;
  }

  // Encontrar automáticamente la URL que funciona
  async findWorkingUrl() {
    console.log(`🔍 Entorno detectado: ${this.environment}`);
    
    const urlsToTest = this.getEnvironmentUrls();
    console.log('🔍 URLs a probar:', urlsToTest);

    // Probar URLs en paralelo para mayor velocidad
    const promises = urlsToTest.map(baseUrl => this.testConnection(baseUrl));
    const results = await Promise.allSettled(promises);
    
    // Encontrar la primera URL que funciona
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled' && results[i].value) {
        const workingUrl = results[i].value;
        this.cachedUrl = workingUrl;
        console.log('🎉 URL de trabajo encontrada:', workingUrl);
        return workingUrl;
      }
    }

    // Fallback si nada funciona
    const fallback = `http://localhost:${this.PORT}/api`;
    console.warn('⚠️ No se encontró servidor, usando fallback:', fallback);
    return fallback;
  }

  // Método público para obtener URL
  async getApiUrl() {
    if (!this.cachedUrl) {
      this.cachedUrl = await this.findWorkingUrl();
    }
    return this.cachedUrl;
  }

  // Método síncrono para retrocompatibilidad
  getApiUrlSync() {
    if (this.cachedUrl) {
      return this.cachedUrl;
    }

    // Fallback inmediato basado en entorno
    const detectedIP = getExpoDevServerIP();
    
    switch (this.environment) {
      case 'android-emulator':
        return `http://10.0.2.2:${this.PORT}/api`;
      case 'web':
      case 'ios-simulator':
        return `http://localhost:${this.PORT}/api`;
      default:
        return detectedIP 
          ? `http://${detectedIP}:${this.PORT}/api`
          : `http://localhost:${this.PORT}/api`;
    }
  }

  // Resetear cache (útil si cambia la red)
  reset() {
    this.cachedUrl = null;
    console.log('🔄 Cache de URL reseteado');
  }
}

// Singleton instance
const universalApiConfig = new UniversalApiConfig();

export const getApiUrl = () => universalApiConfig.getApiUrlSync();
export const getApiUrlAsync = async () => await universalApiConfig.getApiUrl();
export const resetApiConfig = () => universalApiConfig.reset();
export const API_TIMEOUT = universalApiConfig.TIMEOUT;

export default universalApiConfig;