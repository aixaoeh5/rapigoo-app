import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { registerMerchant } from '../api/merchant';
import SocialLogin from './shared/SocialLogin';

const RegisterMerchantScreen = () => {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const statusBarHeight = getStatusBarHeight();

  const handleRegister = async () => {
    try {
      const data = await registerMerchant({ name, email, password });
      Alert.alert('📩 Código enviado', 'Revisa tu correo para verificar tu cuenta');
      navigation.navigate('VerifyMerchantCode', { email });
    } catch (error) {
      console.error('❌ Error al registrar comerciante:', error.response?.data?.message || error.message);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo registrar');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <Text style={styles.title}>Crea tu cuenta de negocio</Text>

      <Text style={styles.label}>Nombre del dueño</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Correo electrónico</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Contraseña</Text>
      <View style={styles.passwordWrapper}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Contraseña"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.passwordIcon}>
          <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color="gray" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.termsContainer}
        onPress={() => setIsAccepted(!isAccepted)}
      >
        <View style={[styles.checkbox, isAccepted && styles.checked]} />
        <Text style={styles.termsText}>
          He leído y acepto los{' '}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL('https://rapigoo/terminos')}
          >
            Términos de uso
          </Text>{' '}
          y la{' '}
          <Text
            style={styles.link}
            onPress={() => Linking.openURL('https://rapigoo/privacidad')}
          >
            Política de privacidad
          </Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, !isAccepted && { opacity: 0.5 }]}
        onPress={handleRegister}
        disabled={!isAccepted}
      >
        <Text style={styles.buttonText}>Registrarse</Text>
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.line} />
        <Text style={styles.continueText}>Registrarse con</Text>
        <View style={styles.line} />
      </View>

      <SocialLogin />
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
    bottom: 15,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#aaa',
    marginRight: 10,
    marginTop: 3,
  },
  checked: {
    backgroundColor: '#333',
  },
  termsText: {
    flex: 1,
    color: '#333',
    fontSize: 13,
  },
  link: {
    color: '#007BFF',
    textDecorationLine: 'underline',
  },
  button: {
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
});

export default RegisterMerchantScreen;
