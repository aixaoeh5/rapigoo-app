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
// FIX: Importar reemplazo seguro para mapRef.current.measure()
import SafeMapMeasurement, { useSafeMapMeasurement } from '../utils/SafeMapMeasurement';
import { diagnoseMapRef } from '../utils/MapRefDiagnostic';
import { apiClient } from '../api/apiClient';
import realTimeService from '../services/realTimeService';

// Constantes de navegación y estados con safe import
let DELIVERY_STATES, DELIVERY_STATE_LABELS, getNextWaypoint, getNextAction, checkArrival, calculateDistance, formatDistance, formatDuration, calculateETA;

try {
  const navigationStates = require('../utils/navigationStates');
  DELIVERY_STATES = navigationStates.DELIVERY_STATES || {
    ASSIGNED: 'assigned',
    HEADING_TO_PICKUP: 'heading_to_pickup',
    AT_PICKUP: 'at_pickup',
    PICKED_UP: 'picked_up',
    HEADING_TO_DELIVERY: 'heading_to_delivery',
    AT_DELIVERY: 'at_delivery',
    DELIVERED: 'delivered'
  };
  DELIVERY_STATE_LABELS = navigationStates.DELIVERY_STATE_LABELS || {};
  getNextWaypoint = navigationStates.getNextWaypoint || (() => null);
  getNextAction = navigationStates.getNextAction || (() => null);
  checkArrival = navigationStates.checkArrival || (() => false);
  calculateDistance = navigationStates.calculateDistance || (() => 0);
  formatDistance = navigationStates.formatDistance || ((d) => `${d}m`);
  formatDuration = navigationStates.formatDuration || ((d) => `${d}min`);
  calculateETA = navigationStates.calculateETA || (() => 'N/A');
} catch (error) {
  console.error('🚨 Failed to import navigation states:', error);
  // Fallback constants
  DELIVERY_STATES = {
    ASSIGNED: 'assigned',
    HEADING_TO_PICKUP: 'heading_to_pickup',
    AT_PICKUP: 'at_pickup',
    PICKED_UP: 'picked_up',
    HEADING_TO_DELIVERY: 'heading_to_delivery',
    AT_DELIVERY: 'at_delivery',
    DELIVERED: 'delivered'
  };
  DELIVERY_STATE_LABELS = {};
  getNextWaypoint = () => null;
  getNextAction = () => null;
  checkArrival = () => false;
  calculateDistance = () => 0;
  formatDistance = (d) => `${d}m`;
  formatDuration = (d) => `${d}min`;
  calculateETA = () => 'N/A';
}

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
  
  // FIX: Hook de medición segura para reemplazar mapRef.current.measure()
  const { dimensions, measureMap, layoutProps, isValidDimensions } = useSafeMapMeasurement(mapRef);
  
  // FIX: Diagnóstico del ref en desarrollo
  useEffect(() => {
    if (mapRef?.current && __DEV__) {
      diagnoseMapRef(mapRef, 'DeliveryNavigationScreen');
    }
  }, [mapRef?.current]);

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

  // EMERGENCY MODE: Skip complex validation to isolate undefined error
  const paramValidation = {
    isValid: true,
    error: null,
    params: {
      deliveryTracking: (safeParams && safeParams.deliveryTracking) || null,
      trackingId: (safeParams && (safeParams.trackingId || safeParams._id)) || null,
      orderId: (safeParams && safeParams.orderId) || null
    }
  };
  
  console.log('🚨 EMERGENCY MODE: Using minimal validation:', paramValidation);
  
  // Extracción segura con fallbacks
  const trackingId = safeParams.trackingId || safeParams._id || paramValidation.params?.trackingId || null;
  const initialDeliveryData = safeParams.deliveryTracking || paramValidation.params?.deliveryTracking || null;
  const orderId = safeParams.orderId || initialDeliveryData?.orderId || paramValidation.params?.orderId || null;

  // ==================== ESTADOS DEL COMPONENTE ====================
  // Estados principales de delivery - No usar datos iniciales para el estado
  const [deliveryData, setDeliveryData] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState(() => {
    try {
      const fallbackState = DELIVERY_STATES?.ASSIGNED || 'assigned';
      // No usar el estado inicial del parámetro, siempre cargar del backend
      console.log('🔧 DeliveryStatus initialization: using fallback until loaded from backend');
      return fallbackState;
    } catch (error) {
      console.error('🚨 DeliveryStatus initialization error:', error);
      return 'assigned'; // Hard-coded fallback
    }
  });
  const [isLoading, setIsLoading] = useState(true); // Siempre empezar cargando
  const [error, setError] = useState(null);

  // Estados de ubicación y navegación
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [navigationRoute, setNavigationRoute] = useState(null);
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
  
  // Estados para manejo del mapa
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const mapTimeoutRef = useRef(null);
  
  // NUEVO: Estado unificado de preparación del mapa
  const [mapReadyState, setMapReadyState] = useState({
    hasLocation: false,
    hasDeliveryData: false,
    hasValidCoordinates: false,
    mapComponentReady: false
  });

  // Animaciones
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const statusAnim = useRef(new Animated.Value(0)).current;

  // ==================== HOOK DE NOTIFICACIONES (SAFE MODE) ====================
  // Temporarily disabled callback to isolate undefined error
  const notificationHooks = useDeliveryNotifications(
    orderId, 
    deliveryData?.deliveryPersonId,
    null // No callback for now
  ) || { emitStatusUpdate: () => {}, emitLocationUpdate: () => {} };
  
  const { emitStatusUpdate = () => {}, emitLocationUpdate = () => {} } = notificationHooks;

  // ==================== INICIALIZACIÓN CON RACE CONDITION FIX ====================
  const [initializationState, setInitializationState] = useState({
    initialized: false,
    initializing: false,
    error: null
  });
  
  useEffect(() => {
    // FIX: Prevenir múltiples inicializaciones simultáneas
    if (initializationState.initializing || initializationState.initialized) {
      console.log('⚠️ Initialization already in progress or completed, skipping');
      return;
    }
    
    console.log('🚀 Starting delivery initialization (once)');
    setInitializationState(prev => ({ ...prev, initializing: true }));
    
    initializeDelivery();
    return () => cleanup();
  }, []);  // FIX: Solo ejecutar una vez, sin dependencias que cambien

  // Sincronización de estado cuando cambia deliveryData
  useEffect(() => {
    if (deliveryData?.status && deliveryData.status !== deliveryStatus) {
      setDeliveryStatus(deliveryData.status);
    }
  }, [deliveryData]);
  
  // Auto-zoom cuando se cargan nuevos datos de delivery o cambia la ubicación
  useEffect(() => {
    if (mapLoaded && mapRef.current && (deliveryData || currentLocation)) {
      // Aplicar auto-zoom después de un breve delay para asegurar que el mapa esté estable
      const timeoutId = setTimeout(() => {
        console.log('🔄 Reaplicando auto-zoom debido a cambios en datos de delivery/ubicación');
        applyAutoZoom();
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [mapLoaded, deliveryData, currentLocation]);

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
  
  // NUEVO: Logging mejorado para debuggear el estado del mapa
  useEffect(() => {
    console.log('🗺️ === DEBUG ESTADO DEL MAPA ===');
    console.log('1. currentLocation:', currentLocation ? 'DISPONIBLE' : 'NULL');
    console.log('2. deliveryData:', deliveryData ? 'DISPONIBLE' : 'NULL');
    console.log('3. deliveryStatus:', deliveryStatus);
    console.log('4. mapLoaded:', mapLoaded);
    console.log('5. mapError:', mapError?.message || 'NINGUNO');
    
    if (deliveryData) {
      console.log('6. pickupCoords:', deliveryData.pickupLocation?.coordinates);
      console.log('7. deliveryCoords:', deliveryData.deliveryLocation?.coordinates);
      console.log('8. pickupValid:', validateCoordinates(deliveryData.pickupLocation?.coordinates));
      console.log('9. deliveryValid:', validateCoordinates(deliveryData.deliveryLocation?.coordinates));
    }
    
    const currentWaypoint = getNextWaypoint(
      deliveryStatus,
      deliveryData?.pickupLocation?.coordinates,
      deliveryData?.deliveryLocation?.coordinates
    );
    console.log('10. currentWaypoint:', currentWaypoint ? 'DISPONIBLE' : 'NULL');
    if (currentWaypoint) {
      console.log('    - waypoint.type:', currentWaypoint.type);
      console.log('    - waypoint.coordinates:', currentWaypoint.coordinates);
      console.log('    - waypoint.address:', currentWaypoint.address);
    }
    console.log('11. mapRegion available:', !!mapRegion);
    console.log('12. Marcadores que se renderizarán:');
    console.log('    - Waypoint marker:', !!(mapLoaded && currentWaypoint && validateCoordinates(currentWaypoint?.coordinates)));
    console.log('    - Current location marker:', !!(mapLoaded && currentLocation));
    console.log('🗺️ === FIN DEBUG ===\n');
    
    // NEW: Detailed map container inspection
    console.log('🔧 === DIAGNOSTIC MAP ANALYSIS ===');
    console.log('13. Map container styles inspection:');
    console.log('    - styles.map contains:', JSON.stringify(styles.map));
    console.log('14. MapView computed layout check:');
    console.log('    - Container flex:', styles.container.flex);
    console.log('    - Map flex:', styles.map.flex);
    console.log('15. Conditional rendering analysis:');
    console.log('    - mapRegion available:', !!mapRegion);
    console.log('🔧 === END DIAGNOSTIC ===\n');
  }, [currentLocation, deliveryData, deliveryStatus, mapLoaded, mapError]);

  // FIX: VALIDACIÓN DE DIMENSIONES DEL MAPA - Usando SafeMapMeasurement
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        // FIX: Reemplazar mapRef.current.measure() con SafeMapMeasurement
        SafeMapMeasurement.measureMap(mapRef, (x, y, width, height) => {
          console.log('✅ MapView Final Dimensions (FIXED):', { width, height, x, y });
          if (width > 0 && height > 0) {
            console.log('✅ MapView successfully rendered with proper dimensions');
          } else {
            console.error('❌ MapView has zero dimensions - ISSUE DETECTED!');
          }
        });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
  
  // FIX: Monitorear cambios en las dimensiones del hook de medición segura
  useEffect(() => {
    if (dimensions && isValidDimensions) {
      console.log('✅ SafeMapMeasurement Hook - Valid dimensions detected:', dimensions);
    } else if (dimensions && !isValidDimensions) {
      console.error('❌ SafeMapMeasurement Hook - Invalid dimensions detected:', dimensions);
    }
  }, [dimensions, isValidDimensions]);

  // VALIDACIÓN DE REGIÓN
  const validateRegion = (region) => {
    const isValid = region && 
      typeof region.latitude === 'number' &&
      typeof region.longitude === 'number' &&
      region.latitudeDelta > 0 &&
      region.longitudeDelta > 0 &&
      !isNaN(region.latitude) &&
      !isNaN(region.longitude);
    
    console.log('🔍 Region Validation:', { region, isValid });
    return isValid;
  };

  // ADD new useEffect: Force map to show after timeout
  useEffect(() => {
    // Force map to show after 3 seconds if still hidden
    const forceMapTimeout = setTimeout(() => {
      if (currentLocation && deliveryData && !mapLoaded && !mapError) {
        console.log('🚨 FORCING MAP LOAD: Timeout reached, forcing map visibility');
        setMapLoaded(true);
      }
    }, 3000);
    
    return () => clearTimeout(forceMapTimeout);
  }, [currentLocation, deliveryData]);

  /**
   * Inicialización completa del delivery
   * FIX: Con protección contra race conditions y estado de inicialización
   */
  const initializeDelivery = async () => {
    try {
      console.log('🔧 Inicializando delivery navigation...');
      
      // FIX: Verificar si ya se está inicializando
      if (initializationState.initializing && !initializationState.error) {
        console.log('⚠️ Ya hay una inicialización en progreso, esperando...');
        return;
      }
      
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

      // Siempre cargar datos del delivery desde el backend para obtener el estado actual
      if (trackingId) {
        await loadDeliveryData();
      } else {
        throw new Error('No se proporcionó un ID de tracking válido');
      }

      // Iniciar tracking de ubicación
      await startLocationTracking();

      // Iniciar animaciones
      startAnimations();

      // FIX: Marcar inicialización como completada
      setInitializationState({
        initialized: true,
        initializing: false,
        error: null
      });

      console.log('✅ Delivery navigation inicializado correctamente');
    } catch (error) {
      console.error('❌ Error en inicialización:', error);
      
      // FIX: Actualizar estado de error en initializationState
      setInitializationState({
        initialized: false,
        initializing: false,
        error: error.message
      });
      
      setError(error.message);
      
      // Ofrecer retry o salir
      Alert.alert(
        'Error de Inicialización',
        error.message,
        [
          { 
            text: 'Reintentar', 
            onPress: () => {
              setInitializationState({
                initialized: false,
                initializing: false,
                error: null
              });
              initializeDelivery();
            }
          },
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

      // Intentar recuperar estado local persistido mientras carga del servidor
      const deliveryStateKey = `delivery_state_${trackingId}`;
      try {
        const savedState = await AsyncStorage.getItem(deliveryStateKey);
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          console.log('💾 Estado local recuperado:', parsedState);
        }
      } catch (storageError) {
        console.log('⚠️ No hay estado local guardado o error al recuperarlo');
      }

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

        // Actualizar estado persistido local con el estado del servidor
        await AsyncStorage.setItem(deliveryStateKey, JSON.stringify({
          status: trackingData.status,
          lastUpdated: new Date().toISOString(),
          trackingId: trackingId
        }));

        // Actualizar manager local
        await ActiveDeliveryManager.updateActiveDeliveryStatus(trackingData.status);
        
        console.log('✅ Datos de delivery cargados correctamente, estado actual:', trackingData.status);

        // Si el delivery está completado o cancelado, limpiar el storage local
        if (trackingData.status === 'delivered' || trackingData.status === 'cancelled') {
          await AsyncStorage.removeItem(deliveryStateKey);
          console.log('🧹 Estado local limpiado para delivery completado/cancelado');
        }
      } else {
        throw new Error('No se pudieron obtener los datos del delivery');
      }
    } catch (error) {
      console.error('❌ Error cargando delivery data:', error);
      setError('No se pudieron cargar los datos del delivery');
      
      // Si es 404, el delivery no existe o fue completado
      if (error.response?.status === 404) {
        // Limpiar estado local si existe
        const deliveryStateKey = `delivery_state_${trackingId}`;
        await AsyncStorage.removeItem(deliveryStateKey);
        
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
    console.log('📍 Ubicación actualizada:', {
      latitude: newLocation.latitude,
      longitude: newLocation.longitude,
      accuracy: newLocation.accuracy
    });

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
   * FIX: Con protección robusta contra múltiples detecciones y race conditions
   */
  const [arrivalCheckState, setArrivalCheckState] = useState({
    lastCheck: null,
    processing: false,
    lastNotification: null
  });
  
  const checkAutoArrival = useCallback(() => {
    // FIX: Verificaciones iniciales más robustas
    if (!autoArrivalCheck || !currentLocation || !deliveryData) {
      console.log('⚠️ checkAutoArrival: Condiciones no cumplidas', {
        autoArrivalCheck,
        hasCurrentLocation: !!currentLocation,
        hasDeliveryData: !!deliveryData
      });
      return;
    }
    
    // FIX: Prevenir múltiples ejecuciones simultáneas
    if (arrivalCheckState.processing) {
      console.log('⚠️ checkAutoArrival: Ya procesando, skipping');
      return;
    }
    
    // FIX: Throttling más agresivo para evitar spam
    const now = Date.now();
    if (arrivalCheckState.lastCheck && (now - arrivalCheckState.lastCheck) < 5000) {
      console.log('⚠️ checkAutoArrival: Throttled, última verificación muy reciente');
      return;
    }
    
    setArrivalCheckState(prev => ({ ...prev, processing: true, lastCheck: now }));

    const waypoint = getNextWaypoint(
      deliveryStatus,
      deliveryData.pickupLocation?.coordinates,
      deliveryData.deliveryLocation?.coordinates
    );

    if (!waypoint) {
      setArrivalCheckState(prev => ({ ...prev, processing: false }));
      return;
    }

    // FIX: Pasar deliveryData y deliveryStatus a checkArrival para verificaciones robustas
    const hasArrived = checkArrival(
      currentLocation, 
      waypoint.coordinates, 
      200, // Radio de 200 metros (mismo que backend)
      deliveryStatus, // Estado actual
      deliveryData // Datos completos del delivery para verificar arrived
    );
    
    if (hasArrived) {
      // FIX: Verificar si ya mostramos notificación reciente para este tipo
      const notificationKey = `${waypoint.type}_${deliveryStatus}`;
      if (arrivalCheckState.lastNotification !== notificationKey) {
        showArrivalNotification(waypoint.type);
        setArrivalCheckState(prev => ({ 
          ...prev, 
          processing: false,
          lastNotification: notificationKey 
        }));
        
        // Desactivar temporalmente para evitar múltiples alertas
        setAutoArrivalCheck(false);
        setTimeout(() => {
          setAutoArrivalCheck(true);
          console.log('✅ Auto-arrival check reactivated');
        }, 30000);
      } else {
        console.log('⚠️ Notificación ya mostrada para este estado, skipping');
        setArrivalCheckState(prev => ({ ...prev, processing: false }));
      }
    } else {
      setArrivalCheckState(prev => ({ ...prev, processing: false }));
    }
  }, [currentLocation, deliveryData, deliveryStatus, autoArrivalCheck, arrivalCheckState.processing, arrivalCheckState.lastCheck, arrivalCheckState.lastNotification]);

  /**
   * Mostrar notificación informativa de llegada (sin confirmación manual)
   */
  const showArrivalNotification = (type) => {
    const message = type === 'pickup' 
      ? '¡Has llegado al restaurante! El sistema detectó tu llegada automáticamente.'
      : '¡Has llegado al destino! El sistema detectó tu llegada automáticamente.';

    // Solo mostrar mensaje informativo, sin requerir confirmación manual
    Alert.alert(
      '📍 Llegada Detectada Automáticamente',
      message,
      [{ text: 'OK' }],
      { cancelable: true }
    );
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

      // Persistir estado en AsyncStorage para recuperación posterior
      if (trackingId) {
        const deliveryStateKey = `delivery_state_${trackingId}`;
        await AsyncStorage.setItem(deliveryStateKey, JSON.stringify({
          status: newStatus,
          lastUpdated: new Date().toISOString(),
          trackingId: trackingId
        }));
        console.log('💾 Estado persistido localmente:', newStatus);
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
   * MODIFICADO: No permitir confirmación manual de llegadas (at_pickup, at_delivery)
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

      // BLOQUEAR acciones de llegada automática
      if (nextAction.action === 'at_pickup' || nextAction.action === 'at_delivery') {
        Alert.alert(
          'Llegada Automática',
          'La llegada se detectará automáticamente cuando estés a 200 metros del destino. No es necesario confirmar manualmente.',
          [{ text: 'Entendido' }]
        );
        return;
      }

      // Mostrar confirmación para acciones críticas (excepto llegadas)
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
      // Construir payload básico
      const payload = {
        status: action.action,
        notes: `Estado actualizado: ${action.label}`
      };
      
      // Solo incluir location si existe y es válida
      if (currentLocation && 
          typeof currentLocation.latitude === 'number' && 
          typeof currentLocation.longitude === 'number') {
        payload.location = currentLocation;
      }
      
      console.log('📤 Enviando payload:', JSON.stringify(payload, null, 2));
      
      const response = await apiClient.put(`/delivery/${deliveryData._id}/status`, payload);

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
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      
      // Manejar errores específicos
      if (error.response?.data?.error?.code === 'VALIDATION_ERROR') {
        console.error('❌ Validation details:', error.response.data.error.details);
        
        const validationErrors = error.response.data.error.details || [];
        const errorMessages = validationErrors.map(detail => 
          `${detail.field}: ${detail.message}`
        ).join('\n');
        
        Alert.alert(
          'Datos Inválidos',
          `Error de validación:\n${errorMessages}`,
          [{ text: 'OK' }]
        );
      } else if (error.response?.data?.error?.code === 'INVALID_STATUS_TRANSITION') {
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
      if (mapTimeoutRef.current) {
        clearTimeout(mapTimeoutRef.current);
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

  // NUEVA FUNCIÓN: Validación de coordenadas
  const validateCoordinates = (coords) => {
    if (!coords || !Array.isArray(coords) || coords.length !== 2) {
      console.warn('🗺️ Coordenadas inválidas: formato incorrecto', coords);
      return false;
    }
    const [lng, lat] = coords;
    const isValid = 
      typeof lng === 'number' && typeof lat === 'number' &&
      lng >= -180 && lng <= 180 && 
      lat >= -90 && lat <= 90 &&
      !isNaN(lng) && !isNaN(lat);
    
    if (!isValid) {
      console.warn('🗺️ Coordenadas inválidas: fuera de rango', { lng, lat });
    }
    return isValid;
  };
  

  /**
   * Obtener región del mapa con zoom automático para mostrar todas las marcas de interés
   * NUEVO: Calcula automáticamente el zoom para incluir todas las ubicaciones relevantes
   */
  const getMapRegion = () => {
    // FALLBACK PRINCIPAL: Siempre devolver una región válida
    const defaultRegion = {
      latitude: 18.4861,    // Santo Domingo, República Dominicana
      longitude: -69.9312,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    // Recopilar todas las coordenadas de interés
    const coordinates = [];
    
    // Agregar ubicación actual si está disponible
    if (currentLocation && 
        typeof currentLocation.latitude === 'number' && 
        typeof currentLocation.longitude === 'number' &&
        !isNaN(currentLocation.latitude) && 
        !isNaN(currentLocation.longitude)) {
      coordinates.push({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        type: 'current'
      });
    }
    
    // Agregar coordenadas del pickup (restaurante)
    if (deliveryData?.pickupLocation?.coordinates && 
        validateCoordinates(deliveryData.pickupLocation.coordinates)) {
      coordinates.push({
        latitude: deliveryData.pickupLocation.coordinates[1], // GeoJSON: [lng, lat]
        longitude: deliveryData.pickupLocation.coordinates[0],
        type: 'pickup'
      });
    }
    
    // Agregar coordenadas del delivery (cliente)
    if (deliveryData?.deliveryLocation?.coordinates && 
        validateCoordinates(deliveryData.deliveryLocation.coordinates)) {
      coordinates.push({
        latitude: deliveryData.deliveryLocation.coordinates[1], // GeoJSON: [lng, lat]
        longitude: deliveryData.deliveryLocation.coordinates[0],
        type: 'delivery'
      });
    }
    
    console.log('📍 Coordenadas recopiladas para zoom automático:', coordinates);
    
    // Si no hay coordenadas suficientes, usar fallback
    if (coordinates.length === 0) {
      console.log('📍 Sin coordenadas válidas, usando región por defecto');
      return defaultRegion;
    }
    
    // Si solo hay una coordenada, centrar en ella
    if (coordinates.length === 1) {
      const coord = coordinates[0];
      console.log('📍 Solo una coordenada disponible, centrando en:', coord.type);
      return {
        latitude: coord.latitude,
        longitude: coord.longitude,
        latitudeDelta: 0.005, // Zoom más cercano para una sola ubicación
        longitudeDelta: 0.005,
      };
    }
    
    // Calcular región que incluya todas las coordenadas
    const latitudes = coordinates.map(c => c.latitude);
    const longitudes = coordinates.map(c => c.longitude);
    
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    
    // Calcular centro
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calcular deltas con padding adicional para que las marcas no queden en el borde
    const latDelta = Math.max((maxLat - minLat) * 1.3, 0.005); // 30% padding, mínimo 0.005
    const lngDelta = Math.max((maxLng - minLng) * 1.3, 0.005); // 30% padding, mínimo 0.005
    
    const calculatedRegion = {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
    
    // Validar que la región calculada es válida
    if (centerLat < -90 || centerLat > 90 ||
        centerLng < -180 || centerLng > 180 ||
        latDelta <= 0 || lngDelta <= 0) {
      console.warn('⚠️ Región calculada inválida, usando fallback:', calculatedRegion);
      return defaultRegion;
    }
    
    console.log('🎯 Región calculada para mostrar todas las marcas:', {
      center: { lat: centerLat, lng: centerLng },
      deltas: { lat: latDelta, lng: lngDelta },
      coordinatesIncluded: coordinates.length,
      types: coordinates.map(c => c.type)
    });
    
    return calculatedRegion;
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

  // MEJORADO: Datos requeridos para renderizar con validación
  const currentWaypoint = getNextWaypoint(
    deliveryStatus,
    deliveryData?.pickupLocation?.coordinates,
    deliveryData?.deliveryLocation?.coordinates
  );
  
  const nextAction = getNextAction(deliveryStatus);
  
  // SIMPLIFICADO: Como ClientLocationSetupScreen, solo verificar si tenemos región
  const mapRegion = getMapRegion();
  
  // DIAGNÓSTICO COMPLETO DEL MAPA
  console.log('🔍 MAP DIAGNOSIS:', {
    mapRegion,
    currentLocation,
    deliveryData: !!deliveryData,
    initialDeliveryData: !!initialDeliveryData,
    isLoading,
    mapLoaded,
    mapError
  });
  
  // Función para verificar dimensiones del mapa
  const checkMapDimensions = () => {
    if (mapRef.current) {
      // FIX: Reemplazar mapRef.current.measure() con SafeMapMeasurement
      SafeMapMeasurement.measureMap(mapRef, (x, y, width, height, pageX, pageY) => {
        console.log('📐 MapView Dimensions (FIXED):', { width, height, x, y });
        if (width === 0 || height === 0) {
          console.error('❌ FOUND ISSUE: MapView has zero dimensions!');
        } else {
          console.log('✅ MapView has proper dimensions');
        }
      });
    }
  };
  
  /**
   * Aplicar zoom automático para mostrar todas las marcas de interés
   * Se ejecuta después de que el mapa esté completamente cargado
   */
  const applyAutoZoom = () => {
    if (!mapRef.current) {
      console.log('⚠️ MapRef no disponible para auto-zoom');
      return;
    }
    
    try {
      // Obtener la región optimizada que incluye todas las marcas
      const optimizedRegion = getMapRegion();
      
      console.log('🎯 Aplicando auto-zoom a región:', optimizedRegion);
      
      // Animar hacia la región que muestra todas las marcas
      mapRef.current.animateToRegion(optimizedRegion, 1000); // 1 segundo de animación
      
      console.log('✅ Auto-zoom aplicado exitosamente');
      
    } catch (error) {
      console.error('❌ Error aplicando auto-zoom:', error);
    }
  };

  // RENDERIZADO SIMPLIFICADO DEL MAPA
  const renderMap = () => {
    const region = getMapRegion();
    
    console.log('🗺️ Rendering map with region:', region);
    
    // Validar región antes de renderizar
    if (!region || !validateRegion(region)) {
      return (
        <View style={styles.mapContainer}>
          <View style={styles.mapPreparingContent}>
            <ActivityIndicator size="large" color="#E60023" />
            <Text style={styles.mapPreparingTitle}>Cargando mapa...</Text>
            <Text style={styles.mapPreparingText}>📍 Obteniendo ubicación...</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onMapReady={() => {
            console.log('✅ Map successfully loaded');
            setMapLoaded(true);
            setMapError(null);
            // Verificar dimensiones después de cargar
            setTimeout(checkMapDimensions, 1000);
            // Aplicar zoom automático después de que el mapa esté listo
            setTimeout(applyAutoZoom, 1500);
          }}
          onError={(error) => {
            console.error('🗺️ MapView Error:', error);
            setMapError(error);
            setMapLoaded(false);
          }}
          // FIX: Combinar onLayout existente con layoutProps del hook de medición segura
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            // FIX: Ejecutar layoutProps del hook de medición segura
            if (layoutProps.onLayout) {
              layoutProps.onLayout(event);
            }
            console.log('📐 MapView Layout:', { width, height });
            if (width === 0 || height === 0) {
              console.warn('⚠️ MapView has zero layout dimensions');
            }
          }}
        >
          {/* Marcadores */}
          {mapLoaded && currentWaypoint && validateCoordinates(currentWaypoint.coordinates) && (
            <Marker
              coordinate={{
                latitude: currentWaypoint.coordinates[1],
                longitude: currentWaypoint.coordinates[0]
              }}
              title={
                currentWaypoint.type === 'pickup' ? '🏪 Restaurante' : 
                currentWaypoint.type === 'delivery' ? '🏠 Cliente' :
                '✅ Entregado'
              }
              pinColor={
                currentWaypoint.type === 'pickup' ? 'red' : 
                currentWaypoint.type === 'delivery' ? 'green' :
                'purple'
              }
              description={currentWaypoint.address || 'Destino de entrega'}
            />
          )}
          
          {mapLoaded && currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude
              }}
              title="🚗 Mi ubicación"
              pinColor="blue"
              description={`Delivery - Estado: ${deliveryStatus}`}
            />
          )}
          
          {mapLoaded && (deliveryData || initialDeliveryData) && deliveryStatus === 'picked_up' && 
           validateCoordinates((deliveryData || initialDeliveryData).pickupLocation?.coordinates) && (
            <Marker
              coordinate={{
                latitude: (deliveryData || initialDeliveryData).pickupLocation.coordinates[1],
                longitude: (deliveryData || initialDeliveryData).pickupLocation.coordinates[0]
              }}
              title="🏪 Recogido aquí"
              pinColor="orange"
              description="Restaurante donde se recogió el pedido"
            />
          )}
        </MapView>
      </View>
    );
  };

  // ==================== RENDERIZADO PRINCIPAL ====================
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {renderMap()}

      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            console.log('🔙 Botón de salir presionado');
            try {
              navigation.navigate('HomeDelivery');
              console.log('✅ Navegación a HomeDelivery exitosa');
            } catch (error) {
              console.error('❌ Error navegando:', error);
              // Fallback directo
              navigation.goBack();
            }
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

        <View style={styles.headerRightButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => {
              console.log('🎯 Botón de recentrar presionado');
              applyAutoZoom();
            }}
          >
            <Ionicons name="locate" size={20} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => setShowOrderDetails(!showOrderDetails)}
          >
            <Ionicons name="menu" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.navigationPanel}>
        {/* Panel de navegacion - Informacion de navegacion */}
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

        {/* Boton de accion principal */}
        {nextAction && (
          <TouchableOpacity
            style={[
              styles.actionButton, 
              { 
                backgroundColor: nextAction.disabled ? '#cccccc' : nextAction.color,
                opacity: nextAction.disabled ? 0.6 : 1
              }
            ]}
            onPress={nextAction.disabled ? null : handleNextAction}
            disabled={nextAction.disabled}
          >
            <Ionicons 
              name={nextAction.disabled ? 'hourglass-outline' : (nextAction.icon || 'checkmark')} 
              size={24} 
              color={nextAction.disabled ? '#666' : '#fff'} 
            />
            <Text style={[
              styles.actionButtonText,
              { color: nextAction.disabled ? '#666' : '#fff' }
            ]}>
              {nextAction.label}
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Mensaje informativo para estados automaticos */}
        {nextAction && (nextAction.action === 'at_pickup' || nextAction.action === 'at_delivery') && (
          <View style={styles.automaticStatusMessage}>
            <Ionicons name="location" size={24} color="#4CAF50" />
            <Text style={styles.automaticStatusText}>
              {nextAction.action === 'at_pickup' 
                ? 'Llegada al restaurante detectada automáticamente' 
                : 'Llegada al cliente detectada automáticamente'}
            </Text>
          </View>
        )}
        
        {/* Mensaje especial cuando espera confirmación del comerciante */}
        {nextAction && nextAction.waitingFor === 'merchant' && (
          <View style={styles.waitingMerchantMessage}>
            <Ionicons name="business" size={24} color="#FF9800" />
            <Text style={styles.waitingMerchantText}>
              El comerciante debe confirmar la entrega del pedido antes de que puedas continuar
            </Text>
          </View>
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
  mapContainer: {
    flex: 1,
    width: '100%',
    height: 400,
    backgroundColor: '#f5f5f5', // Fondo visible para debug
  },
  mapFallback: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapErrorContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapErrorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  mapErrorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  skipMapButton: {
    backgroundColor: '#FF9800',
    marginTop: 10,
  },
  errorDetails: {
    fontSize: 12,
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  mapLoadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
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
  headerRightButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
  automaticStatusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  automaticStatusText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    textAlign: 'center',
    flex: 1,
  },
  waitingMerchantMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  waitingMerchantText: {
    color: '#856404',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
    textAlign: 'center',
    flex: 1,
    lineHeight: 20,
  },
  // NUEVOS: Estilos para pantalla de preparación del mapa
  mapPreparingContainer: {
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPreparingContent: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    margin: 20,
  },
  mapPreparingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 10,
  },
  mapPreparingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  // DEBUG: Estilos temporales para verificar estado
  debugIndicator: {
    position: 'absolute',
    top: 100,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 5,
    zIndex: 1000,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default DeliveryNavigationScreen;