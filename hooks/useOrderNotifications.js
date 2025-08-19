import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import NotificationService from '../services/NotificationService';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';

const useOrderNotifications = (orderId = null) => {
  const navigation = useNavigation();
  const appState = useRef(AppState.currentState);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Inicializar servicio de notificaciones
    NotificationService.initialize();

    // Configurar listener para cuando se toca una notificación
    const handleNotificationOpen = (notification) => {
      if (notification?.data?.type === 'order_update' && notification?.data?.orderId) {
        navigation.navigate('OrderTracking', { 
          orderId: notification.data.orderId,
          orderNumber: notification.data.orderNumber 
        });
      }
    };

    // Suscribirse a actualizaciones del pedido si hay orderId
    if (orderId) {
      startOrderTracking(orderId);
    }

    // Listener para cambios en el estado de la app
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App volvió al primer plano
        if (orderId) {
          checkOrderStatus(orderId);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [orderId]);

  const startOrderTracking = (orderId) => {
    // Verificar estado del pedido cada 30 segundos
    intervalRef.current = setInterval(() => {
      checkOrderStatus(orderId);
    }, 30000);

    // Verificar inmediatamente
    checkOrderStatus(orderId);
  };

  const checkOrderStatus = async (orderId) => {
    try {
      const response = await apiClient.get(`/orders/${orderId}`);
      
      if (response.data?.success && response.data?.data?.order) {
        const order = response.data.data.order;
        const { status, orderNumber } = order;

        // Enviar notificación local según el estado
        switch (status) {
          case 'confirmed':
            NotificationService.notifyOrderUpdate(
              orderNumber,
              'confirmed',
              'Tu pedido ha sido confirmado por el comerciante'
            );
            break;
          
          case 'preparing':
            NotificationService.notifyOrderUpdate(
              orderNumber,
              'preparing',
              'Tu pedido está siendo preparado'
            );
            break;
          
          case 'ready':
            NotificationService.notifyOrderUpdate(
              orderNumber,
              'ready',
              'Tu pedido está listo para ser recogido'
            );
            break;
          
          case 'assigned':
            NotificationService.notifyOrderUpdate(
              orderNumber,
              'assigned',
              'Un repartidor ha sido asignado a tu pedido'
            );
            break;
          
          case 'picked_up':
            NotificationService.notifyOrderUpdate(
              orderNumber,
              'picked_up',
              'El repartidor ha recogido tu pedido'
            );
            break;
          
          case 'in_transit':
            NotificationService.notifyOrderUpdate(
              orderNumber,
              'in_transit',
              'Tu pedido está en camino'
            );
            break;
          
          case 'delivered':
            NotificationService.notifyOrderUpdate(
              orderNumber,
              'completed',
              '¡Tu pedido ha sido entregado! ¡Disfrútalo!'
            );
            // Detener el tracking
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            break;
          
          case 'cancelled':
            NotificationService.notifyOrderUpdate(
              orderNumber,
              'cancelled',
              'Tu pedido ha sido cancelado'
            );
            // Detener el tracking
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error verificando estado del pedido:', error);
    }
  };

  const sendTestNotification = () => {
    NotificationService.sendLocalNotification({
      channelId: 'rapigoo-orders',
      title: '🍔 Pedido #TEST123',
      message: 'Esta es una notificación de prueba',
      data: {
        type: 'order_update',
        orderId: 'test',
        orderNumber: 'TEST123'
      }
    });
  };

  return {
    sendTestNotification,
    checkOrderStatus
  };
};

export default useOrderNotifications;