import React, { useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import { auth } from '../../firebase';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

const SocialLogin = () => {
  const navigation = useNavigation();

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: 'TU_CLIENT_ID_EXPO',
    iosClientId: 'TU_CLIENT_ID_IOS',
    androidClientId: 'TU_CLIENT_ID_ANDROID',
    webClientId: 'TU_CLIENT_ID_WEB',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);

      signInWithCredential(auth, credential)
        .then(async (userCredential) => {
          const token = await userCredential.user.getIdToken();
          await AsyncStorage.setItem('token', token);
          navigation.navigate('Home');
        })
        .catch(err => Alert.alert('Error', err.message));
    }
  }, [response]);

  return (
    <TouchableOpacity style={styles.googleButton} onPress={() => promptAsync()}>
      <Icon name="google" size={20} color="#DB4437" style={styles.googleIcon} />
      <Text style={styles.googleText}>Continuar con Google</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
 googleButton: {
  width: 358, 
  alignSelf: 'center',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#fff',
  borderRadius: 10,
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderWidth: 1,
  borderColor: '#ccc',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
  gap: 10,
},

googleIcon: {
},

googleText: {
  fontSize: 14,
  color: '#000',
  fontWeight: '500',
},
});

export default SocialLogin;
