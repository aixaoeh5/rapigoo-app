import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import apiClient from '../api/apiClient';
import ErrorInterceptor from '../utils/ErrorInterceptor';

// Configuraciones de estados para deliveries
const DELIVERY_STATES = {
  assigned: { title: 'Asignado', color: '#9C27B0', icon: 'bicycle-outline', bg: '#F3E5F5' },
  heading_to_pickup: { title: 'Yendo a recoger', color: '#2196F3', icon: 'arrow-forward-outline', bg: '#E3F2FD' },
  at_pickup: { title: 'En recogida', color: '#FF9800', icon: 'location-outline', bg: '#FFF8E1' },
  picked_up: { title: 'Recogido', color: '#3F51B5', icon: 'bag-outline', bg: '#E8EAF6' },
  heading_to_delivery: { title: 'En camino', color: '#2196F3', icon: 'car-outline', bg: '#E3F2FD' },
  at_delivery: { title: 'Entregando', color: '#4CAF50', icon: 'home-outline', bg: '#E8F5E8' },
  delivered: { title: 'Entregado', color: '#4CAF50', icon: 'checkmark-done-outline', bg: '#E8F5E8' },
  cancelled: { title: 'Cancelado', color: '#F44336', icon: 'close-circle-outline', bg: '#FFEBEE' }
};

