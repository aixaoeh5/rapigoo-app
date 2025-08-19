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
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const intervalRef = useRef(null);
  const isInitialized = useRef(false);

  // FIX: Stable functions using useCallback with MINIMAL dependencies
  const showOrderUpdateNotification = useCallback((order, previousStatus) => {
    const notification = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      newStatus: order.status,
      previousStatus: previousStatus,
      message: getStatusMessage(order.status),
      merchantName: order.merchantId?.name || order.merchantId?.business?.businessName || 'Comerciante'
    };

    // FIX: Use functional setState to avoid dependency on setter functions
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
  }, [slideAnim]); // FIX: ONLY slideAnim as dependency (stable ref)

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
        
        const activeOrdersList = ordersArray.filter(order => 
          order && 
          order.status && 
          ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit', 'heading_to_pickup', 'heading_to_delivery'].includes(order.status)
        );
        
        setActiveOrders(activeOrdersList);
        
        // Guardar en AsyncStorage para comparación posterior
        await AsyncStorage.setItem('lastActiveOrders', JSON.stringify(activeOrdersList));
      }
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error('OrderStatusNotifier - Error loading active orders:', error.message);
      }
      setActiveOrders([]);
    }
  }, []); // FIX: Empty dependencies - function doesn't depend on external state

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
        
        const currentActiveOrders = ordersArray.filter(order => 
          order && 
          order.status && 
          ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit', 'heading_to_pickup', 'heading_to_delivery'].includes(order.status)
        );

        // Comparar con pedidos previos
        const lastOrders = await AsyncStorage.getItem('lastActiveOrders');
        if (lastOrders) {
          const previousOrders = JSON.parse(lastOrders);
          
          // Buscar cambios de estado
          currentActiveOrders.forEach(currentOrder => {
            const previousOrder = previousOrders.find(prev => prev._id === currentOrder._id);
            
            if (previousOrder && previousOrder.status !== currentOrder.status) {
              showOrderUpdateNotification(currentOrder, previousOrder.status);
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
  }, [showOrderUpdateNotification]); // FIX: Only include the stable callback

  // FIX: Move initialization to useEffect with empty dependency array
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      
      // Inicializar servicio de notificaciones una sola vez
      NotificationService.initialize();
      
      // Cargar pedidos activos
      loadActiveOrders();
      
      // Configurar intervalo
      intervalRef.current = setInterval(() => {
        checkOrderUpdates();
      }, 30000);
    }

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [loadActiveOrders, checkOrderUpdates]); // FIX: Now dependencies are stable

  // FIX: Extract static functions outside component or use useCallback with empty deps
  const getStatusMessage = useCallback((status) => {
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
  }, []);

  const getStatusColor = useCallback((status) => {
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
  }, []);

  const getStatusIcon = useCallback((status) => {
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
  }, []);

  const hideNotification = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowNotification(false);
      setLastNotification(null);
    });
  }, [slideAnim]);

  const handleNotificationPress = useCallback(() => {
    if (lastNotification) {
      navigation.navigate('OrderTracking', {
        orderId: lastNotification.orderId,
        orderNumber: lastNotification.orderNumber
      });
      hideNotification();
    }
  }, [lastNotification, navigation, hideNotification]);

  if (!showNotification || !lastNotification) {
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