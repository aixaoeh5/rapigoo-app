import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

const API_URL = 'http://192.168.100.192:5000/api/auth'; 

const ResetPasswordScreen = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigation = useNavigation();
  const route = useRoute();
  const { email } = route.params;

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('⚠️ Campos vacíos', 'Completa ambos campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('❌ Contraseñas no coinciden');
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/reset-password`, {
  email,
  newPassword: password, 
});

      Alert.alert('✅ Contraseña actualizada', 'Inicia sesión con tu nueva contraseña');
      navigation.navigate('Login');
    } catch (err) {
      console.error(err);
      Alert.alert(
        '❌ Error',
        err.response?.data?.message || 'No se pudo cambiar la contraseña'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <Text style={styles.title}>Nueva contraseña</Text>
      <Text style={styles.subtitle}>Ingresa y confirma tu nueva contraseña</Text>

      <TextInput
        style={styles.input}
        placeholder="Nueva contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirmar contraseña"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
        <Text style={styles.buttonText}>Guardar</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#fff',
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
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 15,
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
    fontWeight: 'bold',
  },
});

export default ResetPasswordScreen;
