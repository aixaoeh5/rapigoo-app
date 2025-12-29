// config/mapConfig.js
import { Platform } from 'react-native';

export const MAP_CONFIG = {
  // Configuración de Google Maps
  apiKey: 'AIzaSyDqE-L2_sObvQVl5gWlJaRVF2rIzH5Ztkg',
  
  // Configuración por defecto para República Dominicana
  defaultRegion: {
    latitude: 18.4861,   // Santo Domingo
    longitude: -69.9312,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  },
  
  // Configuración del mapa
  mapOptions: {
    showsUserLocation: true,
    showsMyLocationButton: true,
    showsCompass: true,
    showsScale: true,
    showsBuildings: true,
    showsTraffic: false,
    showsIndoors: true,
    rotateEnabled: true,
    scrollEnabled: true,
    zoomEnabled: true,
    pitchEnabled: true,
    mapType: 'standard', // 'standard', 'satellite', 'hybrid', 'terrain'
  },
  
  // Configuración de marcadores
  markerConfig: {
    pickup: {
      pinColor: '#FF9800',
      title: 'Punto de Recogida',
      icon: '🏪'
    },
    delivery: {
      pinColor: '#4CAF50', 
      title: 'Punto de Entrega',
      icon: '🏠'
    },
    current: {
      pinColor: '#2196F3',
      title: 'Tu ubicación',
      icon: '📍'
    }
  },
  
  // Configuración de permisos
  locationPermissions: {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,
    distanceFilter: 10,
  },
  
  // Configuración específica por plataforma
  platform: {
    android: {
      provider: 'google',
      showsMyLocationButton: true,
    },
    ios: {
      provider: 'google',
      showsPointsOfInterest: true,
    }
  }
};

// Función helper para obtener configuración del mapa
export const getMapConfig = () => {
  const baseConfig = {
    ...MAP_CONFIG.mapOptions,
    initialRegion: MAP_CONFIG.defaultRegion,
  };

  // Agregar configuración específica de plataforma
  if (Platform.OS === 'android') {
    return {
      ...baseConfig,
      ...MAP_CONFIG.platform.android,
    };
  } else if (Platform.OS === 'ios') {
    return {
      ...baseConfig,
      ...MAP_CONFIG.platform.ios,
    };
  }

  return baseConfig;
};

// Función helper para obtener estilos de marcador
export const getMarkerStyle = (type) => {
  return MAP_CONFIG.markerConfig[type] || MAP_CONFIG.markerConfig.current;
};

// Función helper para validar API key
export const isMapConfigured = () => {
  return !!MAP_CONFIG.apiKey && MAP_CONFIG.apiKey !== '';
};

export default MAP_CONFIG;