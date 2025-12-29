import AsyncStorage from '@react-native-async-storage/async-storage';
// PRODUCTION MODE: Using production client
import apiClient from './apiClient';

// REGISTRO
export const registerUser = async ({ name, email, password }) => {
  const response = await apiClient.post('/auth/register', {
    name,
    email,
    password,
  });
  return response.data;
};

// LOGIN
export const loginUser = async ({ email, password }) => {
  console.log('🔄 Intentando login con:', email);
  
  try {
    console.log('📡 Enviando request de login...');
    const response = await apiClient.post('/auth/login', {
      email,
      password,
    });

    console.log('✅ Login exitoso, guardando token');
    await AsyncStorage.setItem('token', response.data.token);
    return response.data.user;
  } catch (error) {
    console.error('❌ Error detallado en loginUser:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      responseStatus: error.response?.status,
      config: {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: error.config?.method,
      }
    });
    
    // Re-throw con información adicional
    if (error.code === 'ERR_NETWORK') {
      throw new Error(`Network Error: Unable to connect to server. Please check if the server is running and accessible.`);
    }
    throw error;
  }
};

// LOGOUT
export const logoutUser = async () => {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('userData');
  await AsyncStorage.removeItem('user');
};

// OBTENER PERFIL
export const getUserProfile = async () => {
  const response = await apiClient.get('/auth/user');
  return response.data;
};

// ACTUALIZAR PERFIL
export const updateUserProfile = async (data) => {
  const response = await apiClient.put('/auth/update-profile', data);
  return response.data;
};

// VERIFICAR CONTRASEÑA ACTUAL
export const verifyPassword = async (password) => {
  const response = await apiClient.post('/auth/verify-password', { password });
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
    body = { newEmail: email, code };
  } else if (context === 'reset-password') {
    endpoint = 'verify-reset-code';
    body = { email, code };
  } else {
    throw new Error('Contexto inválido');
  }

  const response = await apiClient.post(`/auth/${endpoint}`, body, { headers });

  if (context === 'register') {
    const { token, user } = response.data;
    return { token, user };
  }
  return { success: true };
};

// REENVIAR CÓDIGO
export const resendVerificationCode = async ({ email, context }) => {
  const headers = {};
  
  if (context === 'update-email') {
    const token = await AsyncStorage.getItem('token');
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await apiClient.post('/auth/resend-code', 
    { email, context }, 
    { headers }
  );
  return response.data;
};

// ENVIAR CÓDIGO PARA RECUPERAR CONTRASEÑA
export const forgotPassword = async (email) => {
  const response = await apiClient.post('/auth/forgot-password', { email });
  return response.data;
};

// CAMBIAR CONTRASEÑA DESPUÉS DEL OTP
export const resetPassword = async ({ email, newPassword }) => {
  const response = await apiClient.post('/auth/reset-password', {
    email,
    newPassword,
  });
  return response.data;
};

// SOCIAL LOGIN (comentado porque no se usa)
// export const socialLogin = async ({ token, provider }) => {
//   const response = await apiClient.post('/auth/social-login', {
//     token,
//     provider,
//   });
//   await AsyncStorage.setItem('token', response.data.token);
//   return response.data.user;
// };