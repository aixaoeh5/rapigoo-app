// components/DeliveryNavigationScreen.js
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
import { useDeliveryNotifications } from '../hooks/useDeliveryNotifications';
// Importación segura de keep-awake
let keepAwake, allowSleepAgain;
try {
  const keepAwakeModule = require('expo-keep-awake');
  keepAwake = keepAwakeModule.keepAwake || keepAwakeModule.default?.keepAwake;
  allowSleepAgain = keepAwakeModule.allowSleepAgain || keepAwakeModule.default?.allowSleepAgain;
  
  // Verificar que las funciones realmente existen
  if (typeof keepAwake !== 'function') {
    keepAwake = () => console.log('⚠️ Keep awake not available - screen may turn off');
  }
  if (typeof allowSleepAgain !== 'function') {
    allowSleepAgain = () => console.log('⚠️ Allow sleep again not available');
  }
} catch (error) {
  console.log('⚠️ expo-keep-awake not installed:', error.message);
  // Fallback functions si expo-keep-awake no está disponible
  keepAwake = () => console.log('⚠️ Keep awake not available - screen may turn off');
  allowSleepAgain = () => console.log('⚠️ Allow sleep again not available');
}

import { apiClient } from '../api/apiClient';
import realTimeService from '../services/realTimeService';
import ErrorInterceptor from '../utils/ErrorInterceptor';
import { 
  DELIVERY_STATES, 
  DELIVERY_STATE_LABELS,
  getNextWaypoint, 
  getNextAction, 
  checkArrival,
  calculateDistance,
  formatDistance,
  formatDuration,
  calculateETA
} from '../utils/navigationStates';
import DeliveryDataValidator from '../utils/DeliveryDataValidator';

const DeliveryNavigationScreen = ({ route }) => {
  const navigation = useNavigation();
  const mapRef = useRef();
  
  try {
    // Safe parameter extraction to prevent "Cannot convert undefined value to object"
    console.log('🔍 DeliveryNavigationScreen route params:', route?.params);
    ErrorInterceptor.logObjectAccess(route, 'params', 'DeliveryNavigationScreen-route');
    
    const routeParams = ErrorInterceptor.safeObjectDestructure(route?.params, {}, 'DeliveryNavigationScreen-routeParams');
    
    // Enhanced parameter extraction with validation
    const paramValidation = DeliveryDataValidator.validateNavigationParams(routeParams);
  
  if (!paramValidation.isValid) {
    console.error('❌ Invalid navigation parameters:', paramValidation.error);
  }
  
  // Safe destructuring with fallbacks to prevent undefined object conversion
  const { 
    deliveryTracking = null, 
    trackingId = null, 
    orderId = null 
  } = paramValidation.params || {};
  
  const [currentLocation, setCurrentLocation] = useState(null);
  const [deliveryData, setDeliveryData] = useState(deliveryTracking || null);
  const [isLoadingData, setIsLoadingData] = useState(!deliveryTracking);
  const [hasValidData, setHasValidData] = useState(false);
  const [navigationInfo, setNavigationInfo] = useState({
    distance: 0,
    duration: 0,
    steps: []
  });
  const [isTracking, setIsTracking] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [autoArrivalCheck, setAutoArrivalCheck] = useState(true);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  // Animaciones
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const statusAnim = useRef(new Animated.Value(0)).current;
  
  // Hook para notificaciones de delivery
  const { emitStatusUpdate, emitLocationUpdate } = useDeliveryNotifications(
    orderId, 
    deliveryData?.deliveryPersonId,
    (newStatus, data) => {
      // Callback cuando se recibe un cambio de estado automático
      setDeliveryData(prev => ({
        ...prev,
        status: newStatus
      }));
      
      // Animar cambio de estado
      Animated.sequence([
        Animated.timing(statusAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(statusAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  );

  // Enhanced initialization with better error handling
  useEffect(() => {
    const initializeScreen = async () => {
      console.log('🔄 Initializing DeliveryNavigationScreen...');
      console.log('📊 Initial state:', {
        hasDeliveryData: !!deliveryData,
        hasTrackingId: !!trackingId,
        hasOrderId: !!orderId
      });
      
      // Validate we have minimum required data
      if (!trackingId && !deliveryData?._id) {
        console.error('❌ Critical: No trackingId or deliveryData._id available');
        Alert.alert(
          'Error de Navegación',
          'No se recibieron los datos necesarios para la navegación. Volviendo al inicio.',
          [{ text: 'OK', onPress: () => navigation.replace('HomeDelivery') }]
        );
        return;
      }
      
      // Initialize navigation first
      await initializeNavigation();
      
      // Load data if needed
      if (!deliveryData && trackingId) {
        await loadDeliveryData();
      } else if (deliveryData) {
        setHasValidData(true);
      }
    };
    
    initializeScreen();
    
    // Prevenir que el usuario salga mientras hay entrega activa
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Solo prevenir si la entrega no está completada
      if (hasValidData && deliveryData?.status && !['delivered', 'cancelled'].includes(deliveryData.status)) {
        // Prevenir la acción por defecto
        e.preventDefault();
        
        Alert.alert(
          'Entrega en Progreso',
          '¿Estás seguro de que quieres salir? Tu entrega está en progreso.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Salir',
              style: 'destructive',
              onPress: () => {
                // Permitir salir después de confirmación
                navigation.dispatch(e.data.action);
              },
            },
          ]
        );
      }
    });
    
    return () => {
      unsubscribe();
      cleanup();
    };
  }, [navigation]);

  // Monitor data validity
  useEffect(() => {
    const isValid = deliveryData && deliveryData._id;
    setHasValidData(isValid);
    
    if (isValid) {
      console.log('✅ Valid delivery data confirmed:', {
        id: deliveryData._id,
        status: deliveryData.status,
        orderId: deliveryData.orderId
      });
    }
  }, [deliveryData]);

  const refreshDeliveryStatus = async () => {
    try {
      if (!deliveryData?._id) return;
      
      console.log('🔄 Refrescando estado del delivery...');
      const response = await apiClient.get(`/delivery/${deliveryData._id}`);
      
      if (response.data.success) {
        const updatedData = response.data.data.deliveryTracking;
        console.log('✅ Estado actualizado desde servidor:', updatedData.status);
        
        setDeliveryData(prev => ({
          ...prev,
          status: updatedData.status
        }));
        
        await ActiveDeliveryManager.updateActiveDeliveryStatus(updatedData.status);
      }
    } catch (error) {
      console.error('❌ Error refrescando estado:', error);
    }
  };

  // Refrescar estado cuando la pantalla gana foco
  useFocusEffect(
    React.useCallback(() => {
      if (deliveryData?._id) {
        console.log('🔄 Pantalla enfocada, refrescando estado...');
        refreshDeliveryStatus();
      }
    }, [deliveryData?._id])
  );

  const loadDeliveryData = async () => {
    try {
      setIsLoadingData(true);
      console.log('🚚 Cargando datos de delivery tracking:', trackingId);
      
      if (!trackingId) {
        throw new Error('trackingId is required but not provided');
      }
      
      const response = await apiClient.get(`/delivery/${trackingId}`);
      console.log('📡 Respuesta completa del API:', response.data);
      
      if (response.data.success && response.data.data?.deliveryTracking) {
        const trackingData = response.data.data.deliveryTracking;
        
        // Validate essential data structure
        if (!trackingData._id) {
          throw new Error('Invalid delivery data: missing _id');
        }
        
        console.log('✅ Datos de delivery cargados:', trackingData);
        console.log('📍 Verificando estructura:');
        console.log('  - _id:', trackingData._id);
        console.log('  - status:', trackingData.status);
        console.log('  - pickupLocation:', trackingData.pickupLocation);
        console.log('  - deliveryLocation:', trackingData.deliveryLocation);
        
        setDeliveryData(trackingData);
        setHasValidData(true);
        
        // Actualizar el manager con el estado real
        if (trackingData.status) {
          await ActiveDeliveryManager.updateActiveDeliveryStatus(trackingData.status);
        }
      } else {
        throw new Error(response.data.error?.message || 'No se pudieron cargar los datos del delivery');
      }
    } catch (error) {
      console.error('❌ Error cargando delivery data:', error);
      
      let errorMessage = 'No se pudieron cargar los datos del delivery';
      if (error.response?.status === 404) {
        errorMessage = 'El delivery no fue encontrado. Puede haber sido completado o cancelado.';
      } else if (error.response?.status === 403) {
        errorMessage = 'No tienes acceso a este delivery.';
      }
      
      Alert.alert(
        'Error de Carga',
        errorMessage,
        [
          { 
            text: 'Volver al Inicio', 
            onPress: () => navigation.replace('HomeDelivery') 
          }
        ]
      );
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (currentLocation && deliveryData) {
      checkAutoArrival();
      updateNavigationInfo();
    }
  }, [currentLocation, deliveryData]);

  const initializeNavigation = async () => {
    try {
      // Mantener pantalla encendida
      try {
        if (keepAwake) {
          keepAwake();
        }
      } catch (error) {
        console.log('Keep awake not available:', error.message);
      }
      
      // Solicitar permisos de ubicación
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos',
          'Necesitamos acceso a tu ubicación para la navegación',
          [{ text: 'OK', onPress: () => navigation.navigate('HomeDelivery') }]
        );
        return;
      }

      // Conectar al servicio de tiempo real
      await realTimeService.connect();
      
      // Iniciar tracking de ubicación
      startLocationTracking();
      
      // Configurar animaciones
      startPulseAnimation();
      
    } catch (error) {
      console.error('Error initializing navigation:', error);
      Alert.alert('Error', 'No se pudo inicializar la navegación');
    }
  };

  const startLocationTracking = async () => {
    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000, // Cada 2 segundos
          distanceInterval: 10, // O cada 10 metros
        },
        (location) => {
          updateCurrentLocation(location);
        }
      );

      setLocationSubscription(subscription);
      setIsTracking(true);
      
      console.log('✅ Location tracking started');
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  };

  const updateCurrentLocation = async (location) => {
    const newLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: new Date().toISOString()
    };

    setCurrentLocation(newLocation);

    // Actualizar ubicación en el backend (con throttling)
    await updateDeliveryLocation(newLocation);
  };

  const updateDeliveryLocation = async (location) => {
    try {
      // Enhanced validation with better error handling
      if (!hasValidData || !deliveryData || !deliveryData._id) {
        console.warn('⚠️ Skipping location update: invalid delivery data', {
          hasValidData,
          hasDeliveryData: !!deliveryData,
          hasId: !!deliveryData?._id
        });
        return;
      }

      // Validate location data structure
      if (!location?.latitude || !location?.longitude) {
        console.warn('⚠️ Skipping location update: invalid location data');
        return;
      }

      await apiClient.put(`/delivery/${deliveryData._id}/location`, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0,
        speed: location.speed || 0,
        heading: location.heading || 0
      });

      // Only emit if the function exists and data is valid
      if (typeof emitLocationUpdate === 'function' && deliveryData.status) {
        emitLocationUpdate(location, deliveryData.status);
      }
    } catch (error) {
      console.error('❌ Error updating delivery location:', error);
      // Don't show alert for location updates to avoid spamming user
    }
  };

  const checkAutoArrival = () => {
    if (!autoArrivalCheck || !currentLocation || !deliveryData) return;

    const currentWaypoint = getNextWaypoint(
      deliveryData.status,
      deliveryData.pickupLocation?.coordinates,
      deliveryData.deliveryLocation?.coordinates
    );

    if (!currentWaypoint) return;

    const hasArrived = checkArrival(currentLocation, currentWaypoint.coordinates, 30);
    
    if (hasArrived) {
      showArrivalNotification(currentWaypoint.type);
    }
  };

  const showArrivalNotification = (type) => {
    const message = type === 'pickup' 
      ? '¡Has llegado al restaurante! ¿Confirmar llegada?'
      : '¡Has llegado al destino! ¿Confirmar llegada?';

    Alert.alert(
      'Llegada detectada',
      message,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Sí', onPress: () => handleNextAction() }
      ]
    );

    // Desactivar auto-detección temporalmente
    setAutoArrivalCheck(false);
    setTimeout(() => setAutoArrivalCheck(true), 30000); // 30 segundos
  };

  const updateNavigationInfo = () => {
    if (!currentLocation || !deliveryData) return;

    const currentWaypoint = getNextWaypoint(
      deliveryData.status,
      deliveryData.pickupLocation?.coordinates,
      deliveryData.deliveryLocation?.coordinates
    );

    if (!currentWaypoint) return;

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      currentWaypoint.coordinates[1],
      currentWaypoint.coordinates[0]
    );

    const eta = calculateETA(distance);

    setNavigationInfo({
      distance,
      duration: eta * 60, // convertir minutos a segundos
      targetType: currentWaypoint.type,
      targetAddress: currentWaypoint.address
    });
  };

  const handleNextAction = async () => {
    // Enhanced validation with better error messaging
    if (!hasValidData || !deliveryData || !deliveryData._id) {
      console.error('❌ Error: deliveryData o _id es null en handleNextAction', {
        hasValidData,
        hasDeliveryData: !!deliveryData,
        hasId: !!deliveryData?._id
      });
      
      Alert.alert(
        'Error de Estado', 
        'No se pudo actualizar el estado. Los datos de delivery no están disponibles. La pantalla se recargará.',
        [
          { 
            text: 'Recargar', 
            onPress: () => {
              if (trackingId) {
                loadDeliveryData();
              } else {
                navigation.replace('HomeDelivery');
              }
            }
          }
        ]
      );
      return;
    }

    const nextAction = getNextAction(deliveryData.status);
    
    if (!nextAction) {
      Alert.alert('Completado', 'Entrega completada exitosamente');
      // Clear active delivery and go home
      await ActiveDeliveryManager.clearActiveDelivery();
      navigation.replace('HomeDelivery');
      return;
    }

    try {
      console.log('🚚 Sending status update:');
      console.log('  - Delivery ID:', deliveryData._id);
      console.log('  - Current status:', deliveryData.status);
      console.log('  - Next action:', nextAction);
      console.log('  - Payload:', {
        status: nextAction.action,
        notes: `Estado actualizado desde navegación: ${nextAction.label}`
      });
      
      const response = await apiClient.put(`/delivery/${deliveryData._id}/status`, {
        status: nextAction.action,
        notes: `Estado actualizado desde navegación: ${nextAction.label}`
      });

      if (response.data.success) {
        setDeliveryData(prev => ({
          ...prev,
          status: nextAction.action
        }));

        // Actualizar el manager de entrega activa
        await ActiveDeliveryManager.updateActiveDeliveryStatus(nextAction.action);

        // Only emit if the function exists
        if (typeof emitStatusUpdate === 'function') {
          emitStatusUpdate(nextAction.action, { 
            manual: true, 
            notes: `Estado actualizado desde navegación: ${nextAction.label}` 
          });
        }

        // Animar cambio de estado
        Animated.sequence([
          Animated.timing(statusAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(statusAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          })
        ]).start();

        // Si se completó la entrega, mostrar mensaje y regresar al mapa
        if (nextAction.action === DELIVERY_STATES.DELIVERED) {
          // Limpiar entrega activa (el manager ya lo hace automáticamente)
          console.log('✅ Entrega completada, storage limpiado automáticamente');
          
          Alert.alert(
            '¡Entrega Completada!',
            'Has completado exitosamente la entrega. ¡Excelente trabajo!',
            [
              {
                text: 'Continuar',
                onPress: () => {
                  // Regresar al mapa principal después de un breve delay
                  setTimeout(() => {
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'DeliveryMap' }],
                    });
                  }, 1000);
                }
              }
            ]
          );
        }

      } else {
        Alert.alert('Error', 'No se pudo actualizar el estado');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        config: error.config?.url
      });
      
      // Si es un error de transición de estado, refrescar automáticamente
      if (error.response?.data?.error?.code === 'INVALID_STATUS_TRANSITION') {
        console.log('🔄 Error de transición detectado, refrescando estado...');
        await refreshDeliveryStatus();
        
        Alert.alert(
          'Estado Sincronizado',
          'El estado se ha actualizado. Por favor intenta la acción nuevamente.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      let errorMessage = 'Error al actualizar el estado';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.status === 400) {
        errorMessage = 'Error de validación - verifica los datos del delivery';
      } else if (error.response?.status === 401) {
        errorMessage = 'Token de autenticación inválido';
      } else if (error.response?.status === 403) {
        errorMessage = 'No tienes permisos para esta acción';
      }
      
      Alert.alert('Error', errorMessage);
    }
  };

  const handleContactRestaurant = () => {
    Alert.alert(
      'Contactar Restaurante',
      '¿Qué quieres hacer?',
      [
        {
          text: 'Llamar',
          onPress: () => {
            // Simulamos llamada al restaurante
            Alert.alert('Llamando...', 'En una implementación real, esto abriría el marcador telefónico');
          }
        },
        {
          text: 'Mensaje',
          onPress: () => {
            Alert.alert('Mensaje', 'Funcionalidad de mensajería próximamente');
          }
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  const handleContactCustomer = () => {
    Alert.alert(
      'Contactar Cliente',
      '¿Qué quieres hacer?',
      [
        {
          text: 'Llamar',
          onPress: () => {
            Alert.alert('Llamando...', 'En una implementación real, esto abriría el marcador telefónico');
          }
        },
        {
          text: 'Mensaje',
          onPress: () => {
            Alert.alert('Mensaje', 'Funcionalidad de mensajería próximamente');
          }
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  const handleEmergencyContact = () => {
    Alert.alert(
      'Contacto de Emergencia',
      '¿Necesitas ayuda? Esta función se usa solo en caso de emergencia.',
      [
        {
          text: 'Llamar Soporte',
          onPress: () => {
            Alert.alert('Soporte', 'En una implementación real, esto llamaría al número de soporte de la empresa');
          }
        },
        {
          text: 'Reportar Problema',
          onPress: () => {
            Alert.alert('Problema reportado', 'Tu reporte ha sido enviado al equipo de soporte');
          }
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const cleanup = () => {
    try {
      if (allowSleepAgain) {
        allowSleepAgain();
      }
    } catch (error) {
      console.log('Allow sleep again not available:', error.message);
    }
    
    if (locationSubscription) {
      locationSubscription.remove();
    }
    
    realTimeService.disconnect();
  };

  // Pantalla de carga si estamos cargando datos
  if (isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingTitle}>Cargando Delivery...</Text>
        <Text style={styles.loadingSubtitle}>Obteniendo información de la ruta</Text>
      </View>
    );
  }

  // Si no hay datos después de cargar, mostrar error
  if (!deliveryData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorSubtitle}>No se pudieron cargar los datos del delivery</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.navigate('HomeDelivery')}
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getCurrentWaypoint = () => {
    return getNextWaypoint(
      deliveryData?.status,
      deliveryData?.pickupLocation?.coordinates,
      deliveryData?.deliveryLocation?.coordinates
    );
  };

  const getMapRegion = () => {
    const waypoint = getCurrentWaypoint();
    
    if (currentLocation && waypoint) {
      // Calcular región que incluya ambos puntos
      const lat1 = currentLocation.latitude;
      const lon1 = currentLocation.longitude;
      const lat2 = waypoint.coordinates[1];
      const lon2 = waypoint.coordinates[0];

      const minLat = Math.min(lat1, lat2);
      const maxLat = Math.max(lat1, lat2);
      const minLon = Math.min(lon1, lon2);
      const maxLon = Math.max(lon1, lon2);

      const latDelta = (maxLat - minLat) * 1.5 || 0.01;
      const lonDelta = (maxLon - minLon) * 1.5 || 0.01;

      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLon + maxLon) / 2,
        latitudeDelta: Math.max(latDelta, 0.01),
        longitudeDelta: Math.max(lonDelta, 0.01),
      };
    }

    return {
      latitude: currentLocation?.latitude || waypoint?.coordinates[1] || -18.5,
      longitude: currentLocation?.longitude || waypoint?.coordinates[0] || -69.5,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  const nextAction = getNextAction(deliveryData?.status);
  const currentWaypoint = getCurrentWaypoint();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* Mapa */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={getMapRegion()}
        showsUserLocation
        followsUserLocation
        showsCompass
        showsTraffic
        mapType="standard"
      >
        {/* Marcador del destino actual */}
        {currentWaypoint && (
          <Marker
            coordinate={{
              latitude: currentWaypoint.coordinates[1],
              longitude: currentWaypoint.coordinates[0]
            }}
            title={currentWaypoint.address}
            description={`Destino: ${currentWaypoint.type === 'pickup' ? 'Restaurante' : 'Cliente'}`}
            pinColor={currentWaypoint.type === 'pickup' ? '#2196F3' : '#FF6B6B'}
          />
        )}

        {/* Marcador de ubicación actual personalizado */}
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Animated.View style={[styles.currentLocationMarker, { transform: [{ scale: pulseAnim }] }]}>
              <View style={styles.locationDot} />
            </Animated.View>
          </Marker>
        )}
      </MapView>

      {/* Header con información de estado */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('HomeDelivery')}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.statusContainer}>
          <Animated.View style={[styles.statusIndicator, { opacity: statusAnim }]}>
            <Text style={styles.statusText}>
              {deliveryData?.status ? DELIVERY_STATES[deliveryData.status.toUpperCase()] || deliveryData.status : 'Cargando...'}
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* Panel de navegación */}
      <View style={styles.navigationPanel}>
        {navigationInfo.distance > 0 && (
          <View style={styles.navigationInfo}>
            <View style={styles.navigationRow}>
              <Ionicons name="location" size={20} color="#FF6B6B" />
              <Text style={styles.navigationText}>
                {formatDistance(navigationInfo.distance)} • {formatDuration(navigationInfo.duration)}
              </Text>
            </View>
            
            <Text style={styles.destinationText}>
              Hacia: {navigationInfo.targetAddress}
            </Text>
          </View>
        )}

        {/* Botón de acción principal */}
        {nextAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: nextAction.color }]}
            onPress={handleNextAction}
          >
            <Text style={styles.actionButtonText}>{nextAction.label}</Text>
          </TouchableOpacity>
        )}

        {/* Botones de acción secundarios */}
        <View style={styles.secondaryActions}>
          {(deliveryData?.status === DELIVERY_STATES.ASSIGNED || 
            deliveryData?.status === DELIVERY_STATES.HEADING_TO_PICKUP ||
            deliveryData?.status === DELIVERY_STATES.AT_PICKUP) && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleContactRestaurant()}
            >
              <Ionicons name="call-outline" size={18} color="#2196F3" />
              <Text style={styles.secondaryButtonText}>Llamar Restaurante</Text>
            </TouchableOpacity>
          )}

          {(deliveryData?.status === DELIVERY_STATES.PICKED_UP || 
            deliveryData?.status === DELIVERY_STATES.HEADING_TO_DELIVERY ||
            deliveryData?.status === DELIVERY_STATES.AT_DELIVERY) && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleContactCustomer()}
            >
              <Ionicons name="call-outline" size={18} color="#4CAF50" />
              <Text style={styles.secondaryButtonText}>Llamar Cliente</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleEmergencyContact()}
          >
            <Ionicons name="alert-circle-outline" size={18} color="#FF6B6B" />
            <Text style={styles.secondaryButtonText}>Emergencia</Text>
          </TouchableOpacity>
        </View>

        {/* Estado de tracking */}
        <View style={styles.trackingStatus}>
          <View style={[styles.trackingDot, { backgroundColor: isTracking ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.trackingText}>
            {isTracking ? 'Ubicación activa' : 'Sin ubicación'}
          </Text>
        </View>

        {/* Detalles del pedido expandibles */}
        <TouchableOpacity 
          style={styles.orderDetailsToggle}
          onPress={() => setShowOrderDetails(!showOrderDetails)}
        >
          <View style={styles.orderDetailsHeader}>
            <Ionicons name="receipt-outline" size={20} color="#666" />
            <Text style={styles.orderDetailsTitle}>Detalles del pedido</Text>
            <Ionicons 
              name={showOrderDetails ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color="#666" 
            />
          </View>
        </TouchableOpacity>
        
        {showOrderDetails && (
          <View style={styles.orderDetails}>
            <View style={styles.orderDetailRow}>
              <Ionicons name="restaurant-outline" size={16} color="#FF6B6B" />
              <View style={styles.orderDetailContent}>
                <Text style={styles.orderDetailLabel}>Recogida</Text>
                <Text style={styles.orderDetailText}>
                  {deliveryData.pickupLocation?.address || 'Restaurante'}
                </Text>
              </View>
            </View>
            
            <View style={styles.orderDetailRow}>
              <Ionicons name="home-outline" size={16} color="#4CAF50" />
              <View style={styles.orderDetailContent}>
                <Text style={styles.orderDetailLabel}>Entrega</Text>  
                <Text style={styles.orderDetailText}>
                  {deliveryData.deliveryLocation?.address || 'Cliente'}
                </Text>
              </View>
            </View>
            
            <View style={styles.orderDetailRow}>
              <Ionicons name="car-outline" size={16} color="#2196F3" />
              <View style={styles.orderDetailContent}>
                <Text style={styles.orderDetailLabel}>Distancia estimada</Text>
                <Text style={styles.orderDetailText}>
                  {navigationInfo.distance > 0 ? formatDistance(navigationInfo.distance) : 'Calculando...'}
                </Text>
              </View>
            </View>

            <View style={styles.orderDetailRow}>
              <Ionicons name="time-outline" size={16} color="#FF9800" />
              <View style={styles.orderDetailContent}>
                <Text style={styles.orderDetailLabel}>Tiempo estimado</Text>
                <Text style={styles.orderDetailText}>
                  {navigationInfo.duration > 0 ? formatDuration(navigationInfo.duration * 60) : 'Calculando...'}
                </Text>
              </View>
            </View>

            {deliveryData.orderId && (
              <View style={styles.orderDetailRow}>
                <Ionicons name="document-text-outline" size={16} color="#9C27B0" />
                <View style={styles.orderDetailContent}>
                  <Text style={styles.orderDetailLabel}>Número de pedido</Text>
                  <Text style={styles.orderDetailText}>#{deliveryData.orderId}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
  
  } catch (error) {
    console.error('🚨 Critical error in DeliveryNavigationScreen:', error);
    ErrorInterceptor.logObjectAccess(error, 'message', 'DeliveryNavigationScreen-catch');
    
    // Return error screen
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error de Navegación</Text>
        <Text style={styles.errorSubtitle}>
          Ocurrió un error al cargar la pantalla de navegación.
          {'\n\n'}Error: {error.message}
        </Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.replace('HomeDelivery')}
        >
          <Text style={styles.backButtonText}>Volver al Inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }
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
  },
  backButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
  },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
  },
  statusIndicator: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  navigationPanel: {
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
  navigationInfo: {
    marginBottom: 15,
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  navigationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  destinationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 30,
  },
  actionButton: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  trackingText: {
    fontSize: 12,
    color: '#666',
  },
  currentLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196F3',
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Estilos para detalles del pedido
  orderDetailsToggle: {
    marginTop: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  orderDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderDetailsTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 8,
  },
  orderDetails: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderDetailContent: {
    flex: 1,
    marginLeft: 12,
  },
  orderDetailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 2,
  },
  orderDetailText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // Estilos para botones secundarios
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
    fontWeight: '500',
  },
  // Estilos para pantallas de carga y error
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