// components/OrderTrackingScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Animated
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../api/apiClient';

import useDeliveryTracking from '../hooks/useDeliveryTracking';
import { 
  DELIVERY_STATE_LABELS, 
  calculateDistance, 
  formatDistance, 
  formatDuration,
  calculateETA 
} from '../utils/navigationStates';

const OrderTrackingScreen = ({ route }) => {
  const { orderId, orderNumber } = route.params;
  const navigation = useNavigation();
  const [orderData, setOrderData] = useState(null);
  
  // Función para obtener texto de estado
  const getStatusText = (status) => {
    const texts = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      preparing: 'Preparando',
      ready: 'Listo para recoger',
      assigned: 'Repartidor asignado',
      picked_up: 'Recogido',
      in_transit: 'En camino',
      delivered: 'Entregado',
      cancelled: 'Cancelado'
    };
    return texts[status] || status;
  };
  
  // Función para obtener información detallada del estado
  const getStatusInfo = (status) => {
    const statusInfo = {
      pending: {
        icon: 'time',
        color: '#FF9800',
        title: 'Pedido Recibido',
        description: 'El comerciante ha recibido tu pedido y lo está revisando.',
        mapMessage: 'Ubicación del comercio'
      },
      confirmed: {
        icon: 'checkmark-circle',
        color: '#4CAF50',
        title: 'Pedido Confirmado',
        description: 'El comerciante ha confirmado tu pedido y comenzará a prepararlo.',
        mapMessage: 'El comercio está preparando tu pedido'
      },
      preparing: {
        icon: 'restaurant',
        color: '#2196F3',
        title: 'Preparando Pedido',
        description: 'Tu pedido se está preparando en este momento.',
        mapMessage: 'El comercio está preparando tu pedido'
      },
      ready: {
        icon: 'cube',
        color: '#FF6B6B',
        title: 'Listo para Entregar',
        description: 'Tu pedido está listo y esperando que se asigne un repartidor.',
        mapMessage: 'Pedido listo - Esperando repartidor'
      },
      assigned: {
        icon: 'bicycle',
        color: '#9C27B0',
        title: 'Repartidor Asignado',
        description: 'Se ha asignado un repartidor y se dirige al comercio.',
        mapMessage: 'Repartidor en camino al comercio'
      },
      picked_up: {
        icon: 'bag',
        color: '#FF9800',
        title: 'Pedido Recogido',
        description: 'El repartidor ha recogido tu pedido y se dirige hacia ti.',
        mapMessage: 'Repartidor en camino hacia ti'
      },
      in_transit: {
        icon: 'car',
        color: '#4CAF50',
        title: 'En Camino',
        description: 'Tu pedido está en camino hacia tu ubicación.',
        mapMessage: 'Seguimiento en tiempo real'
      },
      delivered: {
        icon: 'home',
        color: '#4CAF50',
        title: 'Entregado',
        description: 'Tu pedido ha sido entregado exitosamente.',
        mapMessage: 'Pedido entregado'
      },
      cancelled: {
        icon: 'close-circle',
        color: '#F44336',
        title: 'Cancelado',
        description: 'Este pedido ha sido cancelado.',
        mapMessage: 'Pedido cancelado'
      }
    };
    
    return statusInfo[status] || {
      icon: 'help-circle',
      color: '#757575',
      title: 'Estado Desconocido',
      description: 'El estado del pedido no es reconocido.',
      mapMessage: 'Estado desconocido'
    };
  };
  
  const {
    deliveryData,
    isLoading,
    error,
    eta,
    connectionStatus,
    refreshTracking
  } = useDeliveryTracking(orderId);

  const [refreshing, setRefreshing] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  
  // Animaciones
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (deliveryData) {
      console.log('🗺️ OrderTracking - Delivery data received:', {
        hasCurrentLocation: !!deliveryData.currentLocation,
        hasDeliveryLocation: !!deliveryData.deliveryLocation,
        currentCoords: deliveryData.currentLocation?.coordinates,
        deliveryCoords: deliveryData.deliveryLocation?.coordinates
      });
      updateMapRegion();
      startAnimations();
    }
  }, [deliveryData]);
  
  // Actualizar mapa cuando cambie la orden o el tipo de vista
  useEffect(() => {
    if (orderData) {
      console.log('🗺️ OrderTracking - Order data received:', {
        status: orderData.status,
        merchantId: orderData.merchantId?._id,
        hasMerchantLocation: !!(orderData.merchantId?.business?.location || orderData.merchantId?.location),
        hasDeliveryAddress: !!orderData.deliveryInfo?.address?.coordinates
      });
      updateMapRegion();
    }
  }, [orderData]);

  const startAnimations = () => {
    // Animación de pulso para el marcador de delivery
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Fade in para el contenido
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const updateMapRegion = () => {
    const mapType = getMapType();
    
    if (mapType === 'merchant') {
      // Para vista del comercio, centrar en el comercio y destino
      const merchantLocation = orderData?.merchantId?.business?.location || 
                              orderData?.merchantId?.location;
      const customerLocation = orderData?.deliveryInfo?.address?.coordinates;
      
      if (merchantLocation && isValidCoordinate(merchantLocation.coordinates) &&
          customerLocation && isValidCoordinate(customerLocation)) {
        // Mostrar ambas ubicaciones
        const lat1 = merchantLocation.coordinates[1];
        const lon1 = merchantLocation.coordinates[0];
        const lat2 = customerLocation[1];
        const lon2 = customerLocation[0];

        const minLat = Math.min(lat1, lat2);
        const maxLat = Math.max(lat1, lat2);
        const minLon = Math.min(lon1, lon2);
        const maxLon = Math.max(lon1, lon2);

        const latDelta = (maxLat - minLat) * 1.8 || 0.02;
        const lonDelta = (maxLon - minLon) * 1.8 || 0.02;

        setMapRegion({
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max(latDelta, 0.02),
          longitudeDelta: Math.max(lonDelta, 0.02),
        });
      } else if (merchantLocation && isValidCoordinate(merchantLocation.coordinates)) {
        // Solo mostrar comercio
        setMapRegion({
          latitude: merchantLocation.coordinates[1],
          longitude: merchantLocation.coordinates[0],
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        // Fallback
        setMapRegion({
          latitude: 18.4861,
          longitude: -69.9312,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    } else if (mapType === 'delivery' && deliveryData) {
      // Lógica original para tracking de delivery
      const deliveryLocation = deliveryData.currentLocation;
      const destinationLocation = deliveryData.deliveryLocation?.coordinates;

      // Validar coordenadas del delivery
      const hasValidDeliveryCoords = deliveryLocation && 
        isValidCoordinate(deliveryLocation.coordinates);
      
      // Validar coordenadas del destino
      const hasValidDestinationCoords = destinationLocation && 
        isValidCoordinate(destinationLocation);

      if (hasValidDeliveryCoords && hasValidDestinationCoords) {
        const lat1 = deliveryLocation.coordinates[1];
        const lon1 = deliveryLocation.coordinates[0];
        const lat2 = destinationLocation[1];
        const lon2 = destinationLocation[0];

        const minLat = Math.min(lat1, lat2);
        const maxLat = Math.max(lat1, lat2);
        const minLon = Math.min(lon1, lon2);
        const maxLon = Math.max(lon1, lon2);

        const latDelta = (maxLat - minLat) * 1.5 || 0.01;
        const lonDelta = (maxLon - minLon) * 1.5 || 0.01;

        setMapRegion({
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max(latDelta, 0.01),
          longitudeDelta: Math.max(lonDelta, 0.01),
        });
      } else if (hasValidDestinationCoords) {
        setMapRegion({
          latitude: destinationLocation[1],
          longitude: destinationLocation[0],
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else if (hasValidDeliveryCoords) {
        setMapRegion({
          latitude: deliveryLocation.coordinates[1],
          longitude: deliveryLocation.coordinates[0],
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        // Sin coordenadas válidas, usar coordenadas por defecto
        console.log('⚠️ OrderTracking - No hay coordenadas válidas de delivery, usando ubicación por defecto');
        setMapRegion({
          latitude: 18.4861,
          longitude: -69.9312,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    }
  };

  const calculateCurrentETA = () => {
    if (!deliveryData?.currentLocation || !deliveryData?.deliveryLocation) {
      return null;
    }

    // Validar que las coordenadas sean válidas antes de calcular distancia
    const currentCoords = deliveryData.currentLocation.coordinates;
    const deliveryCoords = deliveryData.deliveryLocation.coordinates;
    
    if (!isValidCoordinate(currentCoords) || !isValidCoordinate(deliveryCoords)) {
      return null;
    }

    const distance = calculateDistance(
      currentCoords[1],
      currentCoords[0],
      deliveryCoords[1],
      deliveryCoords[0]
    );

    return calculateETA(distance);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshTracking();
    await loadOrderData();
    setRefreshing(false);
  };

  const loadOrderData = async () => {
    try {
      const response = await apiClient.get(`/orders/${orderId}`);
      if (response.data.success) {
        setOrderData(response.data.data || response.data.order);
      } else {
        console.warn('Respuesta no exitosa al cargar orden:', response.data);
      }
    } catch (err) {
      console.error('Error loading order data:', err);
      
      const isNotFound = err.response?.status === 404;
      const isNetworkError = !err.response;
      
      if (isNotFound) {
        console.log('🔍 Orden no encontrada:', orderId);
      } else if (isNetworkError) {
        console.log('🌐 Error de conexión al cargar orden');
      }
    }
  };

  useEffect(() => {
    loadOrderData();
  }, [orderId]);

  const renderStatusTimeline = () => {
    const statuses = [
      { key: 'assigned', label: 'Pedido asignado', icon: 'checkmark-circle' },
      { key: 'heading_to_pickup', label: 'Yendo a recoger', icon: 'bicycle' },
      { key: 'picked_up', label: 'Pedido recogido', icon: 'bag' },
      { key: 'heading_to_delivery', label: 'En camino', icon: 'car' },
      { key: 'delivered', label: 'Entregado', icon: 'home' }
    ];

    const currentStatusIndex = statuses.findIndex(s => s.key === deliveryData?.status);

    return (
      <View style={styles.timeline}>
        {statuses.map((status, index) => (
          <View key={status.key} style={styles.timelineItem}>
            <View style={styles.timelineIconContainer}>
              <View style={[
                styles.timelineIcon,
                {
                  backgroundColor: index <= currentStatusIndex ? '#4CAF50' : '#E0E0E0'
                }
              ]}>
                <Ionicons 
                  name={status.icon} 
                  size={16} 
                  color={index <= currentStatusIndex ? '#fff' : '#999'} 
                />
              </View>
              {index < statuses.length - 1 && (
                <View style={[
                  styles.timelineLine,
                  { backgroundColor: index < currentStatusIndex ? '#4CAF50' : '#E0E0E0' }
                ]} />
              )}
            </View>
            <Text style={[
              styles.timelineText,
              { color: index <= currentStatusIndex ? '#333' : '#999' }
            ]}>
              {status.label}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderDeliveryInfo = () => {
    if (!deliveryData) return null;

    const currentETA = calculateCurrentETA();

    return (
      <View style={styles.deliveryInfoContainer}>
        <View style={styles.deliveryHeader}>
          <View style={styles.deliveryPersonInfo}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
            <View>
              <Text style={styles.deliveryPersonName}>
                {deliveryData.deliveryPersonId?.name || 'Repartidor'}
              </Text>
              <Text style={styles.deliveryPersonPhone}>
                {deliveryData.deliveryPersonId?.phone || 'Sin teléfono'}
              </Text>
            </View>
          </View>

          <View style={styles.etaContainer}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text style={styles.etaValue}>
              {currentETA ? `${currentETA} min` : '--'}
            </Text>
          </View>
        </View>

        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: connectionStatus ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>
            {DELIVERY_STATE_LABELS[deliveryData.status] || deliveryData.status}
          </Text>
        </View>
      </View>
    );
  };

  // Función para validar coordenadas
  const isValidCoordinate = (coordinates) => {
    return coordinates && 
           Array.isArray(coordinates) && 
           coordinates.length === 2 &&
           typeof coordinates[0] === 'number' && 
           typeof coordinates[1] === 'number' &&
           !isNaN(coordinates[0]) && 
           !isNaN(coordinates[1]) &&
           coordinates[0] !== null && 
           coordinates[1] !== null;
  };

  // Determinar qué tipo de mapa mostrar según el estado del pedido
  const getMapType = () => {
    if (!orderData) return 'loading';
    
    const orderStatus = orderData.status;
    
    // Estados donde el pedido está en el comercio
    const merchantStates = ['pending', 'confirmed', 'preparing', 'ready'];
    
    // Estados donde hay delivery activo
    const deliveryStates = ['assigned', 'picked_up', 'in_transit', 'heading_to_pickup', 'heading_to_delivery'];
    
    if (merchantStates.includes(orderStatus)) {
      return 'merchant'; // Mostrar ubicación del comercio
    } else if (deliveryStates.includes(orderStatus)) {
      return 'delivery'; // Mostrar tracking del delivery
    } else if (orderStatus === 'delivered') {
      return 'completed'; // Mostrar ubicación final
    } else {
      return 'unknown';
    }
  };
  
  const renderMerchantMap = () => {
    // Mapa mostrando la ubicación del comercio mientras prepara el pedido
    const merchantLocation = orderData.merchantId?.business?.location || 
                           orderData.merchantId?.location;
    
    let mapCenter;
    if (merchantLocation && isValidCoordinate(merchantLocation.coordinates)) {
      mapCenter = {
        latitude: merchantLocation.coordinates[1],
        longitude: merchantLocation.coordinates[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    } else {
      // Fallback a Santo Domingo centro
      mapCenter = {
        latitude: 18.4861,
        longitude: -69.9312,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    
    return (
      <MapView
        style={styles.map}
        region={mapCenter}
        showsUserLocation={false}
        showsTraffic={false}
        mapType="standard"
      >
        {/* Marcador del comercio */}
        {merchantLocation && isValidCoordinate(merchantLocation.coordinates) && (
          <Marker
            coordinate={{
              latitude: merchantLocation.coordinates[1],
              longitude: merchantLocation.coordinates[0]
            }}
            title="Comercio"
            description={`${orderData.merchantId?.name || orderData.merchantId?.business?.businessName || 'Comercio'} - Preparando tu pedido`}
          >
            <View style={styles.merchantMarker}>
              <Ionicons name="storefront" size={20} color="#fff" />
            </View>
          </Marker>
        )}
        
        {/* Marcador del destino (tu ubicación) */}
        {orderData.deliveryInfo?.address?.coordinates && 
         isValidCoordinate(orderData.deliveryInfo.address.coordinates) && (
          <Marker
            coordinate={{
              latitude: orderData.deliveryInfo.address.coordinates[1],
              longitude: orderData.deliveryInfo.address.coordinates[0]
            }}
            title="Tu ubicación"
            description="Destino de entrega"
            pinColor="#FF6B6B"
          />
        )}
      </MapView>
    );
  };
  
  const renderDeliveryMap = () => {
    // Mapa mostrando el tracking del delivery en movimiento
    if (!deliveryData || !mapRegion) {
      return (
        <View style={[styles.map, styles.mapPlaceholder]}>
          <Ionicons name="bicycle" size={50} color="#ccc" />
          <Text style={styles.mapPlaceholderText}>Conectando con el repartidor...</Text>
        </View>
      );
    }

    // Verificar si tenemos al menos una ubicación válida para mostrar
    const hasValidCurrentLocation = deliveryData.currentLocation && 
      isValidCoordinate(deliveryData.currentLocation.coordinates);
    const hasValidDeliveryLocation = deliveryData.deliveryLocation && 
      isValidCoordinate(deliveryData.deliveryLocation.coordinates);

    return (
      <MapView
        style={styles.map}
        region={mapRegion}
        showsUserLocation={false}
        showsTraffic={true}
        mapType="standard"
        onError={(error) => {
          console.error('❌ Error en MapView:', error);
        }}
      >
        {/* Marcador del delivery */}
        {deliveryData.currentLocation && isValidCoordinate(deliveryData.currentLocation.coordinates) && (
          <Marker
            coordinate={{
              latitude: deliveryData.currentLocation.coordinates[1],
              longitude: deliveryData.currentLocation.coordinates[0]
            }}
            title="Repartidor"
            description="Ubicación actual"
          >
            <Animated.View style={[styles.deliveryMarker, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.deliveryMarkerInner}>
                <Ionicons name="bicycle" size={16} color="#fff" />
              </View>
            </Animated.View>
          </Marker>
        )}

        {/* Marcador del destino */}
        {deliveryData.deliveryLocation && isValidCoordinate(deliveryData.deliveryLocation.coordinates) && (
          <Marker
            coordinate={{
              latitude: deliveryData.deliveryLocation.coordinates[1],
              longitude: deliveryData.deliveryLocation.coordinates[0]
            }}
            title="Tu ubicación"
            description="Destino de entrega"
            pinColor="#FF6B6B"
          />
        )}
        
        {/* Mensaje informativo si no hay marcadores */}
        {!hasValidCurrentLocation && !hasValidDeliveryLocation && (
          <View style={styles.noLocationOverlay}>
            <Ionicons name="location-outline" size={40} color="#999" />
            <Text style={styles.noLocationText}>Esperando ubicación del repartidor</Text>
          </View>
        )}
      </MapView>
    );
  };

  const renderMap = () => {
    const mapType = getMapType();
    
    console.log('🗺️ OrderTracking - Map type determined:', mapType, 'Order status:', orderData?.status);
    
    switch (mapType) {
      case 'merchant':
        return renderMerchantMap();
      case 'delivery':
        return renderDeliveryMap();
      case 'completed':
        return renderDeliveryMap(); // Mostrar ubicación final
      case 'loading':
        return (
          <View style={[styles.map, styles.mapPlaceholder]}>
            <Ionicons name="map" size={50} color="#ccc" />
            <Text style={styles.mapPlaceholderText}>Cargando información del pedido...</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.map, styles.mapPlaceholder]}>
            <Ionicons name="help-circle" size={50} color="#ccc" />
            <Text style={styles.mapPlaceholderText}>Estado del pedido no reconocido</Text>
          </View>
        );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="bicycle" size={50} color="#FF6B6B" />
        <Text style={styles.loadingText}>Cargando información de entrega...</Text>
      </View>
    );
  }

  // Para pedidos sin delivery asignado (pending, confirmed, preparing, ready)
  if ((!deliveryData && !isLoading) || (orderData && ['pending', 'confirmed', 'preparing', 'ready'].includes(orderData.status))) {
    // Mostrar estado del pedido sin tracking de delivery
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Estado del Pedido</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Mapa del comercio para pedidos sin tracking */}
          <View style={styles.mapContainer}>
            {renderMap()}
          </View>
          
          <View style={styles.noTrackingContainer}>
            {orderData && (() => {
              const statusInfo = getStatusInfo(orderData.status);
              return (
                <>
                  <Ionicons name={statusInfo.icon} size={60} color={statusInfo.color} />
                  <Text style={styles.noTrackingTitle}>Pedido #{orderNumber || orderId.slice(-6)}</Text>
                  <Text style={[styles.statusTitle, { color: statusInfo.color }]}>{statusInfo.title}</Text>
                  <Text style={styles.noTrackingText}>
                    {statusInfo.description}
                  </Text>
                  <Text style={styles.noTrackingSubtext}>
                    {statusInfo.mapMessage}
                  </Text>
                </>
              );
            })()}
            
            {orderData && (
              <View style={styles.orderInfoCard}>
                <Text style={styles.orderInfoTitle}>Información del pedido</Text>
                <View style={styles.orderInfoRow}>
                  <Text style={styles.orderInfoLabel}>Estado:</Text>
                  <Text style={styles.orderInfoValue}>{getStatusText(orderData.status)}</Text>
                </View>
                <View style={styles.orderInfoRow}>
                  <Text style={styles.orderInfoLabel}>Total:</Text>
                  <Text style={styles.orderInfoValue}>${(orderData.total || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.orderInfoRow}>
                  <Text style={styles.orderInfoLabel}>Comerciante:</Text>
                  <Text style={styles.orderInfoValue}>
                    {orderData.merchantId?.name || orderData.merchantId?.business?.businessName || 'Comerciante'}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={50} color="#F44336" />
        <Text style={styles.errorTitle}>Error al cargar tracking</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshTracking}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seguir Pedido</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Mapa */}
        <Animated.View style={[styles.mapContainer, { opacity: fadeAnim }]}>
          {renderMap()}
        </Animated.View>

        {/* Información del delivery */}
        <Animated.View style={[styles.infoSection, { opacity: fadeAnim }]}>
          {renderDeliveryInfo()}
        </Animated.View>

        {/* Timeline de estado */}
        <Animated.View style={[styles.timelineSection, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Estado del pedido</Text>
          {renderStatusTimeline()}
        </Animated.View>

        {/* Información adicional */}
        {deliveryData && (
          <Animated.View style={[styles.additionalInfo, { opacity: fadeAnim }]}>
            <View style={styles.infoRow}>
              <Ionicons name="receipt" size={20} color="#666" />
              <Text style={styles.infoText}>
                Pedido #{deliveryData.orderId?.orderNumber || 'N/A'}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.infoText}>
                Última actualización: {deliveryData.lastLocationUpdate 
                  ? new Date(deliveryData.lastLocationUpdate).toLocaleTimeString()
                  : 'No disponible'
                }
              </Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>
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
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    height: 250,
    margin: 15,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  mapPlaceholderText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  deliveryMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryMarkerInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    margin: 15,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  deliveryInfoContainer: {
    marginBottom: 15,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  deliveryPersonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deliveryPersonName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  deliveryPersonPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  etaContainer: {
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  etaValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  timelineSection: {
    margin: 15,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  timeline: {
    paddingLeft: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 15,
    position: 'relative',
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    position: 'absolute',
    top: 32,
    width: 2,
    height: 20,
  },
  timelineText: {
    fontSize: 14,
    flex: 1,
  },
  additionalInfo: {
    margin: 15,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
    flex: 1,
  },
  
  // Estilos para pedidos sin tracking
  noTrackingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 50,
  },
  
  noTrackingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  
  noTrackingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  
  noTrackingSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  
  orderInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  orderInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  
  orderInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  
  orderInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  
  // Estilos para overlay de mapa sin ubicaciones
  noLocationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 249, 250, 0.9)',
  },
  
  noLocationText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  
  // Estilos para marcador del comercio
  merchantMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default OrderTrackingScreen;