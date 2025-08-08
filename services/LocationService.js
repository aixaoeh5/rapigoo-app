import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';

class LocationService {
  constructor() {
    this.currentLocation = null;
    this.watchId = null;
    this.locationPermissionGranted = false;
  }

  // Solicitar permisos de ubicación
  async requestLocationPermission() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permisos de Ubicación',
            message: 'Rapigoo necesita acceso a tu ubicación para encontrar comerciantes cerca de ti.',
            buttonNeutral: 'Preguntar después',
            buttonNegative: 'Cancelar',
            buttonPositive: 'Permitir',
          }
        );

        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          this.locationPermissionGranted = true;
          console.log('✅ Permisos de ubicación concedidos');
          return true;
        } else {
          console.log('❌ Permisos de ubicación denegados');
          return false;
        }
      } catch (err) {
        console.error('Error solicitando permisos:', err);
        return false;
      }
    } else {
      // Para iOS, los permisos se manejan automáticamente
      this.locationPermissionGranted = true;
      return true;
    }
  }

  // Mostrar diálogo para abrir configuración
  showLocationSettingsDialog() {
    Alert.alert(
      'Ubicación Deshabilitada',
      'Para una mejor experiencia, habilita los permisos de ubicación en la configuración de la aplicación.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Abrir Configuración',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  }

  // Obtener ubicación actual
  async getCurrentLocation(options = {}) {
    const defaultOptions = {
      timeout: 15000,
      maximumAge: 300000, // 5 minutos
      enableHighAccuracy: true,
      ...options
    };

    // Verificar permisos primero
    if (!this.locationPermissionGranted) {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        throw new Error('PERMISSION_DENIED');
      }
    }

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };

          this.currentLocation = location;
          this.saveLocationToStorage(location);
          resolve(location);
        },
        (error) => {
          console.error('Error obteniendo ubicación:', error);
          
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              reject(new Error('PERMISSION_DENIED'));
              break;
            case 2: // POSITION_UNAVAILABLE
              reject(new Error('POSITION_UNAVAILABLE'));
              break;
            case 3: // TIMEOUT
              reject(new Error('TIMEOUT'));
              break;
            default:
              reject(new Error('UNKNOWN_ERROR'));
          }
        },
        defaultOptions
      );
    });
  }

  // Iniciar seguimiento de ubicación
  async startLocationTracking(callback, options = {}) {
    const defaultOptions = {
      timeout: 30000,
      maximumAge: 60000, // 1 minuto
      enableHighAccuracy: false,
      distanceFilter: 100, // metros
      ...options
    };

    if (!this.locationPermissionGranted) {
      const hasPermission = await this.requestLocationPermission();
      if (!hasPermission) {
        throw new Error('PERMISSION_DENIED');
      }
    }

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        };

        this.currentLocation = location;
        this.saveLocationToStorage(location);
        
        if (callback) {
          callback(location);
        }
      },
      (error) => {
        console.error('Error en seguimiento de ubicación:', error);
        if (callback) {
          callback(null, error);
        }
      },
      defaultOptions
    );

    return this.watchId;
  }

  // Detener seguimiento de ubicación
  stopLocationTracking() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      console.log('📍 Seguimiento de ubicación detenido');
    }
  }

  // Calcular distancia entre dos puntos (en km)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  // Formatear distancia para mostrar
  formatDistance(distance) {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else if (distance < 10) {
      return `${distance.toFixed(1)}km`;
    } else {
      return `${Math.round(distance)}km`;
    }
  }

  // Convertir grados a radianes
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Obtener dirección aproximada desde coordenadas (geocodificación inversa)
  async reverseGeocode(latitude, longitude) {
    try {
      // Nota: En producción, usar un servicio como Google Geocoding API
      // Por ahora, retornamos coordenadas formateadas
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Error en geocodificación inversa:', error);
      return 'Ubicación desconocida';
    }
  }

  // Buscar comerciantes cercanos
  async findNearbyMerchants(radius = 10, options = {}) {
    try {
      if (!this.currentLocation) {
        await this.getCurrentLocation();
      }

      const { latitude, longitude } = this.currentLocation;
      
      // Aquí integrarías con tu API de búsqueda
      const searchParams = {
        location: {
          latitude,
          longitude,
          radius
        },
        type: 'merchants',
        sortBy: 'distance',
        limit: options.limit || 20,
        category: options.category,
        minRating: options.minRating
      };

      // Simular llamada a API (reemplazar con apiClient.get('/search', { params: searchParams }))
      console.log('🔍 Buscando comerciantes cercanos:', searchParams);
      
      return {
        success: true,
        merchants: [],
        userLocation: this.currentLocation,
        searchRadius: radius
      };

    } catch (error) {
      console.error('Error buscando comerciantes cercanos:', error);
      throw error;
    }
  }

  // Guardar ubicación en storage local
  async saveLocationToStorage(location) {
    try {
      await AsyncStorage.setItem('lastKnownLocation', JSON.stringify({
        ...location,
        savedAt: Date.now()
      }));
    } catch (error) {
      console.error('Error guardando ubicación:', error);
    }
  }

  // Cargar última ubicación conocida
  async loadLastKnownLocation() {
    try {
      const locationData = await AsyncStorage.getItem('lastKnownLocation');
      if (locationData) {
        const location = JSON.parse(locationData);
        const ageInHours = (Date.now() - location.savedAt) / (1000 * 60 * 60);
        
        // Si la ubicación tiene menos de 6 horas, la usamos
        if (ageInHours < 6) {
          this.currentLocation = location;
          return location;
        }
      }
      return null;
    } catch (error) {
      console.error('Error cargando ubicación:', error);
      return null;
    }
  }

  // Obtener ubicación con fallback
  async getLocationWithFallback() {
    try {
      // Intentar obtener ubicación actual
      return await this.getCurrentLocation({ timeout: 10000 });
    } catch (error) {
      console.warn('No se pudo obtener ubicación actual, usando última conocida');
      
      // Intentar cargar última ubicación conocida
      const lastLocation = await this.loadLastKnownLocation();
      if (lastLocation) {
        return lastLocation;
      }
      
      // Si no hay ubicación, mostrar diálogo
      if (error.message === 'PERMISSION_DENIED') {
        this.showLocationSettingsDialog();
      }
      
      throw error;
    }
  }

  // Verificar si el servicio de ubicación está disponible
  isLocationEnabled() {
    return this.locationPermissionGranted && this.currentLocation !== null;
  }

  // Limpiar datos del servicio
  cleanup() {
    this.stopLocationTracking();
    this.currentLocation = null;
    this.locationPermissionGranted = false;
  }
}

// Exportar instancia singleton
export default new LocationService();