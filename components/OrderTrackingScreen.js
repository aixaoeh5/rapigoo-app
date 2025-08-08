// components/OrderTrackingScreen.js
import React, { useState, useEffect } from 'react';
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

import useDeliveryTracking from '../hooks/useDeliveryTracking';
import { 
  DELIVERY_STATE_LABELS, 
  calculateDistance, 
  formatDistance, 
  formatDuration,
  calculateETA 
} from '../utils/navigationStates';

const OrderTrackingScreen = ({ route }) => {
  const { orderId } = route.params;
  const navigation = useNavigation();
  
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
  const pulseAnim = useState(new Animated.Value(1))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (deliveryData) {
      updateMapRegion();
      startAnimations();
    }
  }, [deliveryData]);

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
    if (!deliveryData) return;

    const deliveryLocation = deliveryData.currentLocation;
    const destinationLocation = deliveryData.deliveryLocation?.coordinates;

    if (deliveryLocation && destinationLocation) {
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
    } else if (destinationLocation) {
      setMapRegion({
        latitude: destinationLocation[1],
        longitude: destinationLocation[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const calculateCurrentETA = () => {
    if (!deliveryData?.currentLocation || !deliveryData?.deliveryLocation) {
      return null;
    }

    const distance = calculateDistance(
      deliveryData.currentLocation.coordinates[1],
      deliveryData.currentLocation.coordinates[0],
      deliveryData.deliveryLocation.coordinates[1],
      deliveryData.deliveryLocation.coordinates[0]
    );

    return calculateETA(distance);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshTracking();
    setRefreshing(false);
  };

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

  const renderMap = () => {
    if (!deliveryData || !mapRegion) {
      return (
        <View style={[styles.map, styles.mapPlaceholder]}>
          <Ionicons name="map" size={50} color="#ccc" />
          <Text style={styles.mapPlaceholderText}>Cargando mapa...</Text>
        </View>
      );
    }

    return (
      <MapView
        style={styles.map}
        region={mapRegion}
        showsUserLocation={false}
        showsTraffic={true}
        mapType="standard"
      >
        {/* Marcador del delivery */}
        {deliveryData.currentLocation && (
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
        {deliveryData.deliveryLocation && (
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
      </MapView>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="bicycle" size={50} color="#FF6B6B" />
        <Text style={styles.loadingText}>Cargando información de entrega...</Text>
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
});

export default OrderTrackingScreen;