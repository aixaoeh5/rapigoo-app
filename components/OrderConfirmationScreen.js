import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { apiClient } from '../api/apiClient';

const OrderConfirmationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderNumber, orderId } = route.params;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    } else {
      // Si solo tenemos el número de orden, mostrar confirmación básica
      setLoading(false);
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      const response = await apiClient.get(`/orders/${orderId}`);
      if (response.data.success) {
        setOrder(response.data.order);
      }
    } catch (error) {
      console.error('Error al cargar detalles del pedido:', error);
      // No mostrar error, la pantalla funcionará sin detalles completos
    } finally {
      setLoading(false);
    }
  };

  const handleContinueShopping = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }]
    });
  };

  const handleViewOrders = () => {
    navigation.reset({
      index: 0,
      routes: [
        { name: 'Home' },
        { name: 'HistorialPedidos' }
      ]
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#FFA500';
      case 'confirmed': return '#4CAF50';
      case 'preparing': return '#2196F3';
      case 'ready': return '#FF9800';
      case 'completed': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmado';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Listo';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Cargando detalles...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header de confirmación */}
      <View style={styles.successHeader}>
        <View style={styles.successIconContainer}>
          <Icon name="checkmark-circle" size={80} color="#4CAF50" />
        </View>
        <Text style={styles.successTitle}>¡Pedido confirmado!</Text>
        <Text style={styles.orderNumber}>#{orderNumber}</Text>
        <Text style={styles.successMessage}>
          Tu pedido ha sido enviado al comerciante y será procesado pronto.
        </Text>
      </View>

      {/* Detalles del pedido */}
      {order && (
        <View style={styles.orderDetails}>
          {/* Estado actual */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Estado del pedido</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                {getStatusText(order.status)}
              </Text>
            </View>
          </View>

          {/* Información del comerciante */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Comerciante</Text>
            <Text style={styles.merchantName}>{order.merchantName}</Text>
            {order.merchantId?.address && (
              <Text style={styles.merchantAddress}>
                {typeof order.merchantId.address === 'string' 
                  ? order.merchantId.address 
                  : order.merchantId.address?.street || 'Dirección no disponible'
                }
              </Text>
            )}
            {order.merchantId?.phone && (
              <Text style={styles.merchantPhone}>📞 {order.merchantId.phone}</Text>
            )}
          </View>

          {/* Items del pedido */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tu pedido</Text>
            {order.items.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                <Text style={styles.itemName}>{item.serviceName}</Text>
                <Text style={styles.itemPrice}>${(item.totalPrice || 0).toFixed(2)}</Text>
              </View>
            ))}
            
            <View style={styles.divider} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${(order.total || 0).toFixed(2)}</Text>
            </View>
          </View>

          {/* Información de entrega */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Entrega</Text>
            <Text style={styles.deliveryAddress}>
              📍 {typeof order.deliveryInfo.address === 'string' 
                ? order.deliveryInfo.address 
                : order.deliveryInfo.address?.street || 'Dirección no disponible'
              }
            </Text>
            {order.deliveryInfo.instructions && (
              <Text style={styles.deliveryInstructions}>
                📝 {order.deliveryInfo.instructions}
              </Text>
            )}
            <Text style={styles.paymentMethod}>
              💳 {order.paymentMethod === 'cash' ? 'Efectivo' : order.paymentMethod === 'card' ? 'Tarjeta de crédito (Prueba)' : order.paymentMethod || 'Efectivo'}
            </Text>
          </View>

          {/* Tiempo estimado */}
          {order.estimatedDeliveryTime && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tiempo estimado</Text>
              <Text style={styles.estimatedTime}>
                🕒 {new Date(order.estimatedDeliveryTime).toLocaleTimeString('es', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
              <Text style={styles.estimatedNote}>
                Aproximadamente {order.preparationTime + 20} minutos
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Mensaje informativo */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>¿Qué sigue?</Text>
        <Text style={styles.infoText}>
          1. El comerciante confirmará tu pedido
        </Text>
        <Text style={styles.infoText}>
          2. Comenzará a preparar tu pedido
        </Text>
        <Text style={styles.infoText}>
          3. Te notificaremos cuando esté listo
        </Text>
        <Text style={styles.infoText}>
          4. Recibirás tu pedido en la dirección indicada
        </Text>
      </View>

      {/* Botones de acción */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleViewOrders}
        >
          <Text style={styles.secondaryButtonText}>Ver mis pedidos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleContinueShopping}
        >
          <Text style={styles.primaryButtonText}>Continuar comprando</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  successHeader: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#f8fff8',
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  successMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  orderDetails: {
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statusSection: {
    marginBottom: 25,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  merchantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  merchantAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  merchantPhone: {
    fontSize: 14,
    color: '#666',
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    width: 40,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 15,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  deliveryAddress: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  deliveryInstructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  paymentMethod: {
    fontSize: 14,
    color: '#666',
  },
  estimatedTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  estimatedNote: {
    fontSize: 14,
    color: '#666',
  },
  infoSection: {
    margin: 20,
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    lineHeight: 22,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    gap: 15,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 30,
  },
});

export default OrderConfirmationScreen;