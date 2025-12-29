/**
 * DeliveryNavigationScreen - Production Version
 * Flujo completo de delivery con protección contra errores undefined
 * Arquitectura: React Native + Expo + Socket.IO + MongoDB
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Servicios y utilidades existentes
import ActiveDeliveryManager from '../utils/activeDeliveryManager';
import { useDeliveryNotifications } from '../hooks/useDeliveryNotifications';
import ErrorInterceptor from '../utils/ErrorInterceptor';
import DeliveryDataValidator from '../utils/DeliveryDataValidator';
import { apiClient } from '../api/apiClient';
import realTimeService from '../services/realTimeService';

// Constantes de navegación y estados
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

// Manejo seguro de keep-awake
let keepAwake, allowSleepAgain;
try {
  const keepAwakeModule = require('expo-keep-awake');
  keepAwake = keepAwakeModule.keepAwake || (() => console.log('⚠️ Keep awake not available'));
  allowSleepAgain = keepAwakeModule.allowSleepAgain || (() => console.log('⚠️ Allow sleep not available'));
} catch (error) {
  keepAwake = () => console.log('⚠️ Keep awake not available');
  allowSleepAgain = () => console.log('⚠️ Allow sleep not available');
}

/**
 * Componente principal de navegación de delivery
 * Maneja todo el flujo desde asignación hasta entrega
 */
