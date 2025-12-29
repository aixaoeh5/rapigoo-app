import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../../api/apiClient';
import NotificationService from '../../services/NotificationService';

const OrderStatusNotifier = () => {
  const navigation = useNavigation();
  const [activeOrders, setActiveOrders] = useState([]);
  const [showNotification, setShowNotification] = useState(false);
  const [lastNotification, setLastNotification] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // FIX: Agregar usuario actual
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const intervalRef = useRef(null);
  const isInitialized = useRef(false);

  // FIX: Cargar datos del usuario actual
  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await apiClient.get('/auth/user');
      if (response.data) {
        console.log('📱 OrderStatusNotifier - Usuario actual cargado:', {
          id: response.data._id,
          role: response.data.role,
          email: response.data.email
        });
        setCurrentUser(response.data);
      }
    } catch (error) {
      console.error('❌ OrderStatusNotifier - Error cargando usuario:', error.message);
      setCurrentUser(null);
    }
  }, []);

  // FIX: Función para determinar si una notificación es relevante para el usuario actual
  const isNotificationRelevantForUser = useCallback((order, user) => {
    if (!user || !order) return false;

    switch (user.role) {
      case 'customer':
      case 'client':
        // Los clientes solo ven notificaciones de SUS propios pedidos
        return order.customerId === user._id || order.customerId?._id === user._id;
      
      case 'merchant':
      case 'comerciante':
        // Los comerciantes solo ven notificaciones de pedidos de SU negocio
        return order.merchantId === user._id || order.merchantId?._id === user._id;
      
      case 'delivery':
        // Los deliveries solo ven notificaciones de pedidos que ELLOS están entregando
        // Necesitamos verificar si este delivery está asignado al pedido
        return false; // Los deliveries no necesitan estas notificaciones aquí
      
      default:
        return false;
    }
  }, []);

  const loadActiveOrders = useCallback(async () => {
    try {
      const response = await apiClient.get('/orders');
      
      if (response.data.success) {
        let ordersArray = null;
        
        if (response.data.orders && Array.isArray(response.data.orders)) {
          ordersArray = response.data.orders;
        } else if (response.data.data?.orders && Array.isArray(response.data.data.orders)) {
          ordersArray = response.data.data.orders;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          ordersArray = response.data.data;
        } else {
          console.log('⚠️ OrderStatusNotifier: No se encontró estructura de pedidos válida');
          setActiveOrders([]);
          return;
        }
        
        // FIX: Filtrar solo órdenes activas Y relevantes para el usuario actual
        const allActiveOrders = ordersArray.filter(order => 
          order && 
          order.status && 
          ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit', 'heading_to_pickup', 'heading_to_delivery'].includes(order.status)
        );

        // FIX: Aplicar filtro por usuario
        const userRelevantOrders = currentUser ? 
          allActiveOrders.filter(order => isNotificationRelevantForUser(order, currentUser)) : 
          [];

        console.log(`📱 OrderStatusNotifier - Filtradas ${userRelevantOrders.length} de ${allActiveOrders.length} órdenes para usuario ${currentUser?.role}`);
        
        setActiveOrders(userRelevantOrders);
        
        // Guardar en AsyncStorage para comparación posterior
        await AsyncStorage.setItem('lastActiveOrders', JSON.stringify(userRelevantOrders));
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('OrderStatusNotifier - Error loading active orders:', error.message);
      }
      setActiveOrders([]);
    }
  }, [currentUser, isNotificationRelevantForUser]); // FIX: Include user dependencies

  const checkOrderUpdates = useCallback(async () => {
    try {
      const response = await apiClient.get('/orders');
      if (response.data.success) {
        let ordersArray = null;
        
        if (response.data.orders && Array.isArray(response.data.orders)) {
          ordersArray = response.data.orders;
        } else if (response.data.data?.orders && Array.isArray(response.data.data.orders)) {
          ordersArray = response.data.data.orders;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          ordersArray = response.data.data;
        } else {
          console.log('⚠️ OrderStatusNotifier: No se encontró estructura de pedidos en checkOrderUpdates');
          return;
        }
        
        // FIX: Filtrar solo órdenes activas Y relevantes para el usuario actual
        const allActiveOrders = ordersArray.filter(order => 
          order && 
          order.status && 
          ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit', 'heading_to_pickup', 'heading_to_delivery'].includes(order.status)
        );

        // FIX: Aplicar filtro por usuario
        const currentActiveOrders = currentUser ? 
          allActiveOrders.filter(order => isNotificationRelevantForUser(order, currentUser)) : 
          [];

        // Comparar con pedidos previos
        const lastOrders = await AsyncStorage.getItem('lastActiveOrders');
        if (lastOrders) {
          const previousOrders = JSON.parse(lastOrders);
          
          // FIX: Buscar cambios de estado solo en pedidos relevantes para el usuario
          currentActiveOrders.forEach(currentOrder => {
            const previousOrder = previousOrders.find(prev => prev._id === currentOrder._id);
            
            if (previousOrder && previousOrder.status !== currentOrder.status) {
              // FIX: Verificar nuevamente que la notificación es relevante antes de mostrar
              if (isNotificationRelevantForUser(currentOrder, currentUser)) {
                console.log(`📬 Mostrando notificación para usuario ${currentUser.role}: Pedido ${currentOrder._id} cambió de ${previousOrder.status} a ${currentOrder.status}`);
                showOrderUpdateNotification(currentOrder, previousOrder.status);
              } else {
                console.log(`🚫 Notificación filtrada para usuario ${currentUser?.role}: Pedido ${currentOrder._id} no es relevante`);
              }
            }
          });
        }

        // Actualizar estado y storage
        setActiveOrders(currentActiveOrders);
        await AsyncStorage.setItem('lastActiveOrders', JSON.stringify(currentActiveOrders));
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('OrderStatusNotifier - Error checking order updates:', error.message);
      }
    }
  }, [currentUser, isNotificationRelevantForUser, showOrderUpdateNotification]); // FIX: Include user dependencies


  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      
      // Inicializar servicio de notificaciones una sola vez
      NotificationService.initialize();
      
      // FIX: Cargar usuario actual primero, luego pedidos
      loadCurrentUser().then(() => {
        loadActiveOrders();
        
        // Configurar intervalo con funciones estables
        intervalRef.current = setInterval(() => {
          checkOrderUpdates();
        }, 30000);
      });
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [loadCurrentUser, loadActiveOrders, checkOrderUpdates]); // FIX: Include all dependencies


  const showOrderUpdateNotification = useCallback((order, previousStatus) => {
    // FIX: Solo mostrar notificaciones si el usuario está cargado y la notificación es relevante
    if (!currentUser || !isNotificationRelevantForUser(order, currentUser)) {
      console.log('🚫 Notificación bloqueada: usuario no cargado o pedido no relevante');
      return;
    }

    const notification = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      newStatus: order.status,
      previousStatus: previousStatus,
      message: getStatusMessage(order.status),
      merchantName: order.merchantId?.name || order.merchantId?.business?.businessName || 'Comerciante'
    };

    console.log(`📬 Mostrando notificación para ${currentUser.role}: ${notification.message}`);

    setLastNotification(notification);
    setShowNotification(true);

    // Enviar notificación local también
    NotificationService.sendLocalNotification({
      channelId: 'rapigoo-orders',
      title: `Pedido #${order.orderNumber}`,
      message: notification.message,
      data: {
        type: 'order_update',
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status
      }
    });

    // Animar entrada
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
      hideNotification();
    }, 5000);
  }, [currentUser, isNotificationRelevantForUser, slideAnim]); // FIX: Include user dependencies

  const getStatusMessage = (status) => {
    const messages = {
      pending: 'Tu pedido ha sido recibido y está siendo revisado',
      confirmed: '¡Tu pedido ha sido confirmado! Se está preparando',
      preparing: 'Tu pedido se está preparando en este momento',
      ready: '¡Tu pedido está listo! Buscando delivery',
      assigned: 'Se asignó un delivery a tu pedido',
      picked_up: 'El delivery recogió tu pedido y está en camino',
      in_transit: 'Tu pedido está en camino hacia ti',
      heading_to_pickup: 'El delivery se dirige al comercio',
      heading_to_delivery: 'El delivery está en camino hacia ti',
      delivered: '¡Tu pedido ha sido entregado!',
      cancelled: 'Tu pedido ha sido cancelado'
    };
    return messages[status] || 'Tu pedido ha sido actualizado';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#FF9800',
      confirmed: '#4CAF50', 
      preparing: '#2196F3',
      ready: '#FF6B6B',
      assigned: '#9C27B0',
      picked_up: '#FF9800',
      in_transit: '#4CAF50',
      heading_to_pickup: '#9C27B0',
      heading_to_delivery: '#4CAF50',
      delivered: '#4CAF50',
      cancelled: '#F44336'
    };
    return colors[status] || '#666';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: 'time-outline',
      confirmed: 'checkmark-circle-outline',
      preparing: 'restaurant-outline',
      ready: 'cube-outline',
      assigned: 'bicycle-outline',
      picked_up: 'bag-outline',
      in_transit: 'car-outline',
      heading_to_pickup: 'bicycle-outline',
      heading_to_delivery: 'car-outline',
      delivered: 'home-outline',
      cancelled: 'close-circle-outline'
    };
    return icons[status] || 'help-outline';
  };

  const hideNotification = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowNotification(false);
      setLastNotification(null);
    });
  };

  const handleNotificationPress = () => {
    if (lastNotification) {
      navigation.navigate('OrderTracking', {
        orderId: lastNotification.orderId,
        orderNumber: lastNotification.orderNumber
      });
      hideNotification();
    }
  };

  // FIX: No mostrar componente si no hay usuario cargado o si no hay notificaciones
  if (!currentUser || !showNotification || !lastNotification) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.notificationContainer,
        { 
          transform: [{ translateY: slideAnim }],
          backgroundColor: getStatusColor(lastNotification.newStatus)
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.notificationContent}
        onPress={handleNotificationPress}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Ionicons 
            name={getStatusIcon(lastNotification.newStatus)} 
            size={24} 
            color="#fff" 
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.notificationTitle}>
            Pedido #{lastNotification.orderNumber}
          </Text>
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {lastNotification.message}
          </Text>
          <Text style={styles.merchantName}>
            {lastNotification.merchantName}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={hideNotification}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  notificationContainer: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    borderRadius: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 9999,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
    lineHeight: 18,
  },
  merchantName: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default OrderStatusNotifier;