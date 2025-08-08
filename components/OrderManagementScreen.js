import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { apiClient } from '../api/apiClient';

// Estados y sus configuraciones
const ORDER_STATES = {
  pending: { title: 'Pendiente', color: '#FFA500', icon: 'time-outline' },
  confirmed: { title: 'Confirmado', color: '#4CAF50', icon: 'checkmark-circle-outline' },
  preparing: { title: 'Preparando', color: '#2196F3', icon: 'restaurant-outline' },
  ready: { title: 'Listo', color: '#FF9800', icon: 'cube-outline' },
  completed: { title: 'Completado', color: '#4CAF50', icon: 'checkmark-done-outline' },
  cancelled: { title: 'Cancelado', color: '#F44336', icon: 'close-circle-outline' }
};

const OrderManagementScreen = () => {
  const navigation = useNavigation();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('pending');
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    loadOrders();
  }, [selectedFilter]);

  const loadOrders = async () => {
    try {
      const response = await apiClient.get('/orders/merchant/list', {
        params: {
          status: selectedFilter === 'all' ? undefined : selectedFilter,
          limit: 50
        }
      });

      if (response.data.success) {
        setOrders(response.data.orders);
      } else {
        Alert.alert('Error', 'No se pudieron cargar los pedidos');
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let errorMessage = 'Error al cargar pedidos';
      if (error.response?.status === 403) {
        errorMessage = 'No tienes permisos para ver pedidos';
      } else if (error.response?.status === 500) {
        errorMessage = 'Error del servidor. ¿Está el backend corriendo?';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Error de conexión. Verifica que el backend esté corriendo';
      }
      
      Alert.alert('Error', errorMessage);
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
    setSelectedOrder(order);
    setActionModalVisible(true);
  };

  const getAvailableActions = (status) => {
    const actions = {
      pending: [
        { action: 'confirmed', title: 'Confirmar pedido', color: '#4CAF50', icon: 'checkmark' },
        { action: 'cancelled', title: 'Cancelar', color: '#F44336', icon: 'close' }
      ],
      confirmed: [
        { action: 'preparing', title: 'Empezar a preparar', color: '#2196F3', icon: 'restaurant' },
        { action: 'cancelled', title: 'Cancelar', color: '#F44336', icon: 'close' }
      ],
      preparing: [
        { action: 'ready', title: 'Marcar como listo', color: '#FF9800', icon: 'cube' },
        { action: 'cancelled', title: 'Cancelar', color: '#F44336', icon: 'close' }
      ],
      ready: [
        { action: 'completed', title: 'Marcar como entregado', color: '#4CAF50', icon: 'checkmark-done' }
      ]
    };
    
    return actions[status] || [];
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedOrder) return;

    try {
      const response = await apiClient.put(`/orders/${selectedOrder._id}/status`, {
        status: newStatus
      });

      if (response.data.success) {
        Alert.alert('Éxito', 'Estado del pedido actualizado');
        setActionModalVisible(false);
        setSelectedOrder(null);
        loadOrders(); // Recargar pedidos
      } else {
        Alert.alert('Error', response.data.error);
      }
    } catch (error) {
      console.error('❌ Error actualizando estado:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error message:', error.message);
      
      let errorMessage = 'No se pudo actualizar el estado del pedido';
      
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.status === 500) {
        errorMessage = 'Error interno del servidor. Verifica que el backend esté funcionando';
      } else if (error.response?.status === 403) {
        errorMessage = 'No tienes permisos para actualizar este pedido';
      } else if (error.response?.status === 404) {
        errorMessage = 'Pedido no encontrado';
      } else if (error.message?.includes('Network Error')) {
        errorMessage = 'Error de conexión. Verifica que el backend esté corriendo';
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es', {
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getTimeSinceOrder = (createdAt) => {
    const now = new Date();
    const orderTime = new Date(createdAt);
    const diffMinutes = Math.floor((now - orderTime) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours}h ${diffMinutes % 60}min`;
    }
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
    const stateConfig = ORDER_STATES[item.status] || { title: 'Desconocido', color: '#666', icon: 'help-outline' };
    const totalItems = item.items?.reduce((sum, orderItem) => sum + (orderItem.quantity || 0), 0) || 0;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => handleOrderPress(item)}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
            <Text style={styles.orderTime}>
              {formatDate(item.createdAt)} • {formatTime(item.createdAt)}
            </Text>
          </View>
          <View style={styles.orderHeaderRight}>
            <View style={[styles.statusBadge, { backgroundColor: stateConfig.color }]}>
              <Icon name={stateConfig.icon} size={12} color="#fff" />
              <Text style={styles.statusText}>{stateConfig.title}</Text>
            </View>
            <Text style={styles.timeSince}>{getTimeSinceOrder(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>👤 {item.customerInfo?.name || 'Cliente'}</Text>
          <Text style={styles.customerPhone}>📞 {item.customerInfo?.phone || 'N/A'}</Text>
        </View>

        <View style={styles.orderDetails}>
          <Text style={styles.itemsCount}>{totalItems} items • ${(item.total || 0).toFixed(2)}</Text>
          <Text style={styles.paymentMethod}>
            {item.paymentMethod === 'cash' ? '💵 Efectivo' : '🏦 Transferencia'}
          </Text>
        </View>

        <Text style={styles.deliveryAddress} numberOfLines={1}>
          📍 {typeof item.deliveryInfo?.address === 'string' 
            ? item.deliveryInfo.address 
            : item.deliveryInfo?.address?.street 
              ? `${item.deliveryInfo.address.street}, ${item.deliveryInfo.address.city}` 
              : 'Dirección no disponible'}
        </Text>

        {item.deliveryInfo?.instructions && (
          <Text style={styles.instructions} numberOfLines={2}>
            📝 {item.deliveryInfo.instructions}
          </Text>
        )}
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
        <Text style={styles.headerTitle}>Gestión de Pedidos</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Icon name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {renderFilterButton('pending', 'Pendientes')}
        {renderFilterButton('confirmed', 'Confirmados')}
        {renderFilterButton('preparing', 'Preparando')}
        {renderFilterButton('ready', 'Listos')}
        {renderFilterButton('completed', 'Completados')}
        {renderFilterButton('all', 'Todos')}
      </ScrollView>

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
            <Text style={styles.emptyTitle}>No hay pedidos</Text>
            <Text style={styles.emptyMessage}>
              Los pedidos aparecerán aquí cuando los recibas
            </Text>
          </View>
        }
      />

      {/* Modal de acciones */}
      <Modal
        visible={actionModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrder && (
              <>
                <Text style={styles.modalTitle}>
                  Pedido #{selectedOrder.orderNumber}
                </Text>
                
                <View style={styles.orderSummary}>
                  <Text style={styles.summaryText}>
                    Cliente: {selectedOrder.customerInfo?.name || 'Cliente'}
                  </Text>
                  <Text style={styles.summaryText}>
                    Total: ${(selectedOrder.total || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.summaryText}>
                    Estado actual: {ORDER_STATES[selectedOrder.status]?.title || selectedOrder.status}
                  </Text>
                </View>

                <Text style={styles.actionsTitle}>Acciones disponibles:</Text>
                
                {getAvailableActions(selectedOrder.status).map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.actionButton, { borderColor: action.color }]}
                    onPress={() => handleStatusUpdate(action.action)}
                  >
                    <Icon name={action.icon} size={20} color={action.color} />
                    <Text style={[styles.actionButtonText, { color: action.color }]}>
                      {action.title}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setActionModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Navegación de comerciante */}
      <View style={styles.merchantBottomBar}>
        <TouchableOpacity 
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('HomeComerciante')}
        >
          <Icon name="home-outline" size={24} color="#666" />
          <Text style={styles.bottomBarText}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('OrderManagement')}
        >
          <Icon name="receipt" size={24} color="#FF6B6B" />
          <Text style={[styles.bottomBarText, { color: '#FF6B6B' }]}>Pedidos</Text>
          {orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).length > 0 && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>
                {orders.filter(o => ['pending', 'preparing', 'ready'].includes(o.status)).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('Services')}
        >
          <Icon name="restaurant-outline" size={24} color="#666" />
          <Text style={styles.bottomBarText}>Servicios</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('ProfileMerchant')}
        >
          <Icon name="person-outline" size={24} color="#666" />
          <Text style={styles.bottomBarText}>Perfil</Text>
        </TouchableOpacity>
      </View>
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
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filtersContent: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 20,
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
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  orderTime: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  timeSince: {
    fontSize: 12,
    color: '#999',
  },
  customerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  customerPhone: {
    fontSize: 14,
    color: '#666',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  paymentMethod: {
    fontSize: 14,
    color: '#666',
  },
  deliveryAddress: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  instructions: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  orderSummary: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  summaryText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  merchantBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 5,
  },
  bottomBarText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  navBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  navBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default OrderManagementScreen;