import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../api/apiClient';

const StartupScreen = () => {
const navigation = useNavigation();

useEffect(() => {
    const checkLoginAndNavigate = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        console.log('🔍 Token leído desde AsyncStorage:', token);

        if (token) {
          console.log('✅ Token encontrado, verificando rol del usuario...');
          
          // Verificar rol del usuario
          const response = await apiClient.get('/auth/user');
          const userData = response.data;
          
          console.log('👤 Datos del usuario:', userData);
          console.log('🔍 Rol detectado:', userData.role);
          
          // Navegar según el rol
          if (userData.role === 'comerciante' || userData.role === 'merchant') {
            console.log('🏪 Usuario es comerciante, navegando a HomeComerciante');
            console.log('🔄 Ejecutando navigation.reset a HomeComerciante...');
            navigation.reset({
              index: 0,
              routes: [{ name: 'HomeComerciante' }],
            });
            console.log('✅ Navigation.reset completado');
          } else if (userData.role === 'delivery') {
            console.log('🚚 Usuario es delivery, navegando a DeliveryMap');
            navigation.reset({
              index: 0,
              routes: [{ name: 'DeliveryMap' }],
            });
          } else {
            console.log('👤 Usuario es cliente, navegando a Home');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        } else {
          console.log('❌ No hay token, navegando a Welcome');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          });
        }
      } catch (error) {
        console.error('❌ Error verificando usuario:', error);
        // Si hay error, eliminar token y ir a Welcome
        await AsyncStorage.removeItem('token');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Welcome' }],
        });
      }
    };

    checkLoginAndNavigate();
}, []);

return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#000" />
    </View>
);
};

export default StartupScreen;
