// Configuración estática de API para desarrollo
// Este archivo usa una URL fija para evitar problemas de detección automática

const API_URL = 'http://10.0.2.2:5000/api'; // Para Android Emulator

// Si estás usando un dispositivo físico, cambia a tu IP local:
// const API_URL = 'http://192.168.1.XXX:5000/api';

// Si estás en WSL y no funciona 10.0.2.2, prueba:
// const API_URL = 'http://172.26.236.81:5000/api';

export const getApiUrl = () => {
  console.log('🔗 Using static API URL:', API_URL);
  return API_URL;
};

export default API_URL;