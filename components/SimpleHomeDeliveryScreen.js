import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import apiClient from '../api/apiClient';
import SafeAreaView from './shared/SafeAreaView';

const SimpleHomeDeliveryScreen = () => {
  const navigation = useNavigation();
  
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);

  // Función para traducir estados de delivery
  const translateDeliveryStatus = (status) => {
    const statusTranslations = {
      'assigned': 'Asignado',
      'heading_to_pickup': 'Yendo a recoger',
      'at_pickup': 'En el comercio',
      'picked_up': 'Pedido recogido',
      'heading_to_delivery': 'En camino al cliente',
      'at_delivery': 'En destino',
      'delivered': 'Entregado',
      'cancelled': 'Cancelado'
    };
    return statusTranslations[status] || status;
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('📡 Cargando datos del dashboard...');
      
      // Cargar pedidos disponibles
      try {
        const ordersResponse = await apiClient.get('/delivery/orders/available');
        console.log('📦 Pedidos disponibles:', ordersResponse.data);
        if (ordersResponse.data.success) {
          setAvailableOrders(ordersResponse.data.orders || []);
        }
      } catch (error) {
        console.error('❌ Error cargando pedidos:', error.message);
        setAvailableOrders([]);
      }

      // Cargar deliveries activos
      try {
        const activeResponse = await apiClient.get('/delivery/active');
        console.log('🚚 Deliveries activos:', activeResponse.data);
        if (activeResponse.data.success) {
          setActiveDeliveries(activeResponse.data.data?.deliveries || []);
        }
      } catch (error) {
        console.error('❌ Error cargando activos:', error.message);
        setActiveDeliveries([]);
      }

    } catch (error) {
      console.error('❌ Error general:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleAvailability = async (value) => {
    try {
      const response = await apiClient.put('/delivery/availability', {
        isAvailable: value
      });
      
      if (response.data.success) {
        setIsAvailable(value);
        if (value) {
          loadData();
        }
      }
    } catch (error) {
      console.error('Error cambiando disponibilidad:', error);
      Alert.alert('Error', 'No se pudo cambiar tu disponibilidad');
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      Alert.alert(
        'Aceptar Pedido',
        '¿Confirmas que quieres aceptar este pedido?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Aceptar',
            onPress: async () => {
              try {
                const response = await apiClient.post(`/delivery/orders/${orderId}/accept`);
                
                if (response.data.success) {
                  Alert.alert('✅ Éxito', 'Pedido aceptado correctamente');
                  loadData(); // Recargar datos
                } else {
                  Alert.alert('Error', 'No se pudo aceptar el pedido');
                }
              } catch (error) {
                console.error('Error aceptando pedido:', error);
                Alert.alert('Error', 'Error al aceptar el pedido');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error en handleAcceptOrder:', error);
    }
  };

  const navigateToDelivery = (delivery) => {
    const orderIdValue = typeof delivery.orderId === 'object' ? 
      delivery.orderId._id : delivery.orderId;
    
    if (!orderIdValue) {
      Alert.alert('Error', 'Datos de delivery inválidos');
      return;
    }

    navigation.navigate('DeliveryNavigation', {
      trackingId: delivery._id,
      orderId: orderIdValue,
      deliveryTracking: delivery
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E60023" />
        <Text style={styles.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.titleContainer}
          onLongPress={() => {
            // Acceso discreto a herramientas de desarrollo
            navigation.navigate('TestMap');
          }}
        >
          <Text style={styles.title}>Dashboard Delivery</Text>
        </TouchableOpacity>
        <View style={styles.availabilityContainer}>
          <Text style={styles.availabilityLabel}>
            {isAvailable ? 'Disponible' : 'No disponible'}
          </Text>
          <Switch
            value={isAvailable}
            onValueChange={toggleAvailability}
            trackColor={{ false: '#CCC', true: '#E60023' }}
            thumbColor={isAvailable ? '#FFF' : '#FFF'}
          />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Deliveries Activos */}
        {activeDeliveries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deliveries Activos ({activeDeliveries.length})</Text>
            {activeDeliveries.map((delivery, index) => (
              <TouchableOpacity
                key={delivery._id || index}
                style={styles.card}
                onPress={() => navigateToDelivery(delivery)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    #{delivery.orderId?.orderNumber || 'Sin número'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: '#E60023' }]}>
                    <Text style={styles.statusText}>{translateDeliveryStatus(delivery.status)}</Text>
                  </View>
                </View>
                <Text style={styles.cardSubtitle}>
                  <Icon name="storefront" size={14} color="#666" />
                  <Text> {delivery.orderId?.merchantId?.business?.businessName || delivery.orderId?.merchantId?.name || 'Comerciante'}</Text>
                </Text>
                <Text style={styles.customerInfo}>
                  <Icon name="person" size={14} color="#666" />
                  <Text> {delivery.orderId?.customerId?.name || 'Cliente'}</Text>
                </Text>
                <View style={styles.cardFooter}>
                  <Icon name="navigation" size={16} color="#E60023" />
                  <Text style={styles.cardAction}>Toca para continuar</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pedidos Disponibles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pedidos Disponibles ({availableOrders.length})
          </Text>
          
          {!isAvailable && (
            <View style={styles.unavailableMessage}>
              <Icon name="pause-circle-outline" size={24} color="#FF9800" />
              <Text style={styles.unavailableText}>
                Activa tu disponibilidad para ver pedidos
              </Text>
            </View>
          )}

          {isAvailable && availableOrders.length === 0 && (
            <View style={styles.emptyState}>
              <Icon name="time-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>No hay pedidos disponibles</Text>
              <Text style={styles.emptySubtext}>Te notificaremos cuando haya nuevos pedidos</Text>
            </View>
          )}

          {isAvailable && availableOrders.length > 0 && (
            <>
              {availableOrders.map((order, index) => (
                <View key={order._id || index} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>#{order.orderNumber}</Text>
                    <Text style={styles.amount}>RD${order.total}</Text>
                  </View>
                  <Text style={styles.cardSubtitle}>
                    {order.merchantInfo?.name || 'Comerciante'}
                  </Text>
                  <Text style={styles.description} numberOfLines={2}>
                    Entregar en: {order.deliveryInfo?.address?.street || 'Dirección no disponible'}
                  </Text>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptOrder(order._id)}
                  >
                    <Icon name="checkmark" size={20} color="#FFF" />
                    <Text style={styles.acceptText}>Aceptar Pedido</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>

        {/* Acciones principales */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
            onPress={() => navigation.navigate('DeliveryHistory')}
          >
            <Icon name="list" size={20} color="#FFF" />
            <Text style={styles.actionText}>Historial</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Icon name="person" size={20} color="#FFF" />
            <Text style={styles.actionText}>Perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Acciones adicionales */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Icon name="settings" size={20} color="#FFF" />
            <Text style={styles.actionText}>Configuración</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#9C27B0' }]}
            onPress={() => navigation.navigate('Help')}
          >
            <Icon name="help-circle" size={20} color="#FFF" />
            <Text style={styles.actionText}>Ayuda</Text>
          </TouchableOpacity>
        </View>

        {/* Estadísticas del día */}
        <View style={styles.statsSection}>
          <Text style={styles.statsSectionTitle}>Estadísticas de Hoy</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Icon name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.statNumber}>{activeDeliveries.filter(d => d.status === 'completed').length}</Text>
              <Text style={styles.statLabel}>Completados</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="time" size={24} color="#FF9800" />
              <Text style={styles.statNumber}>{activeDeliveries.filter(d => d.status !== 'completed').length}</Text>
              <Text style={styles.statLabel}>En Proceso</Text>
            </View>

            <View style={styles.statCard}>
              <Icon name="cash" size={24} color="#E60023" />
              <Text style={styles.statNumber}>RD$0</Text>
              <Text style={styles.statLabel}>Ganado</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  availabilityContainer: {
    alignItems: 'center',
  },
  availabilityLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E60023',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardAction: {
    marginLeft: 8,
    fontSize: 14,
    color: '#E60023',
    fontWeight: '500',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E60023',
    paddingVertical: 12,
    borderRadius: 8,
  },
  acceptText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#FFF',
    fontWeight: '500',
  },
  unavailableMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  unavailableText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#FF9800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  actionsSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  actionText: {
    marginLeft: 8,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statsSection: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default SimpleHomeDeliveryScreen;