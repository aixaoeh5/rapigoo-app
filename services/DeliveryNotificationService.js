// services/DeliveryNotificationService.js
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Servicio de notificaciones para delivery tracking
 * Maneja notificaciones push y locales para actualizaciones de estado
 */
class DeliveryNotificationService {
  constructor() {
    this.isInitialized = false;
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.notificationHistory = [];
    
    this.initializeService();
  }

  /**
   * Inicializar el servicio de notificaciones
   */
  async initializeService() {
    try {
      console.log('🔔 Inicializando DeliveryNotificationService...');
      
      // Configurar comportamiento de notificaciones
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // Solicitar permisos
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('⚠️ Permisos de notificación denegados');
        return;
      }

      // Obtener token de push notifications
      await this.registerForPushNotifications();

      // Configurar listeners
      this.setupNotificationListeners();

      this.isInitialized = true;
      console.log('✅ DeliveryNotificationService inicializado correctamente');

    } catch (error) {
      console.error('❌ Error inicializando DeliveryNotificationService:', error);
    }
  }

  /**
   * Solicitar permisos de notificación
   */
  async requestPermissions() {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('delivery-updates', {
          name: 'Actualizaciones de Entrega',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E60023',
          description: 'Notificaciones sobre el estado de tus entregas',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('❌ Error solicitando permisos de notificación:', error);
      return false;
    }
  }

  /**
   * Registrar para push notifications
   */
  async registerForPushNotifications() {
    try {
      if (!this.isInitialized) {
        const token = await Notifications.getExpoPushTokenAsync();
        this.expoPushToken = token;
        
        // Guardar token para sincronizar con backend
        await AsyncStorage.setItem('expoPushToken', token.data);
        
        console.log('📱 Push token obtenido:', token.data);
        
        // TODO: Enviar token al backend
        // await this.syncTokenWithBackend(token.data);
      }
    } catch (error) {
      console.error('❌ Error registrando push notifications:', error);
    }
  }

  /**
   * Configurar listeners de notificación
   */
  setupNotificationListeners() {
    // Listener para notificaciones recibidas
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notificación recibida:', notification);
      this.handleNotificationReceived(notification);
    });

    // Listener para respuestas a notificaciones
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notificación presionada:', response);
      this.handleNotificationResponse(response);
    });
  }

  /**
   * Manejar notificación recibida
   */
  handleNotificationReceived(notification) {
    try {
      const { data, request } = notification;
      
      // Agregar al historial
      this.addToHistory({
        id: request.identifier,
        title: request.content.title,
        body: request.content.body,
        data: data,
        timestamp: new Date().toISOString(),
        type: 'received'
      });

      // Manejar diferentes tipos de notificaciones
      if (data?.type) {
        switch (data.type) {
          case 'delivery_status_update':
            this.handleDeliveryStatusNotification(data);
            break;
          case 'location_update':
            this.handleLocationUpdateNotification(data);
            break;
          case 'order_update':
            this.handleOrderUpdateNotification(data);
            break;
          default:
            console.log('ℹ️ Tipo de notificación desconocido:', data.type);
        }
      }
    } catch (error) {
      console.error('❌ Error manejando notificación recibida:', error);
    }
  }

  /**
   * Manejar respuesta a notificación (tap)
   */
  handleNotificationResponse(response) {
    try {
      const { notification, actionIdentifier } = response;
      const data = notification.request.content.data;

      // Agregar al historial
      this.addToHistory({
        id: notification.request.identifier,
        title: notification.request.content.title,
        body: notification.request.content.body,
        data: data,
        timestamp: new Date().toISOString(),
        type: 'tapped',
        action: actionIdentifier
      });

      // Navegar o realizar acción basada en el tipo
      if (data?.navigationTarget) {
        this.handleNavigationFromNotification(data);
      }
    } catch (error) {
      console.error('❌ Error manejando respuesta de notificación:', error);
    }
  }

  /**
   * Manejar notificación de estado de delivery
   */
  handleDeliveryStatusNotification(data) {
    console.log('📦 Notificación de estado de delivery:', data);
    
    // Emitir evento para componentes que estén escuchando
    // TODO: Implementar event emitter o context
  }

  /**
   * Manejar notificación de actualización de ubicación
   */
  handleLocationUpdateNotification(data) {
    console.log('📍 Notificación de ubicación:', data);
    
    // Actualizar ubicación en componentes relevantes
    // TODO: Implementar actualización de ubicación
  }

  /**
   * Manejar notificación de actualización de pedido
   */
  handleOrderUpdateNotification(data) {
    console.log('🛍️ Notificación de pedido:', data);
    
    // Actualizar estado del pedido
    // TODO: Implementar actualización de pedido
  }

  /**
   * Manejar navegación desde notificación
   */
  handleNavigationFromNotification(data) {
    // TODO: Implementar navegación
    console.log('🧭 Navegando desde notificación:', data.navigationTarget);
  }

  /**
   * Enviar notificación local para estado de delivery
   */
  async sendDeliveryStatusNotification(status, details = {}) {
    try {
      const statusMessages = {
        assigned: {
          title: '📦 Nuevo Delivery Asignado',
          body: 'Tienes un nuevo pedido para entregar',
          icon: '📦'
        },
        heading_to_pickup: {
          title: '🚗 En Camino al Restaurante',
          body: 'Dirigiéndose a recoger el pedido',
          icon: '🚗'
        },
        at_pickup: {
          title: '🏪 En el Restaurante',
          body: 'Has llegado al punto de recogida',
          icon: '🏪'
        },
        picked_up: {
          title: '✅ Pedido Recogido',
          body: 'Ahora dirigiéndose al cliente',
          icon: '✅'
        },
        heading_to_delivery: {
          title: '🚗 En Camino al Cliente',
          body: 'Dirigiéndose al punto de entrega',
          icon: '🚗'
        },
        at_delivery: {
          title: '🏠 En Destino',
          body: 'Has llegado al punto de entrega',
          icon: '🏠'
        },
        delivered: {
          title: '🎉 Entrega Completada',
          body: '¡Pedido entregado exitosamente!',
          icon: '🎉'
        }
      };

      const config = statusMessages[status] || statusMessages.assigned;
      
      await this.scheduleLocalNotification({
        title: config.title,
        body: details.customMessage || config.body,
        data: {
          type: 'delivery_status_update',
          status: status,
          orderId: details.orderId,
          timestamp: new Date().toISOString()
        },
        categoryId: 'delivery-updates'
      });

      console.log('🔔 Notificación de estado enviada:', status);
    } catch (error) {
      console.error('❌ Error enviando notificación de estado:', error);
    }
  }

  /**
   * Enviar notificación de proximidad (cuando está cerca del destino)
   */
  async sendProximityNotification(destinationType, distance) {
    try {
      const messages = {
        pickup: {
          title: '📍 Llegando al Restaurante',
          body: `Estás a ${Math.round(distance)}m del punto de recogida`
        },
        delivery: {
          title: '📍 Llegando al Destino',
          body: `Estás a ${Math.round(distance)}m del punto de entrega`
        }
      };

      const config = messages[destinationType];
      if (!config) return;

      await this.scheduleLocalNotification({
        title: config.title,
        body: config.body,
        data: {
          type: 'proximity_alert',
          destinationType,
          distance,
          timestamp: new Date().toISOString()
        },
        categoryId: 'delivery-updates'
      });

      console.log('🔔 Notificación de proximidad enviada:', destinationType, distance);
    } catch (error) {
      console.error('❌ Error enviando notificación de proximidad:', error);
    }
  }

  /**
   * Enviar notificación de problema/error
   */
  async sendErrorNotification(errorType, message) {
    try {
      const errorMessages = {
        network: {
          title: '⚠️ Problema de Conexión',
          body: 'Sin conexión a internet. Trabajando en modo offline.'
        },
        gps: {
          title: '📍 Problema de GPS',
          body: 'No se puede obtener la ubicación. Usando ubicación aproximada.'
        },
        sync: {
          title: '🔄 Error de Sincronización',
          body: 'Algunos datos no se han sincronizado. Se reintentará automáticamente.'
        }
      };

      const config = errorMessages[errorType] || {
        title: '⚠️ Error del Sistema',
        body: message || 'Se detectó un problema. La app intentará recuperarse automáticamente.'
      };

      await this.scheduleLocalNotification({
        title: config.title,
        body: config.body,
        data: {
          type: 'error_notification',
          errorType,
          timestamp: new Date().toISOString()
        },
        categoryId: 'delivery-updates'
      });

      console.log('🔔 Notificación de error enviada:', errorType);
    } catch (error) {
      console.error('❌ Error enviando notificación de error:', error);
    }
  }

  /**
   * Programar notificación local
   */
  async scheduleLocalNotification(config) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: config.title,
          body: config.body,
          data: config.data || {},
          categoryIdentifier: config.categoryId,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Mostrar inmediatamente
      });

      console.log('📝 Notificación programada:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('❌ Error programando notificación:', error);
      return null;
    }
  }

  /**
   * Cancelar notificación
   */
  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log('❌ Notificación cancelada:', notificationId);
    } catch (error) {
      console.error('❌ Error cancelando notificación:', error);
    }
  }

  /**
   * Cancelar todas las notificaciones pendientes
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('🧹 Todas las notificaciones canceladas');
    } catch (error) {
      console.error('❌ Error cancelando todas las notificaciones:', error);
    }
  }

  /**
   * Obtener notificaciones pendientes
   */
  async getPendingNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('📋 Notificaciones pendientes:', notifications.length);
      return notifications;
    } catch (error) {
      console.error('❌ Error obteniendo notificaciones pendientes:', error);
      return [];
    }
  }

  /**
   * Limpiar badge de notificaciones
   */
  async clearBadge() {
    try {
      await Notifications.setBadgeCountAsync(0);
      console.log('🔢 Badge de notificaciones limpiado');
    } catch (error) {
      console.error('❌ Error limpiando badge:', error);
    }
  }

  /**
   * Agregar notificación al historial
   */
  addToHistory(notification) {
    this.notificationHistory.unshift(notification);
    
    // Mantener solo las últimas 50 notificaciones
    if (this.notificationHistory.length > 50) {
      this.notificationHistory = this.notificationHistory.slice(0, 50);
    }
  }

  /**
   * Obtener historial de notificaciones
   */
  getNotificationHistory() {
    return this.notificationHistory;
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  getNotificationStats() {
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentNotifications = this.notificationHistory.filter(
      notification => new Date(notification.timestamp).getTime() > last24Hours
    );

    const notificationsByType = recentNotifications.reduce((acc, notification) => {
      const type = notification.data?.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return {
      totalNotifications: this.notificationHistory.length,
      recentNotifications: recentNotifications.length,
      notificationsByType,
      hasPermissions: this.isInitialized,
      pushToken: this.expoPushToken?.data
    };
  }

  /**
   * Verificar si las notificaciones están habilitadas
   */
  async areNotificationsEnabled() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('❌ Error verificando permisos de notificación:', error);
      return false;
    }
  }

  /**
   * Configurar preferencias de notificación
   */
  async setNotificationPreferences(preferences) {
    try {
      await AsyncStorage.setItem('notificationPreferences', JSON.stringify(preferences));
      console.log('⚙️ Preferencias de notificación guardadas:', preferences);
    } catch (error) {
      console.error('❌ Error guardando preferencias:', error);
    }
  }

  /**
   * Obtener preferencias de notificación
   */
  async getNotificationPreferences() {
    try {
      const stored = await AsyncStorage.getItem('notificationPreferences');
      return stored ? JSON.parse(stored) : {
        deliveryUpdates: true,
        proximityAlerts: true,
        errorNotifications: true,
        soundEnabled: true,
        vibrationEnabled: true
      };
    } catch (error) {
      console.error('❌ Error obteniendo preferencias:', error);
      return {};
    }
  }

  /**
   * Cleanup del servicio
   */
  cleanup() {
    try {
      console.log('🧹 Limpiando DeliveryNotificationService...');
      
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
      }
      
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
      }
      
      this.isInitialized = false;
      console.log('✅ DeliveryNotificationService limpiado');
    } catch (error) {
      console.error('❌ Error en cleanup de DeliveryNotificationService:', error);
    }
  }
}

// Exportar instancia singleton
export default new DeliveryNotificationService();