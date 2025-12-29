import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser } from '../api/auth';
import { useTheme } from './context/ThemeContext';
import LoadingState from './shared/LoadingState';
import ValidatedInput from './shared/ValidatedInput';
import useFormValidation from '../hooks/useFormValidation';
// import SocialLogin from './shared/SocialLogin';

const LoginScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const statusBarHeight = getStatusBarHeight();

  // Form validation setup
  const {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    validateAll,
  } = useFormValidation(
    {
      email: '',
      password: '',
    },
    {
      email: ['required', 'email'],
      password: ['required', { type: 'minLength', params: 6 }],
    }
  );

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          console.log('🔓 Token ya existe, navegando a Home');
          navigation.replace('Home');
        }
      } catch (error) {
        console.error('Error checking token:', error);
      } finally {
        setInitialLoading(false);
      }
    };
    checkToken();
  }, []); // Remove navigation from dependencies to prevent re-renders

  const handleLogin = async () => {
    if (!validateAll()) {
      Alert.alert('Error', 'Por favor, corrige los errores en el formulario');
      return;
    }

    try {
      setLoading(true);
      const user = await loginUser({ 
        email: values.email, 
        password: values.password 
      });
      console.log('🪪 Usuario logueado:', user);
      navigation.navigate('Home');
    } catch (error) {
      console.error(
        '❌ Error al iniciar sesión:',
        error.response?.data?.message || error.message
      );
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Error al iniciar sesión'
      );
    } finally {
      setLoading(false);
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
    buttonDisabled: {
      backgroundColor: '#ccc',
      opacity: 0.6,
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

  if (initialLoading) {
    return (
      <LoadingState 
        message="Verificando sesión..." 
        color={theme.colors.primary}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.navigate('UserType')}
        disabled={loading}
      >
        <Icon name="chevron-back" size={26} color={theme.colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>Bienvenido de nuevo</Text>

      <ValidatedInput
        label="Email"
        placeholder="Ingresa tu email"
        keyboardType="email-address"
        value={values.email}
        onChangeText={(value) => handleChange('email', value)}
        onBlur={() => handleBlur('email')}
        error={errors.email}
        touched={touched.email}
        autoCapitalize="none"
        leftIcon={<Icon name="mail-outline" size={20} color={theme.colors.textSecondary} />}
        required
      />

      <ValidatedInput
        label="Contraseña"
        placeholder="Ingresa tu contraseña"
        secureTextEntry={true}
        value={values.password}
        onChangeText={(value) => handleChange('password', value)}
        onBlur={() => handleBlur('password')}
        error={errors.password}
        touched={touched.password}
        showPasswordToggle={true}
        leftIcon={<Icon name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />}
        required
      />

      <TouchableOpacity
        style={styles.forgotPasswordButton}
        onPress={() => navigation.navigate('ForgotPassword')}
      >
        <Text style={styles.forgotPasswordText}>¿Olvidaste la contraseña?</Text>
      </TouchableOpacity>


      <TouchableOpacity 
        style={[
          styles.button, 
          (loading || !isValid) && styles.buttonDisabled
        ]} 
        onPress={handleLogin}
        disabled={loading || !isValid}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Iniciar Sesión</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.grayText}>¿No tienes una cuenta?</Text>

      <TouchableOpacity
        style={styles.createAccountButton}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.buttonText}>Crear cuenta</Text>
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.line} />
        <Text style={styles.continueText}>Continuar con</Text>
        <View style={styles.line} />
      </View>

      <View style={styles.socialButtonsContainer}>
        {/* <SocialLogin /> */}
      </View>
    </View>
  );
};

export default LoginScreen;

