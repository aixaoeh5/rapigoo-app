import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { apiClient } from '../api/apiClient';

class NotificationService {
  constructor() {
    this.deviceToken = null;
    this.isInitialized = false;
    this.notificationQueue = [];
    this.preferences = {
      orderUpdates: true,
      promotions: true,
      newMerchants: true,
      sound: true,
      vibrate: true
    };
  }

  // Inicializar el servicio de notificaciones
  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.loadPreferences();
      this.configurePushNotifications();
      await this.requestPermissions();
      this.isInitialized = true;
      console.log('✅ Servicio de notificaciones inicializado');
    } catch (error) {
      console.error('❌ Error inicializando notificaciones:', error);
    }
  }

  // Configurar las notificaciones push
  configurePushNotifications() {
    PushNotification.configure({
      // Callback cuando se recibe una notificación remota
      onNotification: (notification) => {
        console.log('📱 Notificación recibida:', notification);
        this.handleNotification(notification);

        // Para iOS
        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },

      // Callback para el token del dispositivo
      onRegister: (token) => {
        console.log('🔑 Token de dispositivo:', token);
        this.deviceToken = token.token;
        this.saveDeviceToken(token.token);
        this.sendTokenToServer(token.token);
      },

      // Permisos para iOS
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      // Configuración de canal para Android
      channelId: 'rapigoo-default',
      channelName: 'Rapigoo Notifications',
      channelDescription: 'Notificaciones generales de Rapigoo',

      // Solicitar permisos en inicio
      requestPermissions: Platform.OS === 'ios',
    });

    // Crear canal de notificación para Android
    this.createNotificationChannels();
  }

  // Crear canales de notificación (Android)
  createNotificationChannels() {
    if (Platform.OS === 'android') {
      // Canal para actualizaciones de pedidos
      PushNotification.createChannel(
        {
          channelId: 'rapigoo-orders',
          channelName: 'Actualizaciones de Pedidos',
          channelDescription: 'Notificaciones sobre el estado de tus pedidos',
          importance: 4, // HIGH
          vibrate: true,
        },
        (created) => console.log(`Canal de pedidos ${created ? 'creado' : 'ya existe'}`)
      );

      // Canal para promociones
      PushNotification.createChannel(
        {
          channelId: 'rapigoo-promotions',
          channelName: 'Promociones y Ofertas',
          channelDescription: 'Promociones especiales y ofertas de comerciantes',
          importance: 3, // DEFAULT
          vibrate: false,
        },
        (created) => console.log(`Canal de promociones ${created ? 'creado' : 'ya existe'}`)
      );

      // Canal para nuevos comerciantes
      PushNotification.createChannel(
        {
          channelId: 'rapigoo-merchants',
          channelName: 'Nuevos Comerciantes',
          channelDescription: 'Notificaciones de nuevos comerciantes en tu área',
          importance: 2, // LOW
          vibrate: false,
        },
        (created) => console.log(`Canal de comerciantes ${created ? 'creado' : 'ya existe'}`)
      );
    }
  }

  // Solicitar permisos de notificaciones
  async requestPermissions() {
    try {
      if (Platform.OS === 'android') {
        // Android maneja permisos automáticamente desde API 33+
        return true;
      } else {
        // iOS requiere solicitar permisos explícitamente
        const result = await PushNotificationIOS.requestPermissions({
          alert: true,
          badge: true,
          sound: true,
        });
        return result.alert && result.badge && result.sound;
      }
    } catch (error) {
      console.error('Error solicitando permisos:', error);
      return false;
    }
  }

  // Manejar notificación recibida
  handleNotification(notification) {
    const { data, userInteraction } = notification;

    // Solo procesar si el usuario interactuó con la notificación
    if (userInteraction) {
      this.handleNotificationTap(notification);
    }

    // Guardar en historial
    this.saveNotificationToHistory(notification);
  }

  // Manejar tap en notificación
  handleNotificationTap(notification) {
    const { data } = notification;

    switch (data.type) {
      case 'order_update':
        // Navegar a detalles del pedido
        if (data.orderId) {
          // NavigationService.navigate('OrderDetail', { orderId: data.orderId });
          console.log('Navegar a pedido:', data.orderId);
        }
        break;

      case 'new_promotion':
        // Navegar a la promoción
        if (data.promotionId) {
          // NavigationService.navigate('Promotion', { promotionId: data.promotionId });
          console.log('Navegar a promoción:', data.promotionId);
        }
        break;

      case 'new_merchant':
        // Navegar al perfil del comerciante
        if (data.merchantId) {
          // NavigationService.navigate('MerchantProfile', { merchantId: data.merchantId });
          console.log('Navegar a comerciante:', data.merchantId);
        }
        break;

      default:
        // Navegar a home
        // NavigationService.navigate('Home');
        console.log('Navegar a home');
    }
  }

  // Enviar notificación local
  sendLocalNotification(options) {
    const defaultOptions = {
      channelId: 'rapigoo-default',
      title: 'Rapigoo',
      message: '',
      playSound: this.preferences.sound,
      vibrate: this.preferences.vibrate,
      ...options
    };

    PushNotification.localNotification(defaultOptions);
  }

  // Programar notificación local
  scheduleLocalNotification(options, date) {
    const defaultOptions = {
      channelId: 'rapigoo-default',
      title: 'Rapigoo',
      message: '',
      date: date,
      playSound: this.preferences.sound,
      vibrate: this.preferences.vibrate,
      ...options
    };

    PushNotification.localNotificationSchedule(defaultOptions);
  }

  // Cancelar notificación programada
  cancelLocalNotification(notificationId) {
    PushNotification.cancelLocalNotifications({ id: notificationId });
  }

  // Cancelar todas las notificaciones locales
  cancelAllLocalNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  // Enviar token al servidor
  async sendTokenToServer(token) {
    try {
      await apiClient.post('/notifications/register', {
        deviceToken: token,
        platform: Platform.OS,
        deviceInfo: {
          model: Platform.constants.Model || 'Unknown',
          version: Platform.Version,
        }
      });
      console.log('✅ Token enviado al servidor');
    } catch (error) {
      console.error('❌ Error enviando token al servidor:', error);
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
      await AsyncStorage.setItem('deviceToken', token);
    } catch (error) {
      console.error('Error guardando token:', error);
    }
  }

  // Cargar token del dispositivo
  async loadDeviceToken() {
    try {
      const token = await AsyncStorage.getItem('deviceToken');
      if (token) {
        this.deviceToken = token;
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
        title: notification.title,
        message: notification.message,
        data: notification.data,
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
  getBadgeCount() {
    return new Promise((resolve) => {
      if (Platform.OS === 'ios') {
        PushNotificationIOS.getApplicationIconBadgeNumber(resolve);
      } else {
        resolve(0); // Android maneja badges diferente
      }
    });
  }

  // Establecer cuenta de badge
  setBadgeCount(count) {
    if (Platform.OS === 'ios') {
      PushNotificationIOS.setApplicationIconBadgeNumber(count);
    }
    // Android: Los badges se manejan automáticamente por el sistema
  }

  // Verificar si las notificaciones están habilitadas
  async checkNotificationPermissions() {
    try {
      if (Platform.OS === 'ios') {
        const permissions = await PushNotificationIOS.checkPermissions();
        return permissions.alert && permissions.badge && permissions.sound;
      } else {
        // Para Android, asumir que están habilitadas (se maneja automáticamente)
        return true;
      }
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
      completed: '🎉',
      cancelled: '❌'
    };

    this.sendLocalNotification({
      channelId: 'rapigoo-orders',
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
      channelId: 'rapigoo-promotions',
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
      channelId: 'rapigoo-orders',
      title: '⏰ Tu pedido está casi listo',
      message: `El pedido ${orderNumber} estará listo en aproximadamente 10 minutos`,
      data: {
        type: 'order_reminder',
        orderNumber
      }
    }, reminderTime);
  }

  // Limpiar recursos
  cleanup() {
    this.cancelAllLocalNotifications();
    this.deviceToken = null;
    this.isInitialized = false;
  }

  // Obtener información del estado del servicio
  getServiceInfo() {
    return {
      isInitialized: this.isInitialized,
      hasDeviceToken: !!this.deviceToken,
      preferences: this.preferences,
      platform: Platform.OS
    };
  }
}

// Exportar instancia singleton
export default new NotificationService();