// Script de prueba de conectividad API
import { getApiUrl, getApiUrlAsync, resetApiConfig } from './config/apiConfig';
import apiClient from './api/apiClient';

const testConnection = async () => {
  console.log('🔍 Iniciando prueba de conectividad...\n');
  
  // Probar obtención de URL síncrona
  console.log('📍 URL Síncrona:', getApiUrl());
  
  // Probar obtención de URL asíncrona
  try {
    const asyncUrl = await getApiUrlAsync();
    console.log('📍 URL Asíncrona:', asyncUrl);
  } catch (error) {
    console.error('❌ Error obteniendo URL asíncrona:', error);
  }
  
  // Probar login
  console.log('\n🔐 Probando endpoint de login...');
  try {
    const response = await apiClient.post('/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    console.log('✅ Login exitoso!');
    console.log('Token:', response.data.token?.substring(0, 50) + '...');
    console.log('Usuario:', response.data.user);
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    if (error.response) {
      console.log('Respuesta del servidor:', error.response.data);
    } else if (error.request) {
      console.log('No se recibió respuesta del servidor');
      console.log('URL intentada:', error.config?.baseURL + error.config?.url);
    }
  }
  
  // Probar health check
  console.log('\n🏥 Probando health check...');
  try {
    const response = await apiClient.get('/health');
    console.log('✅ Health check exitoso:', response.data);
  } catch (error) {
    console.error('❌ Error en health check:', error.message);
  }
};

// Exportar para uso en la app
export default testConnection;