const DeliveryHistoryScreen = ({ route }) => {
  console.log('🔍 DeliveryHistoryScreen mounting with route:', route);
  ErrorInterceptor.logObjectAccess(route, 'params', 'DeliveryHistoryScreen-mount');
  
  const navigation = useNavigation();
  
  // Safe extraction of navigation params to prevent undefined object conversion
  const params = ErrorInterceptor.safeObjectDestructure(route?.params, {}, 'DeliveryHistoryScreen-params');
  const deliveryId = params.deliveryId;
  const preloadedDelivery = params.delivery;
  
  // Validate preloaded delivery if provided
  if (preloadedDelivery && (!preloadedDelivery._id || typeof preloadedDelivery !== 'object')) {
    console.warn('⚠️ Invalid delivery object passed via navigation:', preloadedDelivery);
  }
  
  // Estados principales
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showDeliveryDetail, setShowDeliveryDetail] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  
  // Datos - Con inicialización defensiva
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [historyDeliveries, setHistoryDeliveries] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    hasMore: true
  });

  // Debug state changes
  useEffect(() => {
    console.log('🔍 State change - activeDeliveries:', {
      count: activeDeliveries.length,
      type: Array.isArray(activeDeliveries) ? 'array' : typeof activeDeliveries,
      sample: activeDeliveries.slice(0, 1)
    });
  }, [activeDeliveries]);

  useEffect(() => {
    console.log('🔍 State change - historyDeliveries:', {
      count: historyDeliveries.length,
      type: Array.isArray(historyDeliveries) ? 'array' : typeof historyDeliveries,
      sample: historyDeliveries.slice(0, 1)
    });
  }, [historyDeliveries]);

  // Cargar datos al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      console.log('🔍 useFocusEffect triggered - loading delivery history...');
      try {
        loadDeliveryHistory();
      } catch (error) {
        console.error('🚨 Error in useFocusEffect:', error);
        ErrorInterceptor.logObjectAccess(error, 'message', 'useFocusEffect-error');
      }
    }, [selectedFilter])
  );

  const loadDeliveryHistory = async (page = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
      }

      console.log('🔍 Cargando historial de entregas...');
      
      // Primero probar endpoint de debug
      try {
        const testResponse = await apiClient.get('/delivery/test-history');
        console.log('🧪 Test response:', testResponse.data);
      } catch (testError) {
        console.log('❌ Error en test endpoint:', testError.message);
      }

      const params = {
        page,
        limit: 20,
        ...(selectedFilter !== 'all' && { status: selectedFilter })
      };

      console.log('📋 Params para /delivery/history:', params);
      const response = await apiClient.get('/delivery/history', { params });

      console.log('📦 Full response structure:', {
        success: response.data.success,
        hasData: !!response.data.data,
        dataType: typeof response.data.data,
        dataKeys: response.data.data ? Object.keys(response.data.data) : 'N/A'
      });

      if (response.data.success) {
        // Safe destructuring with null checks to prevent "cannot convert undefined value to object"
        const responseData = response.data.data || {};
        const { 
          activeDeliveries: newActive = [], 
          historyDeliveries: newHistory = [], 
          pagination: newPagination = { page: 1, hasMore: false } 
        } = responseData;

        console.log('✅ Safely extracted data:', {
          activeCount: newActive.length,
          historyCount: newHistory.length,
          pagination: newPagination
        });

        // Additional validation of the data arrays
        console.log('🔍 Validating extracted data arrays...');
        
        const validActiveDeliveries = newActive.filter((item, index) => {
          if (!item || typeof item !== 'object') {
            console.warn(`⚠️ Invalid active delivery at index ${index}:`, item);
            return false;
          }
          if (!item._id) {
            console.warn(`⚠️ Active delivery missing _id at index ${index}:`, item);
            return false;
          }
          return true;
        });

        const validHistoryDeliveries = newHistory.filter((item, index) => {
          if (!item || typeof item !== 'object') {
            console.warn(`⚠️ Invalid history delivery at index ${index}:`, item);
            return false;
          }
          if (!item._id) {
            console.warn(`⚠️ History delivery missing _id at index ${index}:`, item);
            return false;
          }
          return true;
        });

        console.log('✅ Data validation complete:', {
          validActiveCount: validActiveDeliveries.length,
          validHistoryCount: validHistoryDeliveries.length,
          filteredActive: newActive.length - validActiveDeliveries.length,
          filteredHistory: newHistory.length - validHistoryDeliveries.length
        });
        
        if (append) {
          setHistoryDeliveries(prev => [...prev, ...validHistoryDeliveries]);
        } else {
          setActiveDeliveries(validActiveDeliveries);
          setHistoryDeliveries(validHistoryDeliveries);
        }
        
        setPagination({
          page: newPagination.page,
          hasMore: newPagination.hasMore
        });
      }
    } catch (error) {
      console.error('❌ Error completo cargando historial de entregas:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        }
      });
      
      if (!error.response || error.response.status >= 500) {
        Alert.alert('Error', 'Error del servidor al cargar el historial');
      } else if (error.response.status === 400) {
        Alert.alert('Error 400', `Error en la solicitud: ${error.response?.data?.error?.message || error.message}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreHistory = () => {
    if (pagination.hasMore && !loading) {
      loadDeliveryHistory(pagination.page + 1, true);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPagination({ page: 1, hasMore: true });
    loadDeliveryHistory();
  };

  const handleDeliveryPress = (delivery) => {
    // Additional safety check for delivery object
    if (!delivery || typeof delivery !== 'object' || !delivery._id) {
      console.warn('⚠️ Invalid delivery object in handleDeliveryPress:', delivery);
      Alert.alert('Error', 'No se puede acceder a los detalles de esta entrega');
      return;
    }

    if (delivery.isActive) {
      // Si es una entrega activa, navegar al mapa
      navigation.navigate('DeliveryNavigationSimple', {
        trackingId: delivery._id,
        orderId: delivery.order?._id || delivery.order,
        deliveryTracking: delivery
      });
    } else {
      // Si es historial, mostrar detalles
      setSelectedDelivery(delivery);
      setShowDeliveryDetail(true);
    }
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

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return 'RD$0';
    return `RD$${amount.toFixed(0)}`;
  };

  const formatDistance = (distance) => {
    if (!distance || isNaN(distance)) return '0km';
    if (distance < 1) {
      return `${(distance * 1000).toFixed(0)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const getTimeSince = (dateString) => {
    const now = new Date();
    const deliveryDate = new Date(dateString);
    const diffDays = Math.floor((now - deliveryDate) / (1000 * 60 * 60 * 24));
    
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
      onPress={() => {
        setSelectedFilter(filter);
        setPagination({ page: 1, hasMore: true });
      }}
    >
      <Text style={[
        styles.filterButtonText,
        selectedFilter === filter && styles.filterButtonTextActive
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  const renderDeliveryItem = ({ item }) => {
    console.log('🔍 renderDeliveryItem called with:', {
      item,
      itemType: typeof item,
      hasId: item?._id,
      timestamp: new Date().toISOString()
    });
    
    ErrorInterceptor.logObjectAccess(item, '_id', 'renderDeliveryItem');
    
    // Safety check: ensure item exists and has required properties
    if (!item || typeof item !== 'object') {
      console.warn('⚠️ Invalid item in renderDeliveryItem:', item);
      return null;
    }

    // Safety check: ensure item has _id for key extraction
    if (!item._id) {
      console.warn('⚠️ Item missing _id in renderDeliveryItem:', item);
      return null;
    }

    const stateConfig = DELIVERY_STATES[item.status] || {
      title: 'Desconocido',
      color: '#666',
      icon: 'help-outline',
      bg: '#f5f5f5'
    };

    return (
      <TouchableOpacity
        style={[
          styles.deliveryCard,
          item.isActive && styles.activeDeliveryCard
        ]}
        onPress={() => handleDeliveryPress(item)}
      >
        <View style={styles.deliveryHeader}>
          <View style={styles.deliveryInfo}>
            <Text style={styles.orderNumber}>#{item.order?.orderNumber || 'N/A'}</Text>
            <Text style={styles.merchantName}>
              {item.order?.merchantName || 'Comerciante'}
            </Text>
          </View>
          <View style={styles.deliveryMeta}>
            <Text style={styles.deliveryDate}>{getTimeSince(item.createdAt)}</Text>
            <Text style={styles.deliveryTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.deliveryDetails}>
          <Text style={styles.earnings}>
            Ganancia: {formatCurrency(item.earnings)}
          </Text>
          {item.distance && (
            <Text style={styles.distance}>
              Distancia: {formatDistance(item.distance)}
            </Text>
          )}
        </View>

        <View style={styles.deliveryStatus}>
          <View style={[styles.statusBadge, { backgroundColor: stateConfig.bg }]}>
            <Icon name={stateConfig.icon} size={16} color={stateConfig.color} />
            <Text style={[styles.statusText, { color: stateConfig.color }]}>
              {stateConfig.title}
            </Text>
          </View>
          
          {item.isActive ? (
            <View style={styles.activeIndicator}>
              <Icon name="pulse" size={16} color="#4CAF50" />
              <Text style={styles.activeText}>Activo</Text>
            </View>
          ) : (
            <Icon name="chevron-forward" size={20} color="#ccc" />
          )}
        </View>

        {item.order?.customerInfo && (
          <View style={styles.customerInfo}>
            <Icon name="person-outline" size={14} color="#666" />
            <Text style={styles.customerName}>
              {item.order.customerInfo.name || 'Cliente'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = (title, data, showLoadMore = false) => {
    try {
      if (!Array.isArray(data)) {
        console.warn(`⚠️ renderSection received invalid data for ${title}:`, typeof data);
        return null;
      }

      if (data.length === 0) return null;

      const validData = data.filter(item => item && typeof item === 'object' && item._id);
      
      console.log(`🔍 Rendering section "${title}":`, {
        originalCount: data.length,
        validCount: validData.length,
        filtered: data.length - validData.length
      });

      console.log(`📋 About to render FlatList for "${title}" with data:`, {
        dataLength: validData.length,
        sampleItems: validData.slice(0, 2).map(item => ({
          id: item?._id,
          type: typeof item,
          keys: item ? Object.keys(item).slice(0, 5) : 'N/A'
        }))
      });

      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{title} ({validData.length})</Text>
          <FlatList
            data={validData} // Use pre-filtered valid data
            renderItem={(props) => {
              console.log('🔍 FlatList renderItem called with props:', {
                item: props.item,
                index: props.index,
                itemType: typeof props.item
              });
              return renderDeliveryItem(props);
            }}
            keyExtractor={(item, index) => {
              const key = item?._id || `fallback-${index}-${Math.random()}`;
              console.log('🔑 KeyExtractor called:', { item, index, extractedKey: key });
              ErrorInterceptor.logObjectAccess(item, '_id', `keyExtractor-${title}`);
              return key;
            }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            onEndReached={showLoadMore ? loadMoreHistory : null}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              showLoadMore && pagination.hasMore && !loading ? (
                <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreHistory}>
                  <Text style={styles.loadMoreText}>Cargar más</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>
      );
    } catch (error) {
      console.error(`❌ Error in renderSection for "${title}":`, error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Error: {title}</Text>
          <Text style={{ color: 'red', padding: 10 }}>
            Error al cargar esta sección
          </Text>
        </View>
      );
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E60023" />
        <Text style={styles.loadingText}>Cargando historial...</Text>
      </View>
    );
  }

  // Error boundary component
  const ErrorBoundary = ({ children }) => {
    try {
      return children;
    } catch (error) {
      console.error('🚨 Error boundary caught error in DeliveryHistoryScreen:', error);
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Icon name="chevron-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mis Entregas</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.emptyContainer}>
            <Icon name="warning-outline" size={80} color="#E60023" />
            <Text style={styles.emptyTitle}>Error de visualización</Text>
            <Text style={styles.emptyMessage}>
              Ocurrió un error al mostrar el historial de entregas
            </Text>
            <TouchableOpacity 
              style={styles.startButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.startButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  };

  return (
    <ErrorBoundary>
      <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Entregas</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon name="refresh-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        {renderFilterButton('all', 'Todas')}
        {renderFilterButton('delivered', 'Entregadas')}
        {renderFilterButton('cancelled', 'Canceladas')}
        {renderFilterButton('assigned', 'Asignadas')}
      </View>

      <FlatList
        style={styles.content}
        data={[]} // Usamos data vacía porque renderizamos manualmente
        renderItem={() => null}
        ListHeaderComponent={() => {
          console.log('📋 Main FlatList ListHeaderComponent rendering with:', {
            activeDeliveriesCount: activeDeliveries.length,
            historyDeliveriesCount: historyDeliveries.length,
            activeDeliveriesType: typeof activeDeliveries,
            historyDeliveriesType: typeof historyDeliveries
          });
          
          try {
            return (
              <>
                {renderSection('🚚 Entregas Activas', activeDeliveries)}
                {renderSection('📋 Historial', historyDeliveries, true)}
              </>
            );
          } catch (error) {
            console.error('🚨 Error in ListHeaderComponent:', error);
            return (
              <View style={{ padding: 20 }}>
                <Text style={{ color: 'red' }}>Error al renderizar las secciones</Text>
              </View>
            );
          }
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading && activeDeliveries.length === 0 && historyDeliveries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="car-outline" size={80} color="#ccc" />
              <Text style={styles.emptyTitle}>Sin entregas aún</Text>
              <Text style={styles.emptyMessage}>
                Tus entregas aparecerán aquí una vez que aceptes tu primer pedido
              </Text>
              <TouchableOpacity 
                style={styles.startButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.startButtonText}>Buscar Pedidos</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      {/* Modal de detalles */}
      <Modal
        visible={showDeliveryDetail}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeliveryDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalles de Entrega</Text>
              <TouchableOpacity onPress={() => setShowDeliveryDetail(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {selectedDelivery && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Pedido:</Text>
                  <Text style={styles.detailValue}>#{selectedDelivery.order?.orderNumber}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Comerciante:</Text>
                  <Text style={styles.detailValue}>{selectedDelivery.order?.merchantName}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Cliente:</Text>
                  <Text style={styles.detailValue}>{selectedDelivery.order?.customerInfo?.name}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Fecha:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(selectedDelivery.createdAt)} - {formatTime(selectedDelivery.createdAt)}
                  </Text>
                </View>
                
                {selectedDelivery.completedAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Completado:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(selectedDelivery.completedAt)} - {formatTime(selectedDelivery.completedAt)}
                    </Text>
                  </View>
                )}
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ganancia:</Text>
                  <Text style={[styles.detailValue, { color: '#4CAF50', fontWeight: 'bold' }]}>
                    {formatCurrency(selectedDelivery.earnings)}
                  </Text>
                </View>
                
                {selectedDelivery.distance && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Distancia:</Text>
                    <Text style={styles.detailValue}>{formatDistance(selectedDelivery.distance)}</Text>
                  </View>
                )}
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Estado:</Text>
                  <View style={[styles.statusBadge, { 
                    backgroundColor: DELIVERY_STATES[selectedDelivery.status]?.bg || '#f5f5f5' 
                  }]}>
                    <Icon 
                      name={DELIVERY_STATES[selectedDelivery.status]?.icon || 'help-outline'} 
                      size={16} 
                      color={DELIVERY_STATES[selectedDelivery.status]?.color || '#666'} 
                    />
                    <Text style={[styles.statusText, { 
                      color: DELIVERY_STATES[selectedDelivery.status]?.color || '#666' 
                    }]}>
                      {DELIVERY_STATES[selectedDelivery.status]?.title || 'Desconocido'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
    </ErrorBoundary>
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
    backgroundColor: '#E60023',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  deliveryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeDeliveryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deliveryInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  merchantName: {
    fontSize: 16,
    color: '#E60023',
    marginTop: 2,
  },
  deliveryMeta: {
    alignItems: 'flex-end',
  },
  deliveryDate: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  deliveryTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  deliveryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  earnings: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  distance: {
    fontSize: 14,
    color: '#666',
  },
  deliveryStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 8,
  },
  customerName: {
    marginLeft: 6,
    fontSize: 14,
    color: '#666',
  },
  loadMoreButton: {
    backgroundColor: '#E60023',
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
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
  startButton: {
    backgroundColor: '#E60023',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
});

export default DeliveryHistoryScreen;