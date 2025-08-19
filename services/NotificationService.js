import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import apiClient from '../api/apiClient';

// Suprimir warnings específicos de Expo Go
const originalWarn = console.warn;
console.warn = (message, ...args) => {
  if (typeof message === 'string' && 
      (message.includes('expo-notifications: Android Push notifications') ||
       message.includes('remote notifications') ||
       message.includes('removed from Expo Go'))) {
    return; // Suprimir este warning específico
  }
  originalWarn(message, ...args);
};

// Configurar el comportamiento de las notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.deviceId = null;
    this.isInitialized = false;
    this.notificationQueue = [];
    this.preferences = {
      orderUpdates: true,
      promotions: true,
      newMerchants: true,
      sound: true,
      vibrate: true
    };
    this.notificationListener = null;
    this.responseListener = null;
  }

  // Inicializar el servicio de notificaciones
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Cargar preferencias silenciosamente
      await this.loadPreferences();
      this.deviceId = await this.getOrCreateDeviceId();
      
      // Configurar solo notificaciones locales para Expo Go
      const notificationsSetup = await this.setupLocalNotifications();
      
      if (notificationsSetup) {
        this.setupNotificationListeners();
        // Registro opcional del dispositivo (no crítico)
        this.registerDeviceWithServer().catch((error) => {
          console.log('⚠️ Registro de dispositivo falló (no crítico):', error.message);
        });
      }
      
      this.isInitialized = true;
      console.log('✅ Notificaciones locales listas');
    } catch (error) {
      // Log mínimo para no saturar la consola
      console.log('⚠️ Notificaciones no disponibles');
    }
  }

  // Configurar notificaciones locales (compatible con Expo Go)
  async setupLocalNotifications() {
    try {
      // Solicitar permisos para notificaciones locales
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        // Silencioso - solo mostrar diálogo si es necesario
        setTimeout(() => this.showNotificationSettingsDialog(), 2000);
        return false;
      }

      // Configurar canales para Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Notificaciones Generales',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        // Canal específico para pedidos
        await Notifications.setNotificationChannelAsync('rapigoo-orders', {
          name: 'Actualizaciones de Pedidos',
          description: 'Notificaciones sobre el estado de tus pedidos',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4CAF50',
          sound: 'default',
          showBadge: true,
        });

        // Canal para promociones
        await Notifications.setNotificationChannelAsync('rapigoo-promotions', {
          name: 'Promociones y Ofertas',
          description: 'Promociones especiales y ofertas de comerciantes',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 100, 100, 100],
          lightColor: '#FF6B6B',
          showBadge: false,
        });
      }

      // Configuración exitosa - log mínimo
      return true;
      
    } catch (error) {
      // Error silencioso
      return false;
    }
  }

  // Configurar listeners de notificaciones
  setupNotificationListeners() {
    // Listener para cuando se recibe una notificación mientras la app está en primer plano
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notificación recibida:', notification);
      this.saveNotificationToHistory(notification);
    });

    // Listener para cuando el usuario toca una notificación
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notificación tocada:', response);
      this.handleNotificationTap(response.notification);
    });
  }

  // Manejar tap en notificación
  handleNotificationTap(notification) {
    const { data } = notification.request.content;

    switch (data?.type) {
      case 'order_update':
        // Navegar a detalles del pedido
        if (data.orderId) {
          console.log('Navegar a pedido:', data.orderId);
          // Esta funcionalidad se implementará con navigation ref
        }
        break;

      case 'new_promotion':
        // Navegar a la promoción
        if (data.promotionId) {
          console.log('Navegar a promoción:', data.promotionId);
        }
        break;

      case 'new_merchant':
        // Navegar al perfil del comerciante
        if (data.merchantId) {
          console.log('Navegar a comerciante:', data.merchantId);
        }
        break;

      default:
        console.log('Navegar a home');
    }
  }

  // Enviar notificación local
  async sendLocalNotification(options) {
    const defaultOptions = {
      title: 'Rapigoo',
      body: '',
      data: {},
      sound: this.preferences.sound ? 'default' : null,
      ...options
    };

    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: defaultOptions.title,
          body: defaultOptions.message || defaultOptions.body,
          data: defaultOptions.data,
          sound: defaultOptions.sound,
        },
        trigger: null, // Enviar inmediatamente
      });
      
      // Notificación enviada exitosamente
      return identifier;
    } catch (error) {
      // Error silencioso
      return null;
    }
  }

  // Programar notificación local
  async scheduleLocalNotification(options, date) {
    const defaultOptions = {
      title: 'Rapigoo',
      body: '',
      data: {},
      sound: this.preferences.sound ? 'default' : null,
      ...options
    };

    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: defaultOptions.title,
          body: defaultOptions.message || defaultOptions.body,
          data: defaultOptions.data,
          sound: defaultOptions.sound,
        },
        trigger: { date },
      });
      
      // Notificación programada exitosamente
      return identifier;
    } catch (error) {
      // Error silencioso
      return null;
    }
  }

  // Cancelar notificación programada
  async cancelLocalNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('🗑️ Notificación cancelada:', notificationId);
    } catch (error) {
      console.error('❌ Error cancelando notificación:', error);
    }
  }

  // Cancelar todas las notificaciones locales
  async cancelAllLocalNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('🗑️ Todas las notificaciones canceladas');
    } catch (error) {
      console.error('❌ Error cancelando todas las notificaciones:', error);
    }
  }

  // Registrar dispositivo en el servidor (sin push token para Expo Go)
  async registerDeviceWithServer() {
    try {
      // Verificar si hay token de autenticación
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('⚠️ No hay token de autenticación, omitiendo registro de dispositivo');
        return;
      }
      
      const deviceId = await this.getOrCreateDeviceId();
      
      const payload = {
        deviceToken: deviceId, // ← Cambiado de deviceId a deviceToken
        platform: Platform.OS,
        deviceInfo: {
          model: Device.modelName || 'Unknown',
          version: Platform.Version?.toString() || 'Unknown',
          appVersion: '1.0.0'
          // Removidos campos no permitidos por el esquema de validación
        }
      };
      
      console.log('📱 Enviando registro de dispositivo:', JSON.stringify(payload, null, 2));
      console.log('📱 About to make POST request to /notifications/register...');
      
      const response = await apiClient.post('/notifications/register', payload);
      
      console.log('📱 Response received:', response.status);

      if (response.data.success) {
        console.log('✅ Dispositivo registrado en el servidor');
        await AsyncStorage.setItem('device_registered', 'true');
      }
    } catch (error) {
      console.error('❌ Error registrando dispositivo:', error);
      console.error('❌ Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // Log más detallado de la respuesta del servidor
      if (error.response?.data?.details) {
        console.error('❌ Server validation errors:', JSON.stringify(error.response.data.details, null, 2));
      }
    }
  }

  // Generar o recuperar ID único del dispositivo
  async getOrCreateDeviceId() {
    try {
      let deviceId = await AsyncStorage.getItem('unique_device_id');
      if (!deviceId) {
        deviceId = `expo_go_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('unique_device_id', deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error('Error generando device ID:', error);
      return `fallback_${Date.now()}`;
    }
  }

  // Actualizar preferencias de notificaciones
  async updatePreferences(newPreferences) {
    try {
      this.preferences = { ...this.preferences, ...newPreferences };
      await AsyncStorage.setItem('notificationPreferences', JSON.stringify(this.preferences));
      
      // Enviar preferencias al servidor
      await apiClient.put('/notifications/preferences', this.preferences);
      
      console.log('✅ Preferencias actualizadas:', this.preferences);
      return true;
    } catch (error) {
      console.error('❌ Error actualizando preferencias:', error);
      return false;
    }
  }

  // Cargar preferencias desde storage
  async loadPreferences() {
    try {
      const stored = await AsyncStorage.getItem('notificationPreferences');
      if (stored) {
        this.preferences = { ...this.preferences, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error cargando preferencias:', error);
    }
  }

  // Guardar token del dispositivo
  async saveDeviceToken(token) {
    try {
      await AsyncStorage.setItem('expo_push_token', token);
    } catch (error) {
      console.error('Error guardando token:', error);
    }
  }

  // Cargar token del dispositivo
  async loadDeviceToken() {
    try {
      const token = await AsyncStorage.getItem('expo_push_token');
      if (token) {
        this.expoPushToken = token;
      }
      return token;
    } catch (error) {
      console.error('Error cargando token:', error);
      return null;
    }
  }

  // Guardar notificación en historial
  async saveNotificationToHistory(notification) {
    try {
      const history = await this.getNotificationHistory();
      const newNotification = {
        id: Date.now().toString(),
        title: notification.request.content.title,
        message: notification.request.content.body,
        data: notification.request.content.data,
        receivedAt: new Date().toISOString(),
        read: false
      };

      const updatedHistory = [newNotification, ...history.slice(0, 49)]; // Mantener solo 50
      await AsyncStorage.setItem('notificationHistory', JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error guardando notificación:', error);
    }
  }

  // Obtener historial de notificaciones
  async getNotificationHistory() {
    try {
      const history = await AsyncStorage.getItem('notificationHistory');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      return [];
    }
  }

  // Marcar notificación como leída
  async markNotificationAsRead(notificationId) {
    try {
      const history = await this.getNotificationHistory();
      const updatedHistory = history.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      );
      await AsyncStorage.setItem('notificationHistory', JSON.stringify(updatedHistory));
      return true;
    } catch (error) {
      console.error('Error marcando como leída:', error);
      return false;
    }
  }

  // Limpiar historial de notificaciones
  async clearNotificationHistory() {
    try {
      await AsyncStorage.removeItem('notificationHistory');
      return true;
    } catch (error) {
      console.error('Error limpiando historial:', error);
      return false;
    }
  }

  // Obtener cuenta de badge
  async getBadgeCount() {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error obteniendo badge count:', error);
      return 0;
    }
  }

  // Establecer cuenta de badge
  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error estableciendo badge count:', error);
    }
  }

  // Verificar si las notificaciones están habilitadas
  async checkNotificationPermissions() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error verificando permisos:', error);
      return false;
    }
  }

  // Mostrar diálogo para habilitar notificaciones
  showNotificationSettingsDialog() {
    Alert.alert(
      'Notificaciones Deshabilitadas',
      'Para recibir actualizaciones importantes sobre tus pedidos, habilita las notificaciones en la configuración.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Abrir Configuración',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  }

  // Métodos de utilidad para tipos específicos de notificaciones

  // Notificación de actualización de pedido
  notifyOrderUpdate(orderNumber, status, message) {
    if (!this.preferences.orderUpdates) return;

    const statusIcons = {
      confirmed: '✅',
      preparing: '👨‍🍳',
      ready: '📦',
      picked_up: '🚚',
      in_transit: '🛣️',
      completed: '🎉',
      cancelled: '❌'
    };

    this.sendLocalNotification({
      title: `${statusIcons[status] || '📋'} Pedido ${orderNumber}`,
      message: message,
      data: {
        type: 'order_update',
        orderNumber,
        status
      }
    });
  }

  // Notificación de nueva promoción
  notifyNewPromotion(merchantName, promotion) {
    if (!this.preferences.promotions) return;

    this.sendLocalNotification({
      title: `🎉 Nueva oferta de ${merchantName}`,
      message: promotion.description,
      data: {
        type: 'new_promotion',
        merchantName,
        promotionId: promotion.id
      }
    });
  }

  // Notificación de recordatorio de pedido
  scheduleOrderReminder(orderNumber, estimatedTime) {
    const reminderTime = new Date(estimatedTime.getTime() - 10 * 60 * 1000); // 10 min antes

    this.scheduleLocalNotification({
      title: '⏰ Tu pedido está casi listo',
      message: `El pedido ${orderNumber} estará listo en aproximadamente 10 minutos`,
      data: {
        type: 'order_reminder',
        orderNumber
      }
    }, reminderTime);
  }

  // Notificación de bienvenida para probar que funciona
  sendWelcomeNotification() {
    this.sendLocalNotification({
      title: '🎉 ¡Bienvenido a Rapigoo!',
      message: 'Las notificaciones están funcionando correctamente. Te mantendremos informado sobre tus pedidos.',
      data: {
        type: 'welcome',
        action: 'open_home'
      }
    });
  }

  // Enviar notificación de prueba
  sendTestNotification() {
    this.sendLocalNotification({
      title: '🧪 Notificación de prueba',
      message: 'Esta es una notificación de prueba para verificar que todo funciona correctamente.',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Programar recordatorios periódicos para verificar pedidos activos
  scheduleOrderCheckReminders(orders) {
    // Cancelar recordatorios anteriores
    this.cancelAllLocalNotifications();
    
    orders.forEach(order => {
      if (['pending', 'confirmed', 'preparing', 'ready'].includes(order.status)) {
        // Programar recordatorio cada 5 minutos para pedidos activos
        const reminderIntervals = [5, 10, 15, 20, 30]; // minutos
        
        reminderIntervals.forEach(minutes => {
          const reminderTime = new Date(Date.now() + minutes * 60 * 1000);
          
          this.scheduleLocalNotification({
            title: `📋 Pedido ${order.orderNumber}`,
            message: `Verificando el estado de tu pedido...`,
            data: {
              type: 'order_check',
              orderId: order._id,
              orderNumber: order.orderNumber
            }
          }, reminderTime);
        });
      }
    });
  }

  // Limpiar recursos
  cleanup() {
    this.cancelAllLocalNotifications();
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    this.deviceId = null;
    this.isInitialized = false;
  }

  // Obtener información del estado del servicio
  getServiceInfo() {
    return {
      isInitialized: this.isInitialized,
      hasDeviceId: !!this.deviceId,
      preferences: this.preferences,
      platform: Platform.OS,
      isExpoGo: true,
      supportsLocalNotifications: true,
      supportsPushNotifications: false
    };
  }
}

// Exportar instancia singleton
export default new NotificationService();