const DeliveryNavigationScreen = ({ route }) => {
  const navigation = useNavigation();
  const mapRef = useRef();

  // ==================== EXTRACCIÓN SEGURA DE PARÁMETROS ====================
  // Protección completa contra undefined con múltiples capas de validación
  const safeRoute = route || {};
  const safeParams = safeRoute.params || {};
  
  // Logging detallado para debugging
  console.log('🚀 DeliveryNavigationScreen iniciando con parámetros:', {
    hasRoute: !!route,
    hasParams: !!safeParams,
    paramKeys: Object.keys(safeParams)
  });

  // Validación robusta de parámetros
  const paramValidation = DeliveryDataValidator.validateNavigationParams(safeParams);
  
  // Extracción segura con fallbacks
  const trackingId = safeParams.trackingId || safeParams._id || paramValidation.params?.trackingId || null;
  const initialDeliveryData = safeParams.deliveryTracking || paramValidation.params?.deliveryTracking || null;
  const orderId = safeParams.orderId || initialDeliveryData?.orderId || paramValidation.params?.orderId || null;

  // ==================== ESTADOS DEL COMPONENTE ====================
  // Estados principales de delivery
  const [deliveryData, setDeliveryData] = useState(initialDeliveryData);
  const [deliveryStatus, setDeliveryStatus] = useState(initialDeliveryData?.status || DELIVERY_STATES.ASSIGNED);
  const [isLoading, setIsLoading] = useState(!initialDeliveryData);
  const [error, setError] = useState(null);

  // Estados de ubicación y navegación
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [route, setRoute] = useState(null);
  const [navigationInfo, setNavigationInfo] = useState({
    distance: 0,
    duration: 0,
    targetAddress: '',
    targetType: 'pickup'
  });

  // Estados de UI
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [autoArrivalCheck, setAutoArrivalCheck] = useState(true);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(Date.now());

  // Animaciones
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const statusAnim = useRef(new Animated.Value(0)).current;

  // ==================== HOOK DE NOTIFICACIONES ====================
  const { emitStatusUpdate, emitLocationUpdate } = useDeliveryNotifications(
    orderId, 
    deliveryData?.deliveryPersonId,
    (newStatus, data) => {
      // Callback cuando se recibe un cambio de estado
      console.log('📱 Notificación de cambio de estado recibida:', newStatus);
      handleStatusChange(newStatus);
    }
  );

  // ==================== INICIALIZACIÓN ====================
  useEffect(() => {
    initializeDelivery();
    return () => cleanup();
  }, []);

  // Sincronización de estado cuando cambia deliveryData
  useEffect(() => {
    if (deliveryData?.status && deliveryData.status !== deliveryStatus) {
      setDeliveryStatus(deliveryData.status);
    }
  }, [deliveryData]);

  // Auto-check de llegada
  useEffect(() => {
    if (currentLocation && deliveryData && autoArrivalCheck) {
      checkAutoArrival();
    }
  }, [currentLocation, deliveryData, autoArrivalCheck]);

  // Actualización de información de navegación
  useEffect(() => {
    if (currentLocation && deliveryData) {
      updateNavigationInfo();
    }
  }, [currentLocation, deliveryData, deliveryStatus]);

  /**
   * Inicialización completa del delivery
   * Maneja permisos, carga de datos y configuración inicial
   */
  const initializeDelivery = async () => {
    try {
      console.log('🔧 Inicializando delivery navigation...');
      
      // Validar datos mínimos requeridos
      if (!trackingId && !initialDeliveryData) {
        throw new Error('No se proporcionaron datos de delivery válidos');
      }

      // Mantener pantalla encendida durante navegación
      keepAwake();

      // Solicitar permisos de ubicación
      const locationPermission = await requestLocationPermission();
      if (!locationPermission) {
        throw new Error('Se requieren permisos de ubicación para continuar');
      }

      // Conectar servicios en tiempo real
      await realTimeService.connect();

      // Cargar o actualizar datos del delivery
      if (!deliveryData && trackingId) {
        await loadDeliveryData();
      } else if (deliveryData) {
        await refreshDeliveryStatus();
      }

      // Iniciar tracking de ubicación
      await startLocationTracking();

      // Iniciar animaciones
      startAnimations();

      console.log('✅ Delivery navigation inicializado correctamente');
    } catch (error) {
      console.error('❌ Error en inicialización:', error);
      setError(error.message);
      
      // Ofrecer retry o salir
      Alert.alert(
        'Error de Inicialización',
        error.message,
        [
          { text: 'Reintentar', onPress: () => initializeDelivery() },
          { text: 'Salir', onPress: () => navigation.navigate('HomeDelivery'), style: 'cancel' }
        ]
      );
    }
  };

  /**
   * Solicitar permisos de ubicación
   */
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Permisos de ubicación denegados');
        return false;
      }
      
      // También solicitar permisos de background si es posible
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      console.log('📍 Permisos de ubicación background:', bgStatus);
      
      return true;
    } catch (error) {
      console.error('❌ Error solicitando permisos:', error);
      return false;
    }
  };

  /**
   * Cargar datos del delivery desde el servidor
   */
  const loadDeliveryData = async () => {
    try {
      setIsLoading(true);
      console.log('📦 Cargando datos del delivery:', trackingId);

      const response = await apiClient.get(`/delivery/${trackingId}`);
      
      if (response.data?.success && response.data?.data?.deliveryTracking) {
        const trackingData = response.data.data.deliveryTracking;
        
        // Validar estructura de datos
        const validation = DeliveryDataValidator.validateDeliveryData(trackingData);
        if (!validation.isValid) {
          console.warn('⚠️ Datos de delivery incompletos:', validation.errors);
          // Intentar reparar datos
          const repairedData = DeliveryDataValidator.repairDeliveryData(trackingData);
          if (repairedData) {
            setDeliveryData(repairedData);
            setDeliveryStatus(repairedData.status);
          } else {
            throw new Error('Datos de delivery inválidos');
          }
        } else {
          setDeliveryData(trackingData);
          setDeliveryStatus(trackingData.status);
        }

        // Actualizar manager local
        await ActiveDeliveryManager.updateActiveDeliveryStatus(trackingData.status);
        
        console.log('✅ Datos de delivery cargados correctamente');
      } else {
        throw new Error('No se pudieron obtener los datos del delivery');
      }
    } catch (error) {
      console.error('❌ Error cargando delivery data:', error);
      setError('No se pudieron cargar los datos del delivery');
      
      // Si es 404, el delivery no existe o fue completado
      if (error.response?.status === 404) {
        Alert.alert(
          'Delivery No Encontrado',
          'Este delivery no existe o ya fue completado.',
          [{ text: 'Volver', onPress: () => navigation.replace('HomeDelivery') }]
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refrescar estado del delivery
   */
  const refreshDeliveryStatus = async () => {
    try {
      if (!deliveryData?._id) return;
      
      console.log('🔄 Refrescando estado del delivery...');
      const response = await apiClient.get(`/delivery/${deliveryData._id}`);
      
      if (response.data?.success) {
        const updatedData = response.data.data.deliveryTracking;
        setDeliveryData(prev => ({ ...prev, ...updatedData }));
        setDeliveryStatus(updatedData.status);
        
        await ActiveDeliveryManager.updateActiveDeliveryStatus(updatedData.status);
      }
    } catch (error) {
      console.error('❌ Error refrescando estado:', error);
    }
  };

  /**
   * Iniciar tracking de ubicación en tiempo real
   */
  const startLocationTracking = async () => {
    try {
      // Obtener ubicación inicial
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation
      });
      
      updateCurrentLocation(initialLocation);

      // Suscribirse a actualizaciones de ubicación
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000, // Cada 3 segundos
          distanceInterval: 10, // O cada 10 metros
        },
        (location) => {
          updateCurrentLocation(location);
        }
      );

      setLocationSubscription(subscription);
      setIsTracking(true);
      
      console.log('✅ Tracking de ubicación iniciado');
    } catch (error) {
      console.error('❌ Error iniciando tracking:', error);
      setError('No se pudo iniciar el seguimiento de ubicación');
    }
  };

  /**
   * Actualizar ubicación actual y sincronizar con backend
   */
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

    // Throttling para no saturar el servidor
    const now = Date.now();
    if (now - lastLocationUpdate > 5000) { // Actualizar cada 5 segundos
      setLastLocationUpdate(now);
      await syncLocationWithBackend(newLocation);
    }
  };

  /**
   * Sincronizar ubicación con el backend
   */
  const syncLocationWithBackend = async (location) => {
    try {
      if (!deliveryData?._id) return;

      await apiClient.put(`/delivery/${deliveryData._id}/location`, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 0,
        speed: location.speed || 0,
        heading: location.heading || 0
      });

      // Emitir actualización por socket
      if (emitLocationUpdate) {
        emitLocationUpdate(location, deliveryStatus);
      }
    } catch (error) {
      console.error('❌ Error sincronizando ubicación:', error);
      // No mostrar alerta para no molestar al usuario
    }
  };

  /**
   * Actualizar información de navegación
   */
  const updateNavigationInfo = () => {
    if (!currentLocation || !deliveryData) return;

    const waypoint = getNextWaypoint(
      deliveryStatus,
      deliveryData.pickupLocation?.coordinates,
      deliveryData.deliveryLocation?.coordinates
    );

    if (!waypoint) return;

    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      waypoint.coordinates[1],
      waypoint.coordinates[0]
    );

    const eta = calculateETA(distance);

    setNavigationInfo({
      distance,
      duration: eta,
      targetAddress: waypoint.address || 'Destino',
      targetType: waypoint.type
    });
  };

  /**
   * Verificar llegada automática a destino
   */
  const checkAutoArrival = () => {
    if (!autoArrivalCheck || !currentLocation || !deliveryData) return;

    const waypoint = getNextWaypoint(
      deliveryStatus,
      deliveryData.pickupLocation?.coordinates,
      deliveryData.deliveryLocation?.coordinates
    );

    if (!waypoint) return;

    const hasArrived = checkArrival(
      currentLocation, 
      waypoint.coordinates, 
      50, // Radio de 50 metros
      deliveryStatus // Pasar el estado actual para evitar spam
    );
    
    if (hasArrived) {
      // En lugar de alerta molesta, solo actualizar estado automáticamente
      console.log('📍 Llegada detectada automáticamente, cambiando estado...');
      
      // Cambiar estado automáticamente en lugar de mostrar alerta
      const nextAction = getNextAction(deliveryStatus);
      if (nextAction && (
        nextAction.action === 'at_pickup' || 
        nextAction.action === 'at_delivery'
      )) {
        handleStatusChange(nextAction.action);
      }
      
      // Desactivar temporalmente para evitar múltiples detecciones
      setAutoArrivalCheck(false);
      setTimeout(() => setAutoArrivalCheck(true), 60000); // 1 minuto
    }
  };

  /**
   * Función de notificación de llegada deshabilitada 
   * Ahora se cambia el estado automáticamente
   */
  const showArrivalNotification = (type) => {
    // Ya no mostramos alertas molestas
    console.log('📍 Llegada procesada automáticamente, tipo:', type);
  };

  /**
   * Manejar cambio de estado del delivery
   */
  const handleStatusChange = async (newStatus) => {
    try {
      console.log('🔄 Cambiando estado de', deliveryStatus, 'a', newStatus);
      
      // Actualizar estado local inmediatamente
      setDeliveryStatus(newStatus);
      setDeliveryData(prev => ({ ...prev, status: newStatus }));

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

      // Actualizar manager local
      await ActiveDeliveryManager.updateActiveDeliveryStatus(newStatus);

      // Verificar si se completó el delivery
      if (newStatus === DELIVERY_STATES.DELIVERED) {
        handleDeliveryCompleted();
      }
    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
    }
  };

  /**
   * Ejecutar siguiente acción en el flujo de delivery
   */
  const handleNextAction = async () => {
    try {
      if (!deliveryData?._id) {
        Alert.alert('Error', 'No hay datos de delivery disponibles');
        return;
      }

      const nextAction = getNextAction(deliveryStatus);
      
      if (!nextAction) {
        console.log('✅ No hay más acciones, delivery completado');
        handleDeliveryCompleted();
        return;
      }

      console.log('🚀 Ejecutando acción:', nextAction.label);

      // Mostrar confirmación para acciones críticas
      if (nextAction.requiresConfirmation) {
        Alert.alert(
          'Confirmar Acción',
          `¿Confirmar ${nextAction.label}?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Confirmar', onPress: () => executeStatusUpdate(nextAction) }
          ]
        );
      } else {
        await executeStatusUpdate(nextAction);
      }
    } catch (error) {
      console.error('❌ Error en handleNextAction:', error);
      Alert.alert('Error', 'No se pudo actualizar el estado');
    }
  };

  /**
   * Ejecutar actualización de estado en el backend
   */
  const executeStatusUpdate = async (action) => {
    try {
      const response = await apiClient.put(`/delivery/${deliveryData._id}/status`, {
        status: action.action,
        notes: `Estado actualizado: ${action.label}`,
        location: currentLocation
      });

      if (response.data?.success) {
        // Actualizar estado local
        await handleStatusChange(action.action);

        // Emitir notificación
        if (emitStatusUpdate) {
          emitStatusUpdate(action.action, { 
            manual: true, 
            notes: action.label 
          });
        }

        // Mostrar feedback al usuario
        Alert.alert(
          '✅ Estado Actualizado',
          action.label,
          [{ text: 'OK' }],
          { cancelable: true }
        );
      } else {
        throw new Error('La actualización de estado falló');
      }
    } catch (error) {
      console.error('❌ Error actualizando estado:', error);
      
      // Manejar errores específicos
      if (error.response?.data?.error?.code === 'INVALID_STATUS_TRANSITION') {
        Alert.alert(
          'Transición Inválida',
          'El estado actual no permite esta transición. Refrescando...',
          [{ text: 'OK', onPress: () => refreshDeliveryStatus() }]
        );
      } else {
        Alert.alert('Error', error.response?.data?.error?.message || 'Error al actualizar estado');
      }
    }
  };

  /**
   * Manejar finalización del delivery
   */
  const handleDeliveryCompleted = async () => {
    try {
      console.log('🎉 Delivery completado exitosamente');
      
      // Limpiar delivery activo
      await ActiveDeliveryManager.clearActiveDelivery();
      
      // Detener tracking
      if (locationSubscription) {
        locationSubscription.remove();
      }
      
      // Permitir que la pantalla se apague
      allowSleepAgain();
      
      // Desconectar servicios
      realTimeService.disconnect();
      
      // Mostrar mensaje de éxito
      Alert.alert(
        '🎉 ¡Entrega Completada!',
        'Has completado exitosamente la entrega. ¡Excelente trabajo!',
        [
          {
            text: 'Continuar',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'HomeDelivery' }],
              });
            }
          }
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('❌ Error completando delivery:', error);
    }
  };

  /**
   * Limpiar recursos al desmontar componente
   */
  const cleanup = () => {
    try {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      allowSleepAgain();
      realTimeService.disconnect();
    } catch (error) {
      console.error('Error en cleanup:', error);
    }
  };

  /**
   * Iniciar animaciones
   */
  const startAnimations = () => {
    // Animación de pulso para ubicación actual
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

  /**
   * Obtener región del mapa basada en ubicación actual y destino
   */
  const getMapRegion = () => {
    if (!currentLocation) {
      return {
        latitude: -18.5,
        longitude: -69.5,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    const waypoint = getNextWaypoint(
      deliveryStatus,
      deliveryData?.pickupLocation?.coordinates,
      deliveryData?.deliveryLocation?.coordinates
    );

    if (waypoint) {
      const lat1 = currentLocation.latitude;
      const lon1 = currentLocation.longitude;
      const lat2 = waypoint.coordinates[1];
      const lon2 = waypoint.coordinates[0];

      return {
        latitude: (lat1 + lat2) / 2,
        longitude: (lon1 + lon2) / 2,
        latitudeDelta: Math.abs(lat1 - lat2) * 1.5 || 0.05,
        longitudeDelta: Math.abs(lon1 - lon2) * 1.5 || 0.05,
      };
    }

    return {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  // ==================== RENDERIZADO CONDICIONAL ====================
  
  // Pantalla de error
  if (error && !deliveryData) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle" size={80} color="#f44336" />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.replace('HomeDelivery')}
          >
            <Text style={styles.buttonText}>Volver al Inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Pantalla de carga
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E60023" />
          <Text style={styles.loadingText}>Cargando delivery...</Text>
        </View>
      </View>
    );
  }

  // Datos requeridos para renderizar
  const currentWaypoint = getNextWaypoint(
    deliveryStatus,
    deliveryData?.pickupLocation?.coordinates,
    deliveryData?.deliveryLocation?.coordinates
  );
  
  const nextAction = getNextAction(deliveryStatus);

  // ==================== RENDERIZADO PRINCIPAL ====================
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* Mapa principal */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={getMapRegion()}
        showsUserLocation={true}
        followsUserLocation={true}
        showsCompass={true}
        showsTraffic={true}
        mapType="standard"
      >
        {/* Marcador del destino actual */}
        {currentWaypoint && (
          <Marker
            coordinate={{
              latitude: currentWaypoint.coordinates[1],
              longitude: currentWaypoint.coordinates[0]
            }}
            title={currentWaypoint.type === 'pickup' ? 'Restaurante' : 'Cliente'}
            description={currentWaypoint.address}
            pinColor={currentWaypoint.type === 'pickup' ? '#2196F3' : '#4CAF50'}
          />
        )}

        {/* Marcador personalizado de ubicación actual */}
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

        {/* Ruta si está disponible */}
        {route && (
          <Polyline
            coordinates={route}
            strokeColor="#E60023"
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Header con estado */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            Alert.alert(
              'Salir de Navegación',
              '¿Estás seguro de que quieres salir? El delivery está en progreso.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', onPress: () => navigation.navigate('HomeDelivery') }
              ]
            );
          }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Animated.View style={[styles.statusContainer, { opacity: Animated.add(0.5, statusAnim) }]}>
          <View style={[styles.statusBadge, { backgroundColor: DELIVERY_STATE_LABELS[deliveryStatus]?.color || '#666' }]}>
            <Text style={styles.statusText}>
              {DELIVERY_STATE_LABELS[deliveryStatus]?.label || deliveryStatus}
            </Text>
          </View>
        </Animated.View>

        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setShowOrderDetails(!showOrderDetails)}
        >
          <Ionicons name="menu" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Panel de navegación */}
      <View style={styles.navigationPanel}>
        {/* Información de navegación */}
        {navigationInfo.distance > 0 && (
          <View style={styles.navigationInfo}>
            <View style={styles.navigationRow}>
              <Ionicons 
                name={navigationInfo.targetType === 'pickup' ? 'restaurant' : 'home'} 
                size={20} 
                color="#E60023" 
              />
              <Text style={styles.navigationText}>
                {formatDistance(navigationInfo.distance)} • {formatDuration(navigationInfo.duration)}
              </Text>
            </View>
            <Text style={styles.destinationText}>
              {navigationInfo.targetType === 'pickup' ? 'Hacia restaurante' : 'Hacia cliente'}: {navigationInfo.targetAddress}
            </Text>
          </View>
        )}

        {/* Botón de acción principal */}
        {nextAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: nextAction.color }]}
            onPress={handleNextAction}
          >
            <Ionicons name={nextAction.icon} size={24} color="#fff" />
            <Text style={styles.actionButtonText}>{nextAction.label}</Text>
          </TouchableOpacity>
        )}

        {/* Acciones secundarias */}
        <View style={styles.secondaryActions}>
          {/* Contactar restaurante */}
          {(deliveryStatus === DELIVERY_STATES.ASSIGNED || 
            deliveryStatus === DELIVERY_STATES.HEADING_TO_PICKUP ||
            deliveryStatus === DELIVERY_STATES.AT_PICKUP) && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => Alert.alert('Contactar', 'Llamando al restaurante...')}
            >
              <Ionicons name="call-outline" size={18} color="#2196F3" />
              <Text style={styles.secondaryButtonText}>Restaurante</Text>
            </TouchableOpacity>
          )}

          {/* Contactar cliente */}
          {(deliveryStatus === DELIVERY_STATES.PICKED_UP || 
            deliveryStatus === DELIVERY_STATES.HEADING_TO_DELIVERY ||
            deliveryStatus === DELIVERY_STATES.AT_DELIVERY) && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => Alert.alert('Contactar', 'Llamando al cliente...')}
            >
              <Ionicons name="call-outline" size={18} color="#4CAF50" />
              <Text style={styles.secondaryButtonText}>Cliente</Text>
            </TouchableOpacity>
          )}

          {/* Emergencia */}
          <TouchableOpacity
            style={[styles.secondaryButton, styles.emergencyButton]}
            onPress={() => Alert.alert('Emergencia', 'Contactando soporte...')}
          >
            <Ionicons name="alert-circle-outline" size={18} color="#f44336" />
            <Text style={[styles.secondaryButtonText, { color: '#f44336' }]}>SOS</Text>
          </TouchableOpacity>
        </View>

        {/* Estado de tracking */}
        <View style={styles.trackingStatus}>
          <View style={[styles.trackingDot, { backgroundColor: isTracking ? '#4CAF50' : '#f44336' }]} />
          <Text style={styles.trackingText}>
            {isTracking ? 'GPS activo' : 'Sin GPS'} • {currentLocation?.accuracy ? `±${Math.round(currentLocation.accuracy)}m` : 'N/A'}
          </Text>
        </View>

        {/* Detalles del pedido (expandible) */}
        {showOrderDetails && (
          <ScrollView style={styles.orderDetails} showsVerticalScrollIndicator={false}>
            <Text style={styles.orderDetailsTitle}>Detalles del Pedido</Text>
            
            <View style={styles.detailRow}>
              <Ionicons name="document-text" size={16} color="#666" />
              <Text style={styles.detailLabel}>Pedido:</Text>
              <Text style={styles.detailValue}>#{orderId || 'N/A'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="restaurant" size={16} color="#666" />
              <Text style={styles.detailLabel}>Recoger en:</Text>
              <Text style={styles.detailValue}>{deliveryData?.pickupLocation?.address || 'Restaurante'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="home" size={16} color="#666" />
              <Text style={styles.detailLabel}>Entregar en:</Text>
              <Text style={styles.detailValue}>{deliveryData?.deliveryLocation?.address || 'Cliente'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="cash" size={16} color="#666" />
              <Text style={styles.detailLabel}>Total:</Text>
              <Text style={styles.detailValue}>RD${deliveryData?.order?.total || '0'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="card" size={16} color="#666" />
              <Text style={styles.detailLabel}>Pago:</Text>
              <Text style={styles.detailValue}>{deliveryData?.order?.paymentMethod || 'Efectivo'}</Text>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

// ==================== ESTILOS ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 100 : 80,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 15,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
  },
  backButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
  },
  menuButton: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
  },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
  },
  statusBadge: {
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
    maxHeight: '50%',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  emergencyButton: {
    borderColor: '#ffebee',
    backgroundColor: '#ffebee',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 5,
    fontWeight: '500',
  },
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
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
  orderDetails: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    maxHeight: 200,
  },
  orderDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#E60023',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DeliveryNavigationScreen;