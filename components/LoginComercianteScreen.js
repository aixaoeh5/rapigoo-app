import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginMerchant } from '../api/merchant';
import { useTheme } from './context/ThemeContext';
// import SocialLogin from './shared/SocialLogin';

const LoginComercianteScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const statusBarHeight = getStatusBarHeight();

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        console.log('🔓 Token ya existe, navegando a HomeComerciante');
        navigation.navigate('HomeComerciante'); 
      }
    };
    checkToken();
  }, []);

const handleLogin = async () => {
  try {
    const response = await loginMerchant({ email, password });

    await AsyncStorage.setItem('token', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));

    const { isVerified, merchantStatus } = response.user;

    if (!isVerified) {
      navigation.navigate('VerifyMerchantCodeScreen', { email });
    } else if (merchantStatus === 'pendiente') {
      navigation.navigate('MerchantPendingApproval');
    } else {
      navigation.navigate('HomeComerciante');
    }
  } catch (error) {
    console.error(
      '❌ Error al iniciar sesión:',
      error.response?.data?.message || error.message
    );
    Alert.alert(
      'Error',
      error.response?.data?.message || 'Error al iniciar sesión'
    );
  }
};

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
    },
    backButton: {
      position: 'absolute',
      top: statusBarHeight + 10,
      left: 10,
      zIndex: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 30,
      textAlign: 'center',
      color: theme.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 15,
      fontSize: 16,
      backgroundColor: theme.colors.surface,
      color: theme.colors.text,
      marginBottom: 15,
    },
    forgotPasswordButton: {
      alignItems: 'center',
      marginTop: 20,
    },
    forgotPasswordText: {
      color: theme.colors.primary,
      fontSize: 16,
    },
    button: {
      backgroundColor: theme.colors.primary,
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    buttonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    forgotPassword: {
      textAlign: 'center',
      marginTop: 20,
      color: theme.colors.primary,
      fontSize: 16,
    },
    registerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
    registerText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    registerLink: {
      fontSize: 16,
      color: theme.colors.primary,
      fontWeight: 'bold',
    },
    socialButtonsContainer: {
      marginTop: 30,
      alignItems: 'center',
    },
  });

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color={theme.colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>Bienvenido de nuevo</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor={theme.colors.textTertiary}
      />

      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry={true}
        value={password}
        onChangeText={setPassword}
        placeholderTextColor={theme.colors.textTertiary}
      />

      <TouchableOpacity
        style={styles.forgotPasswordButton}
        onPress={() => navigation.navigate('ForgotPassword')} 
      >
        <Text style={styles.forgotPasswordText}>¿Olvidaste la contraseña?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Iniciar Sesión</Text>
      </TouchableOpacity>

      <View style={styles.registerContainer}>
        <Text style={styles.registerText}>¿No tienes una cuenta? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('RegisterMerchant')}>
          <Text style={styles.registerLink}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>

      {/* <View style={styles.dividerContainer}>
        <View style={styles.line} />
        <Text style={styles.continueText}>Continuar con</Text>
        <View style={styles.line} />
      </View>

      <View style={styles.socialButtonsContainer}>
        <SocialLogin />
      </View> */}
    </View>
  );
};

export default LoginComercianteScreen;

