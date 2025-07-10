import React, { useRef, useState, useEffect } from 'react';
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
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.100.192:5000/api/auth';

export default function VerifyCodeScreen({ route }) {
  const navigation = useNavigation();
  const {
    email,
    type,
    newEmail,
    name,
    phone,
    avatar,
  } = route?.params || {};

  const [otp, setOtp] = useState(['', '', '', '']);
  const inputRefs = useRef([]);

  useEffect(() => {
    const sendCodeToNewEmail = async () => {
      try {
        const resendTo = type === 'email' ? newEmail : email;
        const token = await AsyncStorage.getItem('token');

        const headers = type === 'email'
          ? { Authorization: `Bearer ${token}` }
          : {};

        await axios.post(`${API_URL}/resend-code`, {
          email: resendTo,
          context:
            type === 'email'
              ? 'update-email'
              : type === 'reset'
              ? 'reset-password'
              : 'register',
        }, { headers });

        console.log('📩 Código enviado a:', resendTo);
        Alert.alert('Código enviado', `Revisa tu correo: ${resendTo}`);
      } catch (err) {
        console.error('❌ Error al enviar código:', err);
        Alert.alert('Error', 'No se pudo enviar el código de verificación');
      }
    };

    sendCodeToNewEmail();
  }, []);

  const handleChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 3) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleSubmit = async () => {
    const code = otp.join('');
    const token = await AsyncStorage.getItem('token');

    try {
      if (type === 'reset') {
        const res = await axios.post(`${API_URL}/verify-reset-code`, {
          email,
          code,
        });

        if (res.data.success) {
          navigation.navigate('ResetPassword', { email }); 
        } else {
          Alert.alert('⚠️ Código incorrecto');
        }
        return;
      }
      if (type === 'email') {
        await axios.post(
          `${API_URL}/verify-email`,
          {
            email: newEmail,
            code,
            context: 'update-email',
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        await axios.put(
          `${API_URL}/update-profile`,
          {
            name,
            email: newEmail,
            phone,
            avatar,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        Alert.alert('✅ Correo actualizado con éxito');
        navigation.reset({ index: 0, routes: [{ name: 'Profile' }] });
        return;
      }

      const res = await axios.post(`${API_URL}/verify-email`, {
        email,
        code,
      });

      if (res.data.token) {
        const { token, user } = res.data;
        await AsyncStorage.setItem('token', token);
        await AsyncStorage.setItem('user', JSON.stringify(user));

        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        Alert.alert('⚠️ Código incorrecto');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('❌ Error', err.response?.data?.message || 'No se pudo verificar');
    }
  };

  const handleResend = async () => {
    try {
      const resendTo = type === 'email' ? newEmail : email;
      const token = await AsyncStorage.getItem('token');

      const headers = type === 'email'
        ? { Authorization: `Bearer ${token}` }
        : {};

      await axios.post(`${API_URL}/resend-code`, {
        email: resendTo,
        context:
          type === 'email'
            ? 'update-email'
            : type === 'reset'
            ? 'reset-password'
            : 'register',
      }, { headers });

      Alert.alert('📩 Código reenviado', `Revisa tu correo: ${resendTo}`);
    } catch (err) {
      console.error(err);
      Alert.alert('❌ Error al reenviar', err.response?.data?.message || 'Ocurrió un error');
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
        <Text style={styles.subtitle}>Por favor, ingresa el código de 4 dígitos</Text>

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
