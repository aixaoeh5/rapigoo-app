import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.100.192:5000/api/auth'; 

export const registerUser = async ({ name, email, password }) => {
  const response = await axios.post(`${API_URL}/register`, {
    name,
    email,
    password,
  });


  return response.data; 
};

export const verifyEmailCode = async ({ email, code }) => {
  const response = await axios.post(`${API_URL}/verify-email`, {
    email,
    code,
  });

  await AsyncStorage.setItem('token', response.data.token);
  return response.data.user;
};

// LOGIN
export const loginUser = async ({ email, password }) => {
  const response = await axios.post(`${API_URL}/login`, {
    email,
    password,
  });

  await AsyncStorage.setItem('token', response.data.token);
  return response.data.user;
};

// GET PERFIL
export const getUserProfile = async () => {
  const token = await AsyncStorage.getItem('token');

  const response = await axios.get(`${API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};

// ACTUALIZAR PERFIL
export const updateUserProfile = async (data) => {
  const token = await AsyncStorage.getItem('token');

  const response = await axios.put(`${API_URL}/update-profile`, data, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};

// LOGOUT
export const logoutUser = async () => {
  await AsyncStorage.removeItem('token');
};
