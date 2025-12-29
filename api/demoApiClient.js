// DEPRECATED: Este archivo ya no se usa
// Todas las referencias han sido cambiadas a apiClient.js para usar producción

import apiClient from './apiClient';

// Re-exportar el cliente de producción para retrocompatibilidad
export default apiClient;

console.warn('⚠️ demoApiClient.js está deprecado. Usa apiClient.js directamente.');