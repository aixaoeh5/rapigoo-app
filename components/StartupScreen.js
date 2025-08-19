import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../api/apiClient';
import ActiveDeliveryManager from '../utils/activeDeliveryManager';

const StartupScreen = () => {
const navigation = useNavigation();

useEffect(() => {
    let isCancelled = false; // Prevent state updates if component unmounts
    
    const checkLoginAndNavigate = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        console.log('🔍 Token leído desde AsyncStorage:', token);

        if (token && !isCancelled) {
          console.log('✅ Token encontrado, verificando rol del usuario...');
          
          // Verificar rol del usuario
          const response = await apiClient.get('/auth/user');
          const userData = response.data;
          
          console.log('👤 Datos del usuario:', userData);
          console.log('🔍 Rol detectado:', userData.role);
          
          // Navegar según el rol
          if (userData.role === 'comerciante' || userData.role === 'merchant') {
            console.log('🏪 Usuario es comerciante, navegando a HomeComerciante');
            console.log('🔄 Ejecutando navigation.replace a HomeComerciante...');
            navigation.replace('HomeComerciante');
            console.log('✅ Navigation.replace completado');
          } else if (userData.role === 'delivery') {
            console.log('🚚 Usuario es delivery, verificando entrega activa...');
            
            // Verificar si hay un delivery activo guardado localmente
            const activeDelivery = await ActiveDeliveryManager.getActiveDelivery();
            
            if (activeDelivery) {
              console.log('📱 Entrega activa encontrada en storage local:', activeDelivery);
              
              // Verificar con el servidor si aún está activa
              try {
                const response = await apiClient.get('/delivery/active');
                if (response.data.success && response.data.deliveries?.length > 0) {
                  const serverDelivery = response.data.deliveries.find(d => d._id === activeDelivery.trackingId);
                  
                  if (serverDelivery && !['delivered', 'cancelled'].includes(serverDelivery.status)) {
                    console.log('✅ Entrega confirmada en servidor, navegando a DeliveryNavigation');
                    navigation.replace('DeliveryNavigation', {
                      trackingId: activeDelivery.trackingId,
                      orderId: activeDelivery.orderId
                    });
                    return;
                  } else {
                    console.log('⚠️ Entrega local no coincide o ya está completada, limpiando storage');
                    await ActiveDeliveryManager.clearActiveDelivery();
                  }
                } else {
                  console.log('⚠️ No hay entregas activas en servidor, limpiando storage local');
                  await ActiveDeliveryManager.clearActiveDelivery();
                }
              } catch (error) {
                console.error('❌ Error verificando entrega activa con servidor:', error);
                // En caso de error de red, usar el dato local
                console.log('📱 Error de red, usando datos locales para continuar');
                navigation.replace('DeliveryNavigation', {
                  trackingId: activeDelivery.trackingId,
                  orderId: activeDelivery.orderId
                });
                return;
              }
            }
            
            // Si no hay entrega activa, ir al dashboard normal
            console.log('🏠 No hay entrega activa, navegando a HomeDelivery');
            navigation.replace('HomeDelivery');
          } else {
            console.log('👤 Usuario es cliente, navegando a Home');
            navigation.replace('Home');
          }
        } else {
          console.log('❌ No hay token, navegando a Welcome');
          navigation.replace('Welcome');
        }
      } catch (error) {
        console.error('❌ Error verificando usuario:', error);
        // Si hay error, eliminar token y ir a Welcome
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('userData');
        await AsyncStorage.removeItem('user');
        navigation.replace('Welcome');
      }
    };

    checkLoginAndNavigate();
    
    // Cleanup function to prevent memory leaks
    return () => {
      isCancelled = true;
    };
  }, []); // Remove navigation from dependencies as it causes re-renders

return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#000" />
    </View>
);
};

export default StartupScreen;
