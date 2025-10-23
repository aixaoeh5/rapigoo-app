import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyEmailCode } from '../api/auth';

const API_URL = 'http://192.168.100.192:5000/api/auth';

export default function VerifyRegisterCodeScreen({ route }) {
  const navigation = useNavigation();
  const { email } = route?.params || {};

  const [otp, setOtp] = useState(['', '', '', '']);
  const inputRefs = useRef([]);

  const handleChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const code = otp.join('');

    try {
      const { token, user } = await verifyEmailCode({
        email,
        code,
        context: 'register',
      });

      if (token && user) {
        await AsyncStorage.setItem('userData', JSON.stringify(user));
        await AsyncStorage.setItem('token', token);
        
        // Redirigir a configuración de ubicación para clientes
        if (user.role === 'client') {
          navigation.navigate('ClientLocationSetup');
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        }
      } else {
        Alert.alert('⚠️ Código incorrecto');
      }
    } catch (err) {
      console.error('❌ Error al verificar:', err);
      Alert.alert('❌ Error', err.response?.data?.message || 'No se pudo verificar');
    }
  };

  const handleResend = async () => {
    try {
      await fetch(`${API_URL}/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, context: 'register' }),
      });

      Alert.alert('📩 Código reenviado', `Revisa tu correo: ${email}`);
    } catch (err) {
      console.error('❌ Error al reenviar código:', err);
      Alert.alert('❌ Error', err.response?.data?.message || 'Ocurrió un error');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="#000" />
      </TouchableOpacity>

      <Text style={styles.title}>Verificación</Text>

      <Image
        source={require('../assets/illustration-OTP.png')}
        style={styles.image}
        resizeMode="contain"
      />

      <View style={styles.formGroup}>
        <Text style={styles.subtitle}>
          Por favor, ingresa el código de 4 dígitos que te enviamos
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              style={styles.otpInput}
              keyboardType="numeric"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              ref={(ref) => (inputRefs.current[index] = ref)}
            />
          ))}
        </View>

        <TouchableOpacity onPress={handleResend}>
          <Text style={styles.resendText}>Reenviar código</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  backButton: {
    position: 'absolute',
    top: 58,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 45,
    marginBottom: 90,
  },
  image: {
    width: 240,
    height: 180,
    alignSelf: 'center',
    marginBottom: 10,
  },
  formGroup: {
    alignItems: 'center',
    marginTop: 50,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    width: 60,
    height: 60,
    textAlign: 'center',
  },
  resendText: {
    color: '#000',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    marginBottom: 20,
  },
  button: {
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
