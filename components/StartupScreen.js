import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const StartupScreen = () => {
const navigation = useNavigation();

useEffect(() => {
    const checkLogin = async () => {
    const token = await AsyncStorage.getItem('token');
      console.log('🔍 Token leído desde AsyncStorage:', token); // LOG 1

    if (token) {
        console.log('✅ Token encontrado, navegando a Home'); // LOG 2
        navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
        });
    } else {
        console.log('❌ No hay token, navegando a Welcome'); // LOG 3
        navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
        });
    }
    };

    checkLogin();
}, []);

return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#000" />
    </View>
);
};

export default StartupScreen;
