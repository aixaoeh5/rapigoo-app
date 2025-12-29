// hooks/useMapState.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { CoordinateValidator } from '../utils/coordinateValidator';

/**
 * Hook unificado para manejar el estado del mapa de delivery
 * Resuelve race conditions y simplifica la lógica de renderizado
 */
export const useMapState = (deliveryData, currentLocation) => {
  const [mapState, setMapState] = useState({
    isReady: false,
    isLoading: true,
    hasLocation: false,
    hasDeliveryData: false,
    hasValidCoordinates: false,
    error: null,
    region: null,
    markers: []
  });

  // Ref para prevenir updates después de unmount
  const isMountedRef = useRef(true);

  // Validar y procesar ubicación actual
  const processCurrentLocation = useCallback((location) => {
    if (!location) return null;
    
    const normalized = CoordinateValidator.normalize(location);
    if (!normalized) {
      console.warn('🗺️ Ubicación actual inválida:', location);
      return null;
    }

    return normalized;
  }, []);

  // Validar y procesar datos de delivery
  const processDeliveryData = useCallback((data) => {
    if (!data) return { isValid: false, pickup: null, delivery: null };

    const pickup = CoordinateValidator.normalize(data.pickupLocation?.coordinates);
    const delivery = CoordinateValidator.normalize(data.deliveryLocation?.coordinates);

    return {
      isValid: !!(pickup || delivery),
      pickup,
      delivery,
      status: data.status || 'unknown'
    };
  }, []);

  // Generar marcadores basado en estado actual
  const generateMarkers = useCallback((location, deliveryInfo) => {
    const markers = [];

    // Marcador de ubicación actual
    if (location) {
      markers.push({
        id: 'current-location',
        coordinate: location,
        title: '🚗 Mi ubicación',
        pinColor: 'blue'
      });
    }

    // Marcadores de delivery
    if (deliveryInfo.pickup) {
      markers.push({
        id: 'pickup-location',
        coordinate: deliveryInfo.pickup,
        title: '🏪 Restaurante',
        pinColor: 'red'
      });
    }

    if (deliveryInfo.delivery) {
      markers.push({
        id: 'delivery-location',
        coordinate: deliveryInfo.delivery,
        title: '🏠 Cliente',
        pinColor: 'green'
      });
    }

    return markers;
  }, []);

  // Calcular región del mapa
  const calculateRegion = useCallback((location, deliveryInfo) => {
    const coordinates = [location, deliveryInfo.pickup, deliveryInfo.delivery]
      .filter(Boolean);

    if (coordinates.length === 0) {
      // Coordenadas por defecto de Santo Domingo
      return {
        latitude: 18.4861,
        longitude: -69.9312,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05
      };
    }

    if (coordinates.length === 1) {
      // Solo una coordenada disponible
      return {
        ...coordinates[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      };
    }

    // Múltiples coordenadas - calcular bounds
    const lats = coordinates.map(c => c.latitude);
    const lngs = coordinates.map(c => c.longitude);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const deltaLat = (maxLat - minLat) * 1.5; // Padding del 50%
    const deltaLng = (maxLng - minLng) * 1.5;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(deltaLat, 0.01), // Mínimo zoom
      longitudeDelta: Math.max(deltaLng, 0.01)
    };
  }, []);

  // Efecto principal para actualizar estado del mapa
  useEffect(() => {
    if (!isMountedRef.current) return;

    const processedLocation = processCurrentLocation(currentLocation);
    const deliveryInfo = processDeliveryData(deliveryData);

    const hasLocation = !!processedLocation;
    const hasDeliveryData = deliveryInfo.isValid;
    const hasValidCoordinates = hasLocation || hasDeliveryData;

    let error = null;
    let isReady = false;

    if (!hasLocation && !hasDeliveryData) {
      error = 'Obteniendo ubicación y datos de entrega...';
    } else if (!hasLocation) {
      error = 'Obteniendo ubicación GPS...';
    } else if (!hasDeliveryData) {
      error = 'Validando datos de entrega...';
    } else {
      isReady = true;
    }

    const region = hasValidCoordinates ? 
      calculateRegion(processedLocation, deliveryInfo) : null;
    
    const markers = hasValidCoordinates ? 
      generateMarkers(processedLocation, deliveryInfo) : [];

    setMapState({
      isReady,
      isLoading: !isReady,
      hasLocation,
      hasDeliveryData,
      hasValidCoordinates,
      error,
      region,
      markers
    });

    console.log('🗺️ Estado del mapa actualizado:', {
      isReady,
      hasLocation,
      hasDeliveryData,
      markersCount: markers.length,
      error
    });

  }, [currentLocation, deliveryData, processCurrentLocation, processDeliveryData, calculateRegion, generateMarkers]);

  // Cleanup en unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Función para forzar refresh del mapa
  const refreshMap = useCallback(() => {
    setMapState(prev => ({
      ...prev,
      isLoading: true,
      error: 'Actualizando mapa...'
    }));
    
    // Triggear re-evaluación en el siguiente tick
    setTimeout(() => {
      if (isMountedRef.current) {
        const processedLocation = processCurrentLocation(currentLocation);
        const deliveryInfo = processDeliveryData(deliveryData);
        
        setMapState(prev => ({
          ...prev,
          isLoading: false,
          error: null,
          region: calculateRegion(processedLocation, deliveryInfo),
          markers: generateMarkers(processedLocation, deliveryInfo)
        }));
      }
    }, 100);
  }, [currentLocation, deliveryData, processCurrentLocation, processDeliveryData, calculateRegion, generateMarkers]);

  // Función para obtener marcador específico
  const getMarker = useCallback((id) => {
    return mapState.markers.find(marker => marker.id === id);
  }, [mapState.markers]);

  // Función para verificar si coordenadas están en vista
  const isInView = useCallback((coords) => {
    if (!mapState.region || !coords) return false;
    
    const { latitude, longitude, latitudeDelta, longitudeDelta } = mapState.region;
    
    return (
      coords.latitude >= latitude - latitudeDelta/2 &&
      coords.latitude <= latitude + latitudeDelta/2 &&
      coords.longitude >= longitude - longitudeDelta/2 &&
      coords.longitude <= longitude + longitudeDelta/2
    );
  }, [mapState.region]);

  return {
    ...mapState,
    refreshMap,
    getMarker,
    isInView,
    // Funciones de conveniencia
    getCurrentLocationMarker: () => getMarker('current-location'),
    getPickupMarker: () => getMarker('pickup-location'),
    getDeliveryMarker: () => getMarker('delivery-location')
  };
};

export default useMapState;