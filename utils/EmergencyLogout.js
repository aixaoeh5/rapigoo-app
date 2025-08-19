/**
 * EmergencyLogout - Permite cerrar sesión aunque esté en mitad de un delivery
 * Útil para situaciones donde el estado quedó inconsistente
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

class EmergencyLogout {
  constructor() {
    this.isEmergencyLogout = false;
  }

  /**
   * Forzar logout limpiando todo el estado local
   */
  async forceLogout(navigation, showConfirmation = true) {
    try {
      if (showConfirmation) {
        return new Promise((resolve) => {
          Alert.alert(
            '⚠️ Cerrar Sesión de Emergencia',
            'Esto cerrará tu sesión y limpiará todos los datos locales, incluyendo deliveries activos.\n\n¿Estás seguro?',
            [
              {
                text: 'Cancelar',
                style: 'cancel',
                onPress: () => resolve(false)
              },
              {
                text: 'Sí, Cerrar Sesión',
                style: 'destructive',
                onPress: () => {
                  this.executeForceLogout(navigation);
                  resolve(true);
                }
              }
            ]
          );
        });
      } else {
        await this.executeForceLogout(navigation);
        return true;
      }
    } catch (error) {
      console.error('❌ Error en logout de emergencia:', error);
      throw error;
    }
  }

  /**
   * Ejecutar el logout forzado
   */
  async executeForceLogout(navigation) {
    try {
      console.log('🚨 Ejecutando logout de emergencia...');
      this.isEmergencyLogout = true;

      // 1. Limpiar todo el AsyncStorage relacionado con delivery
      await this.clearDeliveryState();

      // 2. Limpiar autenticación
      await this.clearAuthState();

      // 3. Limpiar estado de la aplicación
      await this.clearAppState();

      // 4. Notificar al backend (opcional)
      await this.notifyBackendLogout();

      // 5. Resetear navegación
      this.resetNavigation(navigation);

      console.log('✅ Logout de emergencia completado');

    } catch (error) {
      console.error('❌ Error ejecutando logout de emergencia:', error);
      // Aún así intentamos navegar al login
      this.resetNavigation(navigation);
    } finally {
      this.isEmergencyLogout = false;
    }
  }

  /**
   * Limpiar estado de delivery
   */
  async clearDeliveryState() {
    console.log('🧹 Limpiando estado de delivery...');
    
    const deliveryKeys = [
      // DeliveryStateManager
      'currentDelivery',
      'pendingDeliveryOps',
      
      // LocationSyncService
      'pendingLocationOps',
      
      // DeliveryErrorRecovery
      'deliveryErrorQueue',
      
      // Otros estados de delivery
      'activeDeliveryId',
      'deliveryStatus',
      'lastDeliveryUpdate',
      'deliveryRoute',
      'deliveryLocation',
      'pickupLocation',
      'deliveryTracking',
      
      // Estados de navegación
      'navigationState',
      'mapState',
      'currentRoute',
      
      // Cache temporal
      'tempDeliveryData',
      'lastLocationData',
      'deliveryCache'
    ];

    try {
      await AsyncStorage.multiRemove(deliveryKeys);
      console.log('✅ Estado de delivery limpiado');
    } catch (error) {
      console.error('❌ Error limpiando estado de delivery:', error);
      // Intentar limpiar uno por uno
      for (const key of deliveryKeys) {
        try {
          await AsyncStorage.removeItem(key);
        } catch (keyError) {
          console.warn(`⚠️ No se pudo limpiar ${key}:`, keyError.message);
        }
      }
    }
  }

  /**
   * Limpiar estado de autenticación
   */
  async clearAuthState() {
    console.log('🔐 Limpiando estado de autenticación...');
    
    const authKeys = [
      'token',
      'userToken',
      'authToken',
      'refreshToken',
      'user',
      'userData',
      'userInfo',
      'isLoggedIn',
      'userRole',
      'userId'
    ];

    try {
      await AsyncStorage.multiRemove(authKeys);
      console.log('✅ Estado de autenticación limpiado');
    } catch (error) {
      console.error('❌ Error limpiando autenticación:', error);
    }
  }

  /**
   * Limpiar estado general de la aplicación
   */
  async clearAppState() {
    console.log('📱 Limpiando estado de la aplicación...');
    
    const appKeys = [
      // Estados generales
      'appState',
      'settings',
      'preferences',
      
      // Cache
      'imageCache',
      'apiCache',
      
      // Notificaciones
      'pushToken',
      'notificationPermissions',
      
      // Favoritos y carrito
      'favorites',
      'cart',
      'cartItems',
      
      // Históricos temporales
      'recentSearches',
      'recentLocations'
    ];

    try {
      await AsyncStorage.multiRemove(appKeys);
      console.log('✅ Estado de aplicación limpiado');
    } catch (error) {
      console.error('❌ Error limpiando estado de aplicación:', error);
    }
  }

  /**
   * Notificar al backend sobre el logout (opcional)
   */
  async notifyBackendLogout() {
    try {
      // Si tienes un endpoint de logout, llamarlo aquí
      // Esto es opcional y no debe bloquear el logout si falla
      
      const token = await AsyncStorage.getItem('token');
      if (token) {
        // Ejemplo de llamada al backend
        /*
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            emergencyLogout: true,
            reason: 'Inconsistent delivery state'
          })
        });
        */
      }
      
      console.log('📡 Backend notificado del logout');
    } catch (error) {
      console.warn('⚠️ No se pudo notificar al backend:', error.message);
      // No lanzamos error porque no debe bloquear el logout
    }
  }

  /**
   * Resetear navegación al login
   */
  resetNavigation(navigation) {
    try {
      if (navigation) {
        // Resetear stack de navegación completamente
        navigation.reset({
          index: 0,
          routes: [{ name: 'UserTypeScreen' }], // O la pantalla inicial que uses
        });
        
        console.log('🧭 Navegación reseteada');
      }
    } catch (error) {
      console.error('❌ Error reseteando navegación:', error);
    }
  }

  /**
   * Logout rápido sin confirmación (para desarrollo/debug)
   */
  async quickLogout(navigation) {
    return await this.forceLogout(navigation, false);
  }

  /**
   * Limpiar solo estado de delivery (mantener sesión)
   */
  async clearDeliveryOnly() {
    try {
      await this.clearDeliveryState();
      
      Alert.alert(
        '✅ Estado Limpiado',
        'El estado de delivery ha sido limpiado. Puedes intentar tomar un nuevo pedido.',
        [{ text: 'OK' }]
      );
      
      return true;
    } catch (error) {
      console.error('❌ Error limpiando solo delivery:', error);
      
      Alert.alert(
        '❌ Error',
        'No se pudo limpiar el estado de delivery. Intenta cerrar sesión completamente.',
        [{ text: 'OK' }]
      );
      
      return false;
    }
  }

  /**
   * Verificar si hay estado inconsistente
   */
  async checkInconsistentState() {
    try {
      const deliveryKeys = [
        'currentDelivery',
        'activeDeliveryId',
        'deliveryStatus'
      ];
      
      const values = await AsyncStorage.multiGet(deliveryKeys);
      const hasInconsistentState = values.some(([key, value]) => value !== null);
      
      return {
        hasInconsistentState,
        inconsistentKeys: values
          .filter(([key, value]) => value !== null)
          .map(([key, value]) => ({ key, value }))
      };
    } catch (error) {
      console.error('❌ Error verificando estado:', error);
      return { hasInconsistentState: false, inconsistentKeys: [] };
    }
  }

  /**
   * Mostrar opciones de limpieza al usuario
   */
  showCleanupOptions(navigation) {
    Alert.alert(
      '🔧 Opciones de Limpieza',
      'Elige una opción para resolver problemas de estado:',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: 'Limpiar Solo Delivery',
          onPress: () => this.clearDeliveryOnly()
        },
        {
          text: 'Cerrar Sesión Completa',
          style: 'destructive',
          onPress: () => this.forceLogout(navigation)
        }
      ]
    );
  }
}

// Crear instancia singleton
const emergencyLogout = new EmergencyLogout();

// Hook para usar en componentes funcionales
export const useEmergencyLogout = () => {
  const { useNavigation } = require('@react-navigation/native');
  const navigation = useNavigation();
  
  return {
    forceLogout: (showConfirmation = true) => emergencyLogout.forceLogout(navigation, showConfirmation),
    quickLogout: () => emergencyLogout.quickLogout(navigation),
    clearDeliveryOnly: () => emergencyLogout.clearDeliveryOnly(),
    showCleanupOptions: () => emergencyLogout.showCleanupOptions(navigation),
    checkInconsistentState: () => emergencyLogout.checkInconsistentState()
  };
};

export default emergencyLogout;