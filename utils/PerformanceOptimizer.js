// Performance optimization utilities for React Native
import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { InteractionManager, Platform } from 'react-native';

/**
 * Custom hook to prevent function recreation on every render
 * Use this for event handlers and API calls
 */
export const useStableCallback = (callback, deps = []) => {
  const callbackRef = useRef();
  callbackRef.current = callback;
  
  return useCallback((...args) => {
    return callbackRef.current(...args);
  }, deps);
};

/**
 * Custom hook to prevent object recreation on every render
 * Use this for complex objects passed as props
 */
export const useStableObject = (obj, deps) => {
  return useMemo(() => obj, deps);
};

/**
 * Debounce hook to prevent rapid successive calls
 * Useful for search inputs and API calls
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

/**
 * Prevent re-renders when props haven't actually changed
 */
export const shallowEqual = (objA, objB) => {
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  
  if (keysA.length !== keysB.length) {
    return false;
  }
  
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (objA[key] !== objB[key]) {
      return false;
    }
  }
  
  return true;
};

/**
 * Rate limiter to prevent excessive API calls
 */
export const useRateLimit = (callback, limit = 1000) => {
  const lastCall = useRef(0);
  
  return useCallback((...args) => {
    const now = Date.now();
    if (now - lastCall.current >= limit) {
      lastCall.current = now;
      return callback(...args);
    }
  }, [callback, limit]);
};

/**
 * Servicio avanzado de optimización de performance
 * Maneja debouncing, throttling, y optimizaciones específicas para mapas
 */
class PerformanceOptimizer {
  constructor() {
    this.debounceTimers = new Map();
    this.throttleTimers = new Map();
    this.performanceMetrics = {
      renderTimes: [],
      animationFrames: [],
      mapUpdates: 0,
      locationUpdates: 0,
      memoryUsage: []
    };
    this.isMonitoring = false;
  }

  /**
   * Debounce function que cancela ejecuciones anteriores
   */
  debounce(key, func, delay = 300) {
    if (this.debounceTimers.has(key)) {
      clearTimeout(this.debounceTimers.get(key));
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      func();
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Throttle function que limita la frecuencia de ejecución
   */
  throttle(key, func, limit = 100) {
    if (!this.throttleTimers.has(key)) {
      this.throttleTimers.set(key, true);
      
      func();
      
      setTimeout(() => {
        this.throttleTimers.delete(key);
      }, limit);
    }
  }

  /**
   * Optimizar actualizaciones de ubicación para mapas
   */
  optimizeLocationUpdates(callback, options = {}) {
    const {
      minDistance = 10,
      minTime = 5000,
      accuracy = 'high'
    } = options;

    let lastLocation = null;
    let lastUpdateTime = 0;

    return (newLocation) => {
      if (!newLocation) return;

      const now = Date.now();
      
      if (now - lastUpdateTime < minTime) {
        return;
      }

      if (lastLocation) {
        const distance = this.calculateDistance(
          lastLocation.latitude,
          lastLocation.longitude,
          newLocation.latitude,
          newLocation.longitude
        );

        if (distance < minDistance) {
          return;
        }
      }

      if (accuracy === 'high' && newLocation.accuracy > 50) {
        console.log('📍 Ubicación filtrada por baja precisión:', newLocation.accuracy);
        return;
      }

      lastLocation = newLocation;
      lastUpdateTime = now;
      this.performanceMetrics.locationUpdates++;

      this.throttle('location-update', () => callback(newLocation), 1000);
    };
  }

  /**
   * Optimizar actualizaciones de región del mapa
   */
  optimizeMapRegionUpdates(callback, options = {}) {
    const {
      debounceDelay = 500,
      maxUpdatesPerSecond = 2
    } = options;

    const throttleLimit = 1000 / maxUpdatesPerSecond;

    return (region) => {
      this.performanceMetrics.mapUpdates++;
      
      this.debounce('map-region-debounce', () => {
        this.throttle('map-region-throttle', () => {
          callback(region);
        }, throttleLimit);
      }, debounceDelay);
    };
  }

  /**
   * Optimizar renders de marcadores en mapa
   */
  optimizeMarkerRendering(markers, viewportBounds = null) {
    if (!markers || markers.length === 0) return [];

    let visibleMarkers = markers;
    if (viewportBounds) {
      visibleMarkers = markers.filter(marker => {
        return this.isMarkerInBounds(marker, viewportBounds);
      });
    }

    const maxMarkers = Platform.OS === 'ios' ? 100 : 50;
    if (visibleMarkers.length > maxMarkers) {
      visibleMarkers = this.prioritizeMarkers(visibleMarkers, maxMarkers);
    }

    return visibleMarkers.map(marker => ({
      ...marker,
      description: this.shouldShowDetails(marker) ? marker.description : undefined,
      image: this.shouldShowCustomImage(marker) ? marker.image : undefined
    }));
  }

  /**
   * Verificar si un marcador está dentro de los límites del viewport
   */
  isMarkerInBounds(marker, bounds) {
    const { latitude, longitude } = marker;
    return (
      latitude >= bounds.southWest.latitude &&
      latitude <= bounds.northEast.latitude &&
      longitude >= bounds.southWest.longitude &&
      longitude <= bounds.northEast.longitude
    );
  }

  /**
   * Priorizar marcadores por importancia
   */
  prioritizeMarkers(markers, maxCount) {
    return markers
      .sort((a, b) => {
        const priorities = {
          'current_delivery': 3,
          'pickup': 2,
          'destination': 2,
          'default': 1
        };
        
        const priorityA = priorities[a.type] || priorities.default;
        const priorityB = priorities[b.type] || priorities.default;
        
        return priorityB - priorityA;
      })
      .slice(0, maxCount);
  }

  /**
   * Determinar si mostrar detalles del marcador
   */
  shouldShowDetails(marker) {
    const importantTypes = ['current_delivery', 'pickup', 'destination'];
    return importantTypes.includes(marker.type);
  }

  /**
   * Determinar si mostrar imagen personalizada
   */
  shouldShowCustomImage(marker) {
    return marker.type === 'current_delivery';
  }

  /**
   * Optimizar animaciones de mapa
   */
  optimizeMapAnimations(animationConfig = {}) {
    const {
      duration = 1000,
      useNativeDriver = true,
      enableRedraw = false
    } = animationConfig;

    if (Platform.OS === 'android') {
      return {
        duration: Math.min(duration, 800),
        useNativeDriver,
        enableRedraw: false
      };
    } else {
      return {
        duration,
        useNativeDriver,
        enableRedraw
      };
    }
  }

  /**
   * Calcular distancia entre dos puntos (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convertir grados a radianes
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Ejecutar función después de que terminen las interacciones
   */
  runAfterInteractions(callback) {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(callback, 50);
    });
  }

  /**
   * Limpiar todos los timers y recursos
   */
  cleanup() {
    console.log('🧹 Limpiando PerformanceOptimizer...');
    
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
    this.throttleTimers.clear();
    
    console.log('✅ PerformanceOptimizer limpiado');
  }

  /**
   * Configurar optimizaciones específicas para delivery maps
   */
  static getDeliveryMapOptimizations() {
    return {
      locationOptions: {
        minDistance: 10,
        minTime: 3000,
        accuracy: 'high'
      },
      
      mapOptions: {
        debounceDelay: 300,
        maxUpdatesPerSecond: 3,
        maxMarkers: Platform.OS === 'ios' ? 20 : 15
      },
      
      animationOptions: {
        duration: Platform.OS === 'ios' ? 1000 : 600,
        useNativeDriver: true,
        enableRedraw: Platform.OS === 'ios'
      }
    };
  }
}

const performanceOptimizer = new PerformanceOptimizer();

export {
  PerformanceOptimizer,
  performanceOptimizer
};

export default {
  useStableCallback,
  useStableObject,
  useDebounce,
  shallowEqual,
  useRateLimit,
  performanceOptimizer
};