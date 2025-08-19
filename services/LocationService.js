import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoordinateValidator } from '../utils/coordinateValidator';

class LocationService {
  constructor() {
    this.currentLocation = null;
    this.watchId = null;
    this.locationPermissionGranted = false;
    // FIX: Agregar referencias para cleanup
    this.activeCallbacks = new Set();
    this.cleanupTimers = new Set();
    this.isWatching = false;
  }

  // FIX: Mejorar cleanup de callbacks
  addCallback(callback) {
    if (typeof callback === 'function') {
      this.activeCallbacks.add(callback);
    }
  }

  removeCallback(callback) {
    this.activeCallbacks.delete(callback);
  }

  // FIX: Cleanup completo de todos los callbacks
  clearAllCallbacks() {
    this.activeCallbacks.clear();
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

  // FIX: Mejorar getCurrentLocation con mejor error handling
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
      // FIX: Agregar timeout personalizado para evitar hanging
      const timeoutId = setTimeout(() => {
        reject(new Error('LOCATION_TIMEOUT'));
      }, defaultOptions.timeout + 1000);
      
      this.cleanupTimers.add(timeoutId);

      Geolocation.getCurrentPosition(
        (position) => {
          // FIX: Limpiar timeout
          clearTimeout(timeoutId);
          this.cleanupTimers.delete(timeoutId);
          
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };

          // FIX: Validar coordenadas antes de guardar
          if (this.validateCoordinates(location)) {
            this.currentLocation = location;
            this.saveLocationToStorage(location);
            resolve(location);
          } else {
            reject(new Error('INVALID_COORDINATES'));
          }
        },
        (error) => {
          // FIX: Limpiar timeout
          clearTimeout(timeoutId);
          this.cleanupTimers.delete(timeoutId);
          
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

  // FIX: Mejorar startLocationTracking con cleanup adecuado
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

    // FIX: Detener tracking anterior si existe
    if (this.isWatching) {
      this.stopLocationTracking();
    }

    // FIX: Agregar callback a la lista de activos
    if (callback) {
      this.addCallback(callback);
    }

    // FIX: Wrapper para callback que incluye cleanup automático
    const wrappedCallback = (position) => {
      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      };

      // FIX: Validar coordenadas
      if (this.validateCoordinates(location)) {
        this.currentLocation = location;
        this.saveLocationToStorage(location);
        
        // FIX: Solo llamar callbacks activos
        this.activeCallbacks.forEach(cb => {
          try {
            if (typeof cb === 'function') {
              cb(location);
            }
          } catch (error) {
            console.error('Error en callback de ubicación:', error);
          }
        });
      }
    };

    const wrappedErrorCallback = (error) => {
      console.error('Error en seguimiento de ubicación:', error);
      
      // FIX: Solo llamar callbacks activos para errores
      this.activeCallbacks.forEach(cb => {
        try {
          if (typeof cb === 'function') {
            cb(null, error);
          }
        } catch (callbackError) {
          console.error('Error en callback de error:', callbackError);
        }
      });
    };

    this.watchId = Geolocation.watchPosition(
      wrappedCallback,
      wrappedErrorCallback,
      defaultOptions
    );

    this.isWatching = true;
    console.log('📍 Seguimiento de ubicación iniciado con watchId:', this.watchId);

    return this.watchId;
  }

  // FIX: Mejorar stopLocationTracking con cleanup completo
  stopLocationTracking() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.isWatching = false;
      console.log('📍 Seguimiento de ubicación detenido');
    }
    
    // FIX: Limpiar callbacks activos
    this.clearAllCallbacks();
    
    // FIX: Limpiar timers pendientes
    this.cleanupTimers.forEach(timerId => {
      clearTimeout(timerId);
    });
    this.cleanupTimers.clear();
  }

  // FIX: Agregar validación de coordenadas
  validateCoordinates(location) {
    if (!location || typeof location !== 'object') {
      return false;
    }
    
    const { latitude, longitude } = location;
    
    return (
      typeof latitude === 'number' && 
      typeof longitude === 'number' &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180 &&
      !isNaN(latitude) && !isNaN(longitude)
    );
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
      // FIX: Validar coordenadas antes de procesar
      if (!this.validateCoordinates({ latitude, longitude })) {
        throw new Error('Coordenadas inválidas');
      }
      
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

      // FIX: Validar ubicación actual
      if (!this.validateCoordinates(this.currentLocation)) {
        throw new Error('Ubicación actual inválida');
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

  // FIX: Mejorar saveLocationToStorage con mejor error handling
  async saveLocationToStorage(location) {
    try {
      if (!this.validateCoordinates(location)) {
        console.warn('⚠️ Intentando guardar ubicación inválida:', location);
        return;
      }
      
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
        if (ageInHours < 6 && this.validateCoordinates(location)) {
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

  // FIX: Mejorar getLocationWithFallback sin recursión
  async getLocationWithFallback() {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // Intentar obtener ubicación actual
        return await this.getCurrentLocation({ 
          timeout: 10000 - (attempts * 2000) // Reducir timeout en cada intento
        });
      } catch (error) {
        console.warn(`Intento ${attempts + 1} falló:`, error.message);
        attempts++;
        
        if (attempts >= maxAttempts) {
          // Intentar cargar última ubicación conocida
          const lastLocation = await this.loadLastKnownLocation();
          if (lastLocation) {
            console.log('✅ Usando última ubicación conocida');
            return lastLocation;
          }
          
          // Si no hay ubicación, mostrar diálogo
          if (error.message === 'PERMISSION_DENIED') {
            this.showLocationSettingsDialog();
          }
          
          throw new Error(`No se pudo obtener ubicación después de ${maxAttempts} intentos: ${error.message}`);
        }
        
        // Esperar antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  // Verificar si el servicio de ubicación está disponible
  isLocationEnabled() {
    return this.locationPermissionGranted && this.currentLocation !== null;
  }

  // FIX: Mejorar cleanup con limpieza completa
  cleanup() {
    console.log('🧹 Limpiando LocationService...');
    
    // Detener tracking
    this.stopLocationTracking();
    
    // Limpiar estado
    this.currentLocation = null;
    this.locationPermissionGranted = false;
    
    // Limpiar callbacks y timers
    this.clearAllCallbacks();
    this.cleanupTimers.forEach(timerId => {
      clearTimeout(timerId);
    });
    this.cleanupTimers.clear();
    
    console.log('✅ LocationService limpiado completamente');
  }
}

// Exportar instancia singleton
export default new LocationService();