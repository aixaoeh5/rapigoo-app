import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiClient = axios.create({
  baseURL: 'http://192.168.100.192:5000/api',
  timeout: 5000,
});

apiClient.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  err => Promise.reject(err)
);

apiClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      AsyncStorage.removeItem('token');

    }
    return Promise.reject(err);
  }
);

export default apiClient;
