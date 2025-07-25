import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.100.192:5000/api/merchant';

// REGISTRO DE COMERCIANTE
export const registerMerchant = async ({ name, email, password }) => {
  const response = await axios.post(`${API_URL}/register`, {
    name,
    email,
    password,
  });

  return response.data;
};

// VERIFICACIÓN DE CÓDIGO
export const verifyMerchantCode = async ({ email, code }) => {
  const response = await axios.post(`${API_URL}/verify-email-register`, {
    email,
    code,
  });

  const { token, user } = response.data;

  await AsyncStorage.setItem('token', token);
  await AsyncStorage.setItem('user', JSON.stringify(user));

  return { token, user };
};

// LOGIN DE COMERCIANTE
export const loginMerchant = async ({ email, password }) => {
  const response = await axios.post(`${API_URL}/login`, {
    email,
    password,
  });

  await AsyncStorage.setItem('token', response.data.token);
  await AsyncStorage.setItem('user', JSON.stringify(response.data.user));

  return response.data.user;
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
  const token = await AsyncStorage.getItem('token');

  const response = await axios.post(
    `${API_URL}/profile`,
    {
      businessName,
      rnc,
      category,
      address,
      openHour,
      closeHour,
      description,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};
