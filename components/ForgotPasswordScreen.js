import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import axios from 'axios';

const API_URL = 'http://192.168.100.192:5000/api/auth';

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const navigation = useNavigation();
  const statusBarHeight = getStatusBarHeight();

  const handleSendCode = async () => {
    if (!email) {
      Alert.alert('⚠️ Campo vacío', 'Por favor ingresa tu correo');
      return;
    }

    try {
      await axios.post(`${API_URL}/forgot-password`, { email });
      Alert.alert('📩 Código enviado', 'Revisa tu correo para continuar');
      navigation.navigate('VerifyCode', { email, from: 'forgotPassword' });
    } catch (err) {
      console.error(err);
      Alert.alert(
        '❌ Error',
        err.response?.data?.message || 'No se pudo enviar el código de recuperación'
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <Image
        source={require('../assets/illustration-forgot.png')}
        style={styles.image}
        resizeMode="contain"
      />

      <Text style={styles.title}>¿Olvidaste la contraseña?</Text>

      <Text style={styles.subtitle}>
        Por favor, ingrese su correo asociado a su cuenta.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Inserte su correo"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.button} onPress={handleSendCode}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  backButton: {
    position: 'absolute',
    top: 70,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  image: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginTop: 10,
  },
  button: {
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default ForgotPasswordScreen;
