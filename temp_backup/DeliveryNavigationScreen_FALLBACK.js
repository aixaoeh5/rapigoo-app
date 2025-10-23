// SAFE VERSION: DeliveryNavigationScreen with comprehensive undefined protection
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
  StatusBar
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActiveDeliveryManager from '../utils/activeDeliveryManager';

// Simple safe navigation screen that prevents all undefined access
const DeliveryNavigationScreen = ({ route }) => {
  const navigation = useNavigation();
  
  // Ultra-safe parameter extraction
  console.log('🔍 SAFE DeliveryNavigationScreen - Raw route:', typeof route);
  console.log('🔍 SAFE DeliveryNavigationScreen - Route params:', typeof route?.params);
  
  const safeRoute = route || {};
  const safeParams = safeRoute.params || {};
  
  console.log('🔍 SAFE - Extracted params:', safeParams);
  
  // Extract essential data with maximum safety
  const trackingId = safeParams.trackingId || safeParams._id || null;
  const deliveryTracking = safeParams.deliveryTracking || null;
  const orderId = safeParams.orderId || deliveryTracking?.orderId || null;
  
  console.log('🔍 SAFE - Final extracted data:', {
    trackingId,
    hasDeliveryTracking: !!deliveryTracking,
    orderId
  });
  
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🔍 SAFE - Initializing with:', { trackingId, hasDeliveryTracking: !!deliveryTracking });
        
        if (!trackingId && !deliveryTracking) {
          throw new Error('No tracking data provided');
        }
        
        // Get location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission denied');
        }
        
        // Get current location
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('🚨 SAFE - Initialization error:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };
    
    initialize();
  }, []);
  
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error de Navegación</Text>
          <Text style={styles.errorSubtitle}>
            {error}
          </Text>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.replace('HomeDelivery')}
          >
            <Text style={styles.backButtonText}>Volver al Inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingTitle}>Cargando...</Text>
          <Text style={styles.loadingSubtitle}>Preparando navegación</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButtonHeader} 
          onPress={() => navigation.navigate('HomeDelivery')}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Navegación Segura</Text>
      </View>
      
      {/* Map */}
      <MapView
        style={styles.map}
        region={{
          latitude: currentLocation?.latitude || -18.5,
          longitude: currentLocation?.longitude || -69.5,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        followsUserLocation
        showsCompass
      >
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Tu ubicación"
            description="Ubicación actual"
          />
        )}
      </MapView>
      
      {/* Info Panel */}
      <View style={styles.infoPanel}>
        <Text style={styles.infoTitle}>Información de Delivery</Text>
        <Text style={styles.infoText}>Tracking ID: {trackingId || 'No disponible'}</Text>
        <Text style={styles.infoText}>Order ID: {orderId || 'No disponible'}</Text>
        <Text style={styles.infoText}>Estado: Navegación segura activa</Text>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            Alert.alert(
              'Navegación Segura',
              'Esta es una versión segura de la pantalla de navegación que previene errores de undefined.',
              [{ text: 'OK' }]
            );
          }}
        >
          <Text style={styles.actionButtonText}>Estado del Delivery</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#f44336' }]}
          onPress={() => navigation.replace('HomeDelivery')}
        >
          <Text style={styles.actionButtonText}>Finalizar Navegación</Text>
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
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 15,
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  backButtonHeader: {
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
    marginRight: 44, // Compensate for back button
  },
  infoPanel: {
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
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#E60023',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DeliveryNavigationScreen;