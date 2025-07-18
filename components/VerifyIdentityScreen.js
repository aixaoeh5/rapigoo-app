import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VerifyIdentityScreen = ({ navigation, route }) => {
  const { newEmail, name, phone, avatar } = route.params || {};
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!newEmail || !name || typeof phone === 'undefined' || !avatar) {
    Alert.alert('Error', 'Faltan datos para continuar');
    navigation.goBack();
    return null;
  }

  const handleVerify = async () => {
    if (!password) {
      Alert.alert('Por favor, ingresa tu contraseña');
      return;
    }

    setLoading(true);

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch('http://10.0.2.2:5000/api/auth/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      const text = await response.text();

      try {
        const data = JSON.parse(text);

        if (response.ok) {
          navigation.navigate('VerifyEmailChange', {
            newEmail,
            name,
            phone,
            avatar,
          });
        } else {
          Alert.alert('Acceso denegado', data.message || 'Contraseña incorrecta');
        }
      } catch (parseError) {
        console.error('❌ Error al parsear JSON:', parseError);
        Alert.alert('Respuesta inesperada del servidor');
      }
    } catch (err) {
      console.error('❌ Error verificando contraseña:', err);
      Alert.alert('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <Text style={styles.title}>Verificar identidad</Text>
      <Text style={styles.subtitle}>
        Ingresa tu contraseña actual para continuar con el cambio de correo electrónico
      </Text>

      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder="Contraseña actual"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          style={styles.icon}
          onPress={() => setShowPassword((prev) => !prev)}
        >
          <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color="#888" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleVerify}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Verificando...' : 'Confirmar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 70,
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
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 30,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  inputWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    paddingRight: 40,
  },
  icon: {
    position: 'absolute',
    right: 10,
    top: 12,
  },
  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default VerifyIdentityScreen;
