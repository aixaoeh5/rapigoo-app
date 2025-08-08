import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';

const apiClient = axios.create({
  baseURL: getApiUrl(),
  timeout: 10000,
});

apiClient.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔐 Token configurado en request:', token.substring(0, 20) + '...');
    } else {
      console.log('⚠️ No hay token disponible');
    }
    return config;
  },
  err => Promise.reject(err)
);

apiClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      console.log('🚫 Token expirado o inválido, limpiando storage');
      AsyncStorage.removeItem('userToken');
      AsyncStorage.removeItem('userData');
    }
    return Promise.reject(err);
  }
);

export { apiClient };
export default apiClient;
