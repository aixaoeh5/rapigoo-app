import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons as Icon } from '@expo/vector-icons';
import apiClient from '../api/apiClient';

// Configuraciones de estados
const ORDER_STATES = {
  pending: { title: 'Pendiente', color: '#FFA500', icon: 'time-outline', bg: '#FFF3E0' },
  confirmed: { title: 'Confirmado', color: '#4CAF50', icon: 'checkmark-circle-outline', bg: '#E8F5E8' },
  preparing: { title: 'Preparando', color: '#2196F3', icon: 'restaurant-outline', bg: '#E3F2FD' },
  ready: { title: 'Listo', color: '#FF9800', icon: 'cube-outline', bg: '#FFF8E1' },
  assigned: { title: 'Asignado', color: '#9C27B0', icon: 'bicycle-outline', bg: '#F3E5F5' },
  picked_up: { title: 'Recogido', color: '#FF9800', icon: 'bag-outline', bg: '#FFF8E1' },
  in_transit: { title: 'En camino', color: '#4CAF50', icon: 'car-outline', bg: '#E8F5E8' },
  delivered: { title: 'Entregado', color: '#4CAF50', icon: 'checkmark-done-outline', bg: '#E8F5E8' },
  completed: { title: 'Completado', color: '#4CAF50', icon: 'checkmark-done-outline', bg: '#E8F5E8' },
  cancelled: { title: 'Cancelado', color: '#F44336', icon: 'close-circle-outline', bg: '#FFEBEE' }
};

const HistorialPedidosScreen = () => {
  const navigation = useNavigation();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadOrders();
  }, [selectedFilter]);

  const loadOrders = async () => {
    try {
      const params = {
        limit: 50,
        ...(selectedFilter !== 'all' && { status: selectedFilter })
      };

      const response = await apiClient.get('/orders', { params });

      console.log('📋 Respuesta completa del servidor:', response.data);
      
      if (response.data.success) {
        // Intentar múltiples formas de extraer los pedidos de la respuesta
        let ordersData = [];
        
        if (response.data.data?.orders && Array.isArray(response.data.data.orders)) {
          ordersData = response.data.data.orders;
        } else if (response.data.orders && Array.isArray(response.data.orders)) {
          ordersData = response.data.orders;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          ordersData = response.data.data;
        }
        
        console.log('📋 Pedidos extraídos:', ordersData);
        setOrders(ordersData);
      } else {
        // Respuesta no exitosa del servidor
        console.warn('Respuesta no exitosa:', response.data);
        setOrders([]);
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error);
      
      // Analizar tipo de error
      const isNotFound = error.response?.status === 404;
      const isNetworkError = !error.response;
      const isServerError = error.response?.status >= 500;
      
      // Solo mostrar error si es grave (no mostrar para 404 o errores de red)
      if (!isNotFound && !isNetworkError && isServerError) {
        Alert.alert('Error', 'Error del servidor al cargar pedidos. Intenta de nuevo.');
      } else if (isNetworkError) {
        console.log('🌐 Error de conexión al cargar pedidos');
      } else if (isNotFound) {
        console.log('🔍 No se encontraron pedidos');
      }
      
      // En caso de error, asegurar que orders esté vacío
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleOrderPress = (order) => {
    navigation.navigate('OrderTracking', { 
      orderId: order._id,
      orderNumber: order.orderNumber 
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeSince = (dateString) => {
    const now = new Date();
    const orderDate = new Date(dateString);
    const diffDays = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return formatDate(dateString);
  };

  const renderFilterButton = (filter, title) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.filterButtonActive
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === filter && styles.filterButtonTextActive
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderOrderItem = ({ item }) => {
    const stateConfig = ORDER_STATES[item.status] || {
      title: 'Desconocido',
      color: '#666',
      icon: 'help-outline',
      bg: '#f5f5f5'
    };
    const totalItems = item.items?.reduce((sum, orderItem) => sum + (orderItem.quantity || 0), 0) || 0;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => handleOrderPress(item)}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
            <Text style={styles.merchantName}>
              {item.merchantId?.name || item.merchantId?.business?.businessName || 'Comerciante'}
            </Text>
          </View>
          <View style={styles.orderMeta}>
            <Text style={styles.orderDate}>{getTimeSince(item.createdAt)}</Text>
            <Text style={styles.orderTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <Text style={styles.itemsCount}>
            {totalItems} item{totalItems > 1 ? 's' : ''} • ${(item.total || 0).toFixed(2)}
          </Text>
          <Text style={styles.paymentMethod}>
            {item.paymentInfo?.method === 'cash' ? '💵 Efectivo' : 
             item.paymentInfo?.method === 'card' ? '💳 Tarjeta' : 
             '🏦 Transferencia'}
          </Text>
        </View>

        <View style={styles.orderStatus}>
          <View style={[styles.statusBadge, { backgroundColor: stateConfig.bg }]}>
            <Icon name={stateConfig.icon} size={16} color={stateConfig.color} />
            <Text style={[styles.statusText, { color: stateConfig.color }]}>
              {stateConfig.title}
            </Text>
          </View>
          <Icon name="chevron-forward" size={20} color="#ccc" />
        </View>

        {/* Mostrar algunos items del pedido */}
        <View style={styles.itemsPreview}>
          {item.items.slice(0, 2).map((orderItem, index) => (
            <Text key={index} style={styles.itemPreview} numberOfLines={1}>
              {orderItem.quantity}x {orderItem.name || orderItem.serviceName}
            </Text>
          ))}
          {item.items.length > 2 && (
            <Text style={styles.moreItems}>
              +{item.items.length - 2} más
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Cargando pedidos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Pedidos</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon name="refresh-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        {renderFilterButton('all', 'Todos')}
        {renderFilterButton('pending', 'Pendientes')}
        {renderFilterButton('preparing', 'Preparando')}
        {renderFilterButton('completed', 'Completados')}
        {renderFilterButton('cancelled', 'Cancelados')}
      </View>

      {/* Lista de pedidos */}
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        renderItem={renderOrderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="receipt-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>Sin pedidos aún</Text>
            <Text style={styles.emptyMessage}>
              Tus pedidos aparecerán aquí una vez que hagas tu primera compra
            </Text>
            <TouchableOpacity 
              style={styles.shopButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.shopButtonText}>Comenzar a comprar</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Leyenda */}
      {orders.length > 0 && (
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Estados:</Text>
          <View style={styles.legendGrid}>
            {Object.entries(ORDER_STATES).map(([key, config]) => (
              <View key={key} style={styles.legendItem}>
                <Icon name={config.icon} size={14} color={config.color} />
                <Text style={styles.legendText}>{config.title}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  filterButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  merchantName: {
    fontSize: 16,
    color: '#FF6B6B',
    marginTop: 2,
  },
  orderMeta: {
    alignItems: 'flex-end',
  },
  orderDate: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  orderTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentMethod: {
    fontSize: 14,
    color: '#666',
  },
  orderStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  itemsPreview: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  itemPreview: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  moreItems: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  shopButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  legendContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
});

export default HistorialPedidosScreen;