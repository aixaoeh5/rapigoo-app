import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.100.192:5000/api/auth';

// REGISTRO
export const registerUser = async ({ name, email, password }) => {
  const response = await axios.post(`${API_URL}/register`, {
    name,
    email,
    password,
  });

  return response.data;
};

// VERIFICACIÓN DE CÓDIGO SEGÚN CONTEXTO
export const verifyEmailCode = async ({ email, code, context = 'register' }) => {
  let endpoint = '';
  const headers = {};
  let body = {};

  if (context === 'register') {
    endpoint = 'verify-email-register';
    body = { email, code };
} else if (context === 'update-email') {
  endpoint = 'verify-email-change';
  const token = await AsyncStorage.getItem('token');
  headers.Authorization = `Bearer ${token}`;
  body = { newEmail: email, code }; // ✅ corregido
} else if (context === 'reset-password') {
    endpoint = 'verify-reset-code';
    body = { email, code };
  } else {
    throw new Error('Contexto inválido');
  }

  const response = await axios.post(
    `${API_URL}/${endpoint}`,
    body,
    { headers }
  );

if (context === 'register') {
  const { token, user } = response.data;
  return { token, user };
}
  return { success: true };
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

// OBTENER PERFIL
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

// VERIFICAR CONTRASEÑA ACTUAL
export const verifyPassword = async (password) => {
  const token = await AsyncStorage.getItem('token');

  const response = await axios.post(
    `${API_URL}/verify-password`,
    { password },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};

// REENVIAR CÓDIGO
export const resendVerificationCode = async ({ email, context }) => {
  const token = await AsyncStorage.getItem('token');
  const headers = {};

  if (context === 'update-email') {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await axios.post(
    `${API_URL}/resend-code`,
    { email, context },
    { headers }
  );

  return response.data;
};

// ENVIAR CÓDIGO PARA RECUPERAR CONTRASEÑA
export const forgotPassword = async (email) => {
  const response = await axios.post(`${API_URL}/forgot-password`, { email });
  return response.data;
};

// CAMBIAR CONTRASEÑA DESPUÉS DEL OTP
export const resetPassword = async ({ email, newPassword }) => {
  const response = await axios.post(`${API_URL}/reset-password`, {
    email,
    newPassword,
  });

  return response.data;
};

// SOCIAL LOGIN 
export const socialLogin = async (firebaseToken) => {
  const response = await axios.post(`${API_URL}/social-login`, {
    firebaseToken,
  });

  await AsyncStorage.setItem('token', response.data.token);
  return response.data.user;
};
