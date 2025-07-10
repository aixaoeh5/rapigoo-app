import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import auth from '@react-native-firebase/auth';

const VerifyPhoneScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [code, setCode] = useState('');

  const handleSendCode = async () => {
    if (!phoneNumber.startsWith('+')) {
      Alert.alert('Agregá el código de país, por ejemplo +54');
      return;
    }

    try {
      const confirmationResult = await auth().signInWithPhoneNumber(phoneNumber);
      await setConfirmation(confirmationResult); 
      Alert.alert('Código enviado por SMS 📩');
    } catch (error) {
      console.error('❌ Error enviando código:', error);
      Alert.alert('Error', 'No se pudo enviar el código');
    }
  };

  const handleVerifyCode = async () => {
    if (!confirmation) {
      Alert.alert('Error', 'Primero debes solicitar el código');
      return;
    }

    try {
      const userCredential = await confirmation.confirm(code);
      const firebaseUser = userCredential.user;
      const idToken = await firebaseUser.getIdToken();

      const response = await fetch('http://10.0.2.2:5000/api/auth/update-phone', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          phone: firebaseUser.phoneNumber,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(' Número verificado y guardado');
        navigation.goBack();
      } else {
        Alert.alert('Error', data.message || 'No se pudo guardar el número');
      }
    } catch (error) {
      console.error('❌ Error en verificación:', error);
      Alert.alert('Código incorrecto o expirado');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verificar número de teléfono</Text>

      {!confirmation ? (
        <>
          <Text style={styles.label}>Número de teléfono (+1...)</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            placeholder="+1 123 4567890"
          />

          <TouchableOpacity style={styles.button} onPress={handleSendCode}>
            <Text style={styles.buttonText}>Enviar código</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>Código recibido por SMS</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="123456"
          />

          <TouchableOpacity style={styles.button} onPress={handleVerifyCode}>
            <Text style={styles.buttonText}>Verificar</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default VerifyPhoneScreen;
