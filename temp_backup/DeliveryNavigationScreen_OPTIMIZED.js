/**
 * DeliveryNavigationScreen - Versión Optimizada
 * Flujo completo de delivery con validación robusta y estado unificado
 * Arquitectura: React Native + Expo + Socket.IO + MongoDB
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Componentes optimizados
import OptimizedMapView from './shared/OptimizedMapView';
import { useMapState } from '../hooks/useMapState';
import { useDeliveryNotifications } from '../hooks/useDeliveryNotifications';

// Servicios y utilidades
import { CoordinateValidator } from '../utils/coordinateValidator';
import ActiveDeliveryManager from '../utils/activeDeliveryManager';
import ErrorInterceptor from '../utils/ErrorInterceptor';
import { apiClient } from '../api/apiClient';
import realTimeService from '../services/realTimeService';
import LocationService from '../services/LocationService';

// Estados de navegación con safe import
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
 * Componente principal de navegación de delivery optimizado
 */
const DeliveryNavigationScreen = ({ route }) => {
  const navigation = useNavigation();

  // ==================== EXTRACCIÓN SEGURA DE PARÁMETROS ====================
  const safeRoute = route || {};
  const safeParams = safeRoute.params || {};
  
  console.log('🚀 DeliveryNavigationScreen iniciando con parámetros:', {
    hasRoute: !!route,
    hasParams: !!safeParams,
    paramKeys: Object.keys(safeParams)
  });

  // Extracción segura de parámetros
  const trackingId = safeParams.trackingId || safeParams._id || null;
  const initialDeliveryData = safeParams.deliveryTracking || null;
  const orderId = safeParams.orderId || initialDeliveryData?.orderId || null;

  // ==================== ESTADOS DEL COMPONENTE ====================
  const [deliveryData, setDeliveryData] = useState(initialDeliveryData);
  const [deliveryStatus, setDeliveryStatus] = useState(() => {
    const fallbackState = DELIVERY_STATES?.ASSIGNED || 'assigned';
    const initialStatus = initialDeliveryData?.status || fallbackState;
    console.log('🔧 DeliveryStatus initialization:', { initialStatus, fallbackState });
    return initialStatus;
  });
  
  const [isLoading, setIsLoading] = useState(!initialDeliveryData);
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(Date.now());

  // Referencias para cleanup
  const isMountedRef = useRef(true);
  const locationCallbackRef = useRef(null);

  // ==================== HOOKS OPTIMIZADOS ====================
  // Hook unificado para el estado del mapa
  const mapState = useMapState(deliveryData, currentLocation);
  
  // Hook de notificaciones con callback optimizado
  const notificationCallback = useCallback((type, data) => {
    if (!isMountedRef.current) return;
    
    console.log('📨 Notificación recibida:', type, data);
    
    switch (type) {
      case 'status_update':
        if (data.status !== deliveryStatus) {
          setDeliveryStatus(data.status);
          setDeliveryData(prev => ({ ...prev, status: data.status }));
        }
        break;
      case 'location_update':
        // Las actualizaciones de ubicación se manejan directamente por LocationService
        break;
    }
  }, [deliveryStatus]);

  const { emitStatusUpdate, emitLocationUpdate } = useDeliveryNotifications(
    orderId, 
    deliveryData?.deliveryPersonId,
    notificationCallback
  ) || { emitStatusUpdate: () => {}, emitLocationUpdate: () => {} };

  // ==================== INICIALIZACIÓN ====================
  useEffect(() => {
    isMountedRef.current = true;
    initializeDelivery();
    
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  // Sincronización de estado cuando cambia deliveryData
  useEffect(() => {
    if (deliveryData?.status && deliveryData.status !== deliveryStatus) {
      setDeliveryStatus(deliveryData.status);
    }
  }, [deliveryData]);

  /**
   * Inicialización completa del delivery con manejo robusto de errores
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

      // Conectar servicios en tiempo real
      try {
        await realTimeService.connect();
      } catch (error) {
        console.warn('⚠️ No se pudo conectar a tiempo real:', error.message);
        // Continuar sin tiempo real
      }

      // Cargar o actualizar datos del delivery
      if (!deliveryData && trackingId) {
        await loadDeliveryData();
      } else if (deliveryData) {
        await refreshDeliveryStatus();
      }

      // Iniciar tracking de ubicación
      await startLocationTracking();

      console.log('✅ Delivery navigation inicializado correctamente');
    } catch (error) {
      console.error('❌ Error en inicialización:', error);
      setError(error.message);
      
      // Ofrecer retry o salir con opciones más específicas
      Alert.alert(
        'Error de Inicialización',
        error.message,
        [
          { text: 'Reintentar', onPress: () => initializeDelivery() },
          { text: 'Modo Offline', onPress: () => enableOfflineMode() },
          { text: 'Salir', onPress: () => navigation.navigate('HomeDelivery'), style: 'cancel' }
        ]
      );
    }
  };

  /**
   * Habilitar modo offline básico
   */
  const enableOfflineMode = () => {
    setError('Modo offline activo - Funcionalidad limitada');
    console.log('📱 Modo offline habilitado');
    
    // En modo offline, usar ubicación por defecto si no hay GPS
    if (!currentLocation) {
      const defaultCoords = CoordinateValidator.getDefaultDRCoords();
      setCurrentLocation(defaultCoords);
    }
  };

  /**
   * Cargar datos del delivery desde el servidor con validación robusta
   */
  const loadDeliveryData = async () => {
    try {
      setIsLoading(true);
      console.log('📦 Cargando datos del delivery:', trackingId);

      const response = await apiClient.get(`/delivery/${trackingId}`);
      
      if (response.data?.success && response.data?.data?.deliveryTracking) {
        const trackingData = response.data.data.deliveryTracking;
        
        // Validar y limpiar coordenadas
        const cleanedData = {
          ...trackingData,
          pickupLocation: trackingData.pickupLocation ? {
            ...trackingData.pickupLocation,
            coordinates: CoordinateValidator.getSafeCoords(
              trackingData.pickupLocation.coordinates,
              CoordinateValidator.getDefaultDRCoords()
            )
          } : null,
          deliveryLocation: trackingData.deliveryLocation ? {
            ...trackingData.deliveryLocation,
            coordinates: CoordinateValidator.getSafeCoords(
              trackingData.deliveryLocation.coordinates,
              CoordinateValidator.getDefaultDRCoords()
            )
          } : null
        };
        
        setDeliveryData(cleanedData);
        setDeliveryStatus(cleanedData.status);

        // Actualizar manager local
        await ActiveDeliveryManager.updateActiveDeliveryStatus(cleanedData.status);
        
        console.log('✅ Datos de delivery cargados y validados correctamente');
      } else {
        throw new Error('No se pudieron obtener los datos del delivery');
      }
    } catch (error) {
      console.error('❌ Error cargando delivery data:', error);
      
      // Manejo específico de errores
      if (error.response?.status === 404) {
        setError('Delivery no encontrado o completado');
        Alert.alert(
          'Delivery No Encontrado',
          'Este delivery no existe o ya fue completado.',
          [{ text: 'Volver', onPress: () => navigation.replace('HomeDelivery') }]
        );
      } else if (error.response?.status >= 500) {
        setError('Error del servidor - Reintentando en modo offline');
        enableOfflineMode();
      } else {
        setError('No se pudieron cargar los datos del delivery');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refrescar estado del delivery con retry automático
   */
  const refreshDeliveryStatus = async (retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (!deliveryData?._id) return;
        
        console.log(`🔄 Refrescando estado del delivery (intento ${attempt})...`);
        const response = await apiClient.get(`/delivery/${deliveryData._id}`);
        
        if (response.data?.success) {
          const updatedData = response.data.data.deliveryTracking;
          setDeliveryData(prev => ({ ...prev, ...updatedData }));
          setDeliveryStatus(updatedData.status);
          
          await ActiveDeliveryManager.updateActiveDeliveryStatus(updatedData.status);
          return; // Éxito, salir del loop
        }
      } catch (error) {
        console.error(`❌ Error refrescando estado (intento ${attempt}):`, error);
        
        if (attempt === retries) {
          console.warn('⚠️ Todos los intentos fallaron, continuando con datos locales');
        } else {
          // Esperar antes del siguiente intento (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }
  };

  /**
   * Iniciar tracking de ubicación optimizado
   */
  const startLocationTracking = async () => {
    try {
      console.log('📍 Iniciando tracking de ubicación...');
      
      // Crear callback optimizado para actualizaciones
      locationCallbackRef.current = (location, error) => {
        if (!isMountedRef.current) return;
        
        if (error) {
          console.error('❌ Error en tracking de ubicación:', error);
          setError('Error obteniendo ubicación GPS');
          return;
        }
        
        if (location) {
          const validatedLocation = CoordinateValidator.getSafeCoords(location);
          setCurrentLocation(validatedLocation);
          
          // Throttling para sincronización con backend
          const now = Date.now();
          if (now - lastLocationUpdate > 5000) { // Cada 5 segundos
            setLastLocationUpdate(now);
            syncLocationWithBackend(validatedLocation);
          }
        }
      };

      // Iniciar tracking con LocationService optimizado
      await LocationService.startLocationTracking(locationCallbackRef.current, {
        enableHighAccuracy: true,
        distanceFilter: 10, // Actualizar cada 10 metros
        timeout: 15000
      });

      setIsTracking(true);
      console.log('✅ Tracking de ubicación iniciado');
      
    } catch (error) {
      console.error('❌ Error iniciando tracking:', error);
      setError('No se pudo iniciar el seguimiento de ubicación');
      
      // Fallback: usar ubicación por defecto
      const defaultLocation = CoordinateValidator.getDefaultDRCoords();
      setCurrentLocation(defaultLocation);
      setError('Usando ubicación por defecto - GPS no disponible');
    }
  };

  /**
   * Sincronizar ubicación con el backend con manejo de errores robusto
   */
  const syncLocationWithBackend = async (location, retries = 2) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (!deliveryData?._id) return;

        await apiClient.put(`/delivery/${deliveryData._id}/location`, {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy || 0,
          speed: location.speed || 0,
          heading: location.heading || 0
        });

        // Emitir actualización por socket si está disponible
        if (emitLocationUpdate) {
          emitLocationUpdate(location, deliveryStatus);
        }
        
        return; // Éxito, salir del loop
        
      } catch (error) {
        console.error(`❌ Error sincronizando ubicación (intento ${attempt}):`, error);
        
        if (attempt === retries) {
          // No mostrar alerta para no molestar al usuario, solo log
          console.warn('⚠️ No se pudo sincronizar ubicación con el servidor');
        }
      }
    }
  };

  /**
   * Manejar cambio de estado del delivery con validación
   */
  const handleStatusChange = async (newStatus) => {
    try {
      console.log('🔄 Cambiando estado de', deliveryStatus, 'a', newStatus);
      
      // Validar transición de estado
      const validTransitions = {
        [DELIVERY_STATES.ASSIGNED]: [DELIVERY_STATES.HEADING_TO_PICKUP],
        [DELIVERY_STATES.HEADING_TO_PICKUP]: [DELIVERY_STATES.AT_PICKUP],
        [DELIVERY_STATES.AT_PICKUP]: [DELIVERY_STATES.PICKED_UP],
        [DELIVERY_STATES.PICKED_UP]: [DELIVERY_STATES.HEADING_TO_DELIVERY],
        [DELIVERY_STATES.HEADING_TO_DELIVERY]: [DELIVERY_STATES.AT_DELIVERY],
        [DELIVERY_STATES.AT_DELIVERY]: [DELIVERY_STATES.DELIVERED]
      };
      
      const allowedTransitions = validTransitions[deliveryStatus] || [];
      if (!allowedTransitions.includes(newStatus)) {
        console.warn('⚠️ Transición de estado inválida:', deliveryStatus, '->', newStatus);
        Alert.alert('Error', 'Transición de estado no válida');
        return;
      }
      
      // Actualizar estado local inmediatamente para mejor UX
      setDeliveryStatus(newStatus);
      setDeliveryData(prev => ({ ...prev, status: newStatus }));

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
   * Ejecutar actualización de estado en el backend con retry
   */
  const executeStatusUpdate = async (action, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const payload = {
          status: action.action,
          notes: `Estado actualizado: ${action.label}`
        };
        
        // Solo incluir location si existe y es válida
        if (currentLocation && CoordinateValidator.isValid(currentLocation)) {
          payload.location = currentLocation;
        }
        
        console.log(`📤 Enviando payload (intento ${attempt}):`, JSON.stringify(payload, null, 2));
        
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
          
          return; // Éxito, salir del loop
        } else {
          throw new Error('La actualización de estado falló');
        }
      } catch (error) {
        console.error(`❌ Error actualizando estado (intento ${attempt}):`, error);
        
        if (attempt === retries) {
          // Último intento fallido
          if (error.response?.data?.error?.code === 'INVALID_STATUS_TRANSITION') {
            Alert.alert(
              'Transición Inválida',
              'El estado actual no permite esta transición. Refrescando...',
              [{ text: 'OK', onPress: () => refreshDeliveryStatus() }]
            );
          } else {
            Alert.alert('Error', error.response?.data?.error?.message || 'Error al actualizar estado');
          }
        } else {
          // Esperar antes del siguiente intento
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
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
      
      // Permitir que la pantalla se apague
      allowSleepAgain();
      
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
      console.log('🧹 Limpiando DeliveryNavigationScreen...');
      
      // Detener tracking de ubicación
      if (locationCallbackRef.current) {
        LocationService.removeCallback(locationCallbackRef.current);
      }
      LocationService.stopLocationTracking();
      
      // Permitir que la pantalla se apague
      allowSleepAgain();
      
      // Desconectar servicios
      realTimeService.disconnect();
      
      console.log('✅ Cleanup completado');
    } catch (error) {
      console.error('❌ Error en cleanup:', error);
    }
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
  const nextAction = getNextAction(deliveryStatus);

  // ==================== RENDERIZADO PRINCIPAL ====================
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
      
      {/* Mapa optimizado */}
      <OptimizedMapView
        mapState={mapState}
        onMapReady={() => console.log('✅ Mapa listo')}
        onMapError={(error) => console.error('❌ Error en mapa:', error)}
        onMarkerPress={(marker) => console.log('📍 Marcador presionado:', marker.id)}
        style={styles.map}
      />

      {/* Header con estado */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.navigate('HomeDelivery')}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: DELIVERY_STATE_LABELS[deliveryStatus]?.color || '#666' }]}>
            <Text style={styles.statusText}>
              {DELIVERY_STATE_LABELS[deliveryStatus]?.label || deliveryStatus}
            </Text>
          </View>
        </View>

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
        {mapState.markers.length > 0 && (
          <View style={styles.navigationInfo}>
            <View style={styles.navigationRow}>
              <Ionicons 
                name="location" 
                size={20} 
                color="#E60023" 
              />
              <Text style={styles.navigationText}>
                {mapState.markers.length} destino(s) disponible(s)
              </Text>
            </View>
          </View>
        )}

        {/* Botón de acción principal */}
        {nextAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: nextAction.color || '#4CAF50' }]}
            onPress={handleNextAction}
          >
            <Ionicons name={nextAction.icon || 'arrow-forward'} size={24} color="#fff" />
            <Text style={styles.actionButtonText}>{nextAction.label}</Text>
          </TouchableOpacity>
        )}

        {/* Estado de tracking */}
        <View style={styles.trackingStatus}>
          <View style={[styles.trackingDot, { backgroundColor: isTracking ? '#4CAF50' : '#f44336' }]} />
          <Text style={styles.trackingText}>
            {isTracking ? 'GPS activo' : 'Sin GPS'} • 
            {currentLocation?.accuracy ? ` ±${Math.round(currentLocation.accuracy)}m` : ' N/A'}
          </Text>
          {error && (
            <Text style={styles.errorText}> • {error}</Text>
          )}
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
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
  errorText: {
    fontSize: 12,
    color: '#f44336',
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