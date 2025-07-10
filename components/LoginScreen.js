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
import { loginUser } from '../api/auth';
import SocialLogin from './shared/SocialLogin';

const LoginScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const statusBarHeight = getStatusBarHeight();

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        console.log('🔓 Token ya existe, navegando a Home');
        navigation.navigate('Home');
      }
    };
    checkToken();
  }, []);

  const handleLogin = async () => {
    try {
      const user = await loginUser({ email, password });
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
    }
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <Text style={styles.title}>Bienvenido de nuevo</Text>

      <Text style={styles.label}>Ingresar Email</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Ingresar contraseña</Text>
      <View style={styles.passwordWrapper}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Contraseña"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.passwordIcon}
        >
          <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color="gray" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
      style={styles.forgotPasswordButton}
      onPress={() => navigation.navigate('ForgotPassword')}
      >
      <Text style={styles.forgotPasswordText}>¿Olvidaste la contraseña?</Text>
      </TouchableOpacity>


      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Iniciar Sesión</Text>
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
        <SocialLogin />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
  },

  backButton: {
    position: 'absolute',
    top: 70,
    left: 20,
    zIndex: 10,
    padding: 10,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    alignSelf: 'center',
  },
  label: {
    fontSize: 14,
    marginLeft: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 15,
  },
  passwordIcon: {
    padding: 10,
  },
  button: {
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  createAccountButton: {
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  forgotPasswordText: {
    color: 'gray',
  },
  grayText: {
    color: 'gray',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#ccc',
  },
  continueText: {
    marginHorizontal: 10,
    color: 'gray',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});

export default LoginScreen;
