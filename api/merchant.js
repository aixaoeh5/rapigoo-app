import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// REGISTRO DE COMERCIANTE
export const registerMerchant = async ({ name, email, password }) => {
  const { data } = await apiClient.post('/merchant/register', { name, email, password });
  if (!data.success) throw new Error(data.message);
  return data;
};

// VERIFICACIÓN DE CÓDIGO
export const verifyMerchantCode = async ({ email, code }) => {
  const { data } = await apiClient.post('/merchant/verify-email-register', { email, code });

  if (!data.token || !data.user) throw new Error('Verificación fallida');

  await AsyncStorage.setItem('token', data.token);
  await AsyncStorage.setItem('user', JSON.stringify(data.user));

  return { token: data.token, user: data.user };
};

// LOGIN DE COMERCIANTE
export const loginMerchant = async ({ email, password }) => {
  const { data } = await apiClient.post('/merchant/login', { email, password });

  if (!data.token || !data.user) throw new Error('Login fallido');

  await AsyncStorage.setItem('token', data.token);
  await AsyncStorage.setItem('user', JSON.stringify(data.user));

  return { token: data.token, user: data.user };
};

// GUARDAR PERFIL DE NEGOCIO
export const saveMerchantProfile = async ({
  businessName,
  rnc,
  category,
  address,
  openHour,
  closeHour,
  description,
}) => {
  const { data } = await apiClient.post('/merchant/profile', {
    businessName,
    rnc,
    category,
    address,
    openHour,
    closeHour,
    description,
  });

  if (!data.success) throw new Error(data.message);
  return data;
};

// OBTENER COMERCIANTES POR CATEGORÍA
export const getMerchantsByCategory = async (category) => {
  const { data } = await apiClient.get(`/merchant/category?category=${category}`);
  if (!data.success) throw new Error(data.message);
  return data.data;
};

// OBTENER PERFIL PÚBLICO
export const getMerchantPublicProfile = async (merchantId) => {
  const { data } = await apiClient.get(`/merchant/public/${merchantId}`);
  if (!data.success) throw new Error(data.message);
  return data.data;
};

