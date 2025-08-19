import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

/**
 * DeliveryNavigationScreen - Versión Simplificada
 * Sin dependencias complejas, enfoque en funcionalidad básica
 */
const DeliveryNavigationScreenSimple = ({ route }) => {
  const navigation = useNavigation();
  
  // Estados básicos
  const [currentLocation, setCurrentLocation] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('assigned');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Extracción ultra-segura de parámetros
  const routeParams = route && route.params ? route.params : {};
  const deliveryData = routeParams.deliveryTracking || {};
  const trackingId = routeParams.trackingId || routeParams._id || deliveryData._id || 'unknown';
  const orderId = routeParams.orderId || deliveryData.orderId || 'unknown';
  
  console.log('📱 DeliveryNavigationScreenSimple iniciado:', {
    trackingId,
    orderId,
    hasDeliveryData: !!deliveryData
  });

  // Inicialización básica
  useEffect(() => {
    initializeSimpleNavigation();
  }, []);

  const initializeSimpleNavigation = async () => {
    try {
      // Solicitar permisos de ubicación
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permisos de ubicación denegados');
        return;
      }

      // Obtener ubicación actual
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setIsLoading(false);
    } catch (error) {
      console.error('Error inicializando navegación:', error);
      setError('Error al inicializar navegación');
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      console.log('Actualizando estado:', deliveryStatus, '->', newStatus);
      setDeliveryStatus(newStatus);
      
      Alert.alert(
        'Estado Actualizado',
        `Estado cambiado a: ${getStatusLabel(newStatus)}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error actualizando estado:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado');
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      'assigned': 'Asignado',
      'heading_to_pickup': 'Yendo a recoger',
      'at_pickup': 'En el restaurante',
      'picked_up': 'Pedido recogido',
      'heading_to_delivery': 'En camino al cliente',
      'at_delivery': 'En destino',
      'delivered': 'Entregado'
    };
    return labels[status] || status;
  };

  const getNextAction = () => {
    switch (deliveryStatus) {
      case 'assigned':
        return { action: 'heading_to_pickup', label: 'Ir a Recoger' };
      case 'heading_to_pickup':
        return { action: 'at_pickup', label: 'Llegué al Restaurante' };
      case 'at_pickup':
        return { action: 'picked_up', label: 'Recoger Pedido' };
      case 'picked_up':
        return { action: 'heading_to_delivery', label: 'Ir al Cliente' };
      case 'heading_to_delivery':
        return { action: 'at_delivery', label: 'Llegué al Cliente' };
      case 'at_delivery':
        return { action: 'delivered', label: 'Entregar Pedido' };
      default:
        return { action: 'delivered', label: 'Finalizar' };
    }
  };

  const handleBackPress = () => {
    Alert.alert(
      'Salir de Navegación',
      '¿Estás seguro de que quieres salir de la navegación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', onPress: () => navigation.replace('HomeDelivery') }
      ]
    );
  };

  if (error) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#d32f2f" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#d32f2f" />
          <Text style={styles.errorTitle}>Error de Navegación</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={handleBackPress}>
            <Text style={styles.buttonText}>Volver al Inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#E60023" />
        <View style={styles.loadingContainer}>
          <Ionicons name="location" size={60} color="#E60023" />
          <Text style={styles.loadingTitle}>Cargando Navegación...</Text>
          <Text style={styles.loadingText}>Obteniendo ubicación</Text>
        </View>
      </View>
    );
  }

  const nextAction = getNextAction();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#E60023" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delivery en Proceso</Text>
      </View>

      {/* Mapa */}
      <MapView
        style={styles.map}
        region={{
          latitude: currentLocation?.latitude || -18.5,
          longitude: currentLocation?.longitude || -69.5,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        followsUserLocation={true}
        showsCompass={true}
      >
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Tu ubicación"
            description="Ubicación actual del delivery"
          />
        )}
      </MapView>

      {/* Panel de Control */}
      <View style={styles.controlPanel}>
        <Text style={styles.statusTitle}>Estado Actual</Text>
        <Text style={styles.statusText}>{getStatusLabel(deliveryStatus)}</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tracking ID:</Text>
          <Text style={styles.infoValue}>{trackingId}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Order ID:</Text>
          <Text style={styles.infoValue}>{orderId}</Text>
        </View>

        {deliveryStatus !== 'delivered' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleStatusUpdate(nextAction.action)}
          >
            <Text style={styles.actionButtonText}>{nextAction.label}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.emergencyButton]}
          onPress={() => {
            Alert.alert(
              'Emergencia',
              'Contactar con soporte en caso de problemas',
              [{ text: 'OK' }]
            );
          }}
        >
          <Text style={styles.actionButtonText}>Emergencia</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#E60023',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 15,
    paddingHorizontal: 20,
    zIndex: 1000,
    elevation: 5,
  },
  backButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginRight: 44,
  },
  map: {
    flex: 1,
  },
  controlPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 16,
    color: '#E60023',
    fontWeight: '600',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#E60023',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  emergencyButton: {
    backgroundColor: '#ff9800',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#E60023',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginTop: 15,
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E60023',
    marginTop: 15,
    marginBottom: 5,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default DeliveryNavigationScreenSimple;