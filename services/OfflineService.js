// services/OfflineService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import { CoordinateValidator } from '../utils/coordinateValidator';

/**
 * Servicio para manejo de funcionalidad offline
 * Permite que la app funcione sin conexión a internet
 */
class OfflineService {
  constructor() {
    this.isOnline = true;
    this.pendingActions = [];
    this.lastLocationSync = null;
    this.offlineData = {
      deliveryData: null,
      locationHistory: [],
      statusHistory: [],
      lastSync: null
    };
    
    // Configurar listener de conectividad
    this.setupNetworkListener();
  }

  /**
   * Configurar listener para cambios de conectividad
   */
  setupNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected;
      
      console.log('🌐 Estado de red:', this.isOnline ? 'ONLINE' : 'OFFLINE');
      
      // Si volvimos online, sincronizar datos pendientes
      if (wasOffline && this.isOnline) {
        this.syncPendingData();
      }
    });
  }

  /**
   * Verificar si la app está en modo offline
   */
  isOfflineMode() {
    return !this.isOnline;
  }

  /**
   * Guardar datos de delivery para modo offline
   */
  async saveDeliveryDataOffline(deliveryData) {
    try {
      const offlineData = {
        ...deliveryData,
        savedAt: Date.now(),
        isOfflineData: true
      };
      
      await AsyncStorage.setItem('offlineDeliveryData', JSON.stringify(offlineData));
      this.offlineData.deliveryData = offlineData;
      
      console.log('💾 Datos de delivery guardados para modo offline');
    } catch (error) {
      console.error('❌ Error guardando datos offline:', error);
    }
  }

  /**
   * Cargar datos de delivery desde storage offline
   */
  async loadDeliveryDataOffline() {
    try {
      const storedData = await AsyncStorage.getItem('offlineDeliveryData');
      if (storedData) {
        const deliveryData = JSON.parse(storedData);
        
        // Verificar que los datos no sean muy antiguos (24 horas)
        const ageInHours = (Date.now() - deliveryData.savedAt) / (1000 * 60 * 60);
        if (ageInHours < 24) {
          this.offlineData.deliveryData = deliveryData;
          console.log('📦 Datos de delivery cargados desde modo offline');
          return deliveryData;
        } else {
          console.warn('⚠️ Datos offline muy antiguos, descartando');
          await this.clearOfflineData();
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error cargando datos offline:', error);
      return null;
    }
  }

  /**
   * Guardar ubicación en historial offline
   */
  async saveLocationOffline(location) {
    try {
      // Validar ubicación antes de guardar
      const validatedLocation = CoordinateValidator.getSafeCoords(location);
      if (!validatedLocation) {
        console.warn('⚠️ Ubicación inválida, no se guarda en offline');
        return;
      }

      const locationEntry = {
        ...validatedLocation,
        timestamp: new Date().toISOString(),
        accuracy: location.accuracy || 0,
        speed: location.speed || 0,
        heading: location.heading || 0,
        isOffline: true
      };

      // Agregar al historial local
      this.offlineData.locationHistory.push(locationEntry);
      
      // Mantener solo las últimas 100 ubicaciones para no consumir mucho storage
      if (this.offlineData.locationHistory.length > 100) {
        this.offlineData.locationHistory = this.offlineData.locationHistory.slice(-100);
      }

      // Guardar en AsyncStorage
      await AsyncStorage.setItem('offlineLocationHistory', JSON.stringify(this.offlineData.locationHistory));
      
      console.log('📍 Ubicación guardada en modo offline:', validatedLocation);
    } catch (error) {
      console.error('❌ Error guardando ubicación offline:', error);
    }
  }

  /**
   * Guardar cambio de estado para sincronizar después
   */
  async saveStatusChangeOffline(statusChange) {
    try {
      const statusEntry = {
        ...statusChange,
        timestamp: new Date().toISOString(),
        isOffline: true,
        syncPending: true
      };

      this.offlineData.statusHistory.push(statusEntry);
      this.pendingActions.push({
        type: 'STATUS_UPDATE',
        data: statusEntry
      });

      // Guardar en AsyncStorage
      await AsyncStorage.setItem('offlineStatusHistory', JSON.stringify(this.offlineData.statusHistory));
      await AsyncStorage.setItem('pendingActions', JSON.stringify(this.pendingActions));
      
      console.log('📋 Cambio de estado guardado para sincronización:', statusEntry);
    } catch (error) {
      console.error('❌ Error guardando estado offline:', error);
    }
  }

  /**
   * Agregar acción a la cola de sincronización
   */
  async addPendingAction(type, data) {
    try {
      const action = {
        id: Date.now().toString(),
        type,
        data,
        timestamp: new Date().toISOString(),
        retries: 0,
        maxRetries: 3
      };

      this.pendingActions.push(action);
      await AsyncStorage.setItem('pendingActions', JSON.stringify(this.pendingActions));
      
      console.log('📝 Acción agregada a cola de sincronización:', type);
    } catch (error) {
      console.error('❌ Error agregando acción pendiente:', error);
    }
  }

  /**
   * Sincronizar datos pendientes cuando vuelva la conexión
   */
  async syncPendingData() {
    if (!this.isOnline || this.pendingActions.length === 0) {
      return;
    }

    console.log('🔄 Sincronizando datos pendientes:', this.pendingActions.length, 'acciones');

    const successfulActions = [];
    const failedActions = [];

    for (const action of this.pendingActions) {
      try {
        const success = await this.processPendingAction(action);
        if (success) {
          successfulActions.push(action);
        } else {
          action.retries += 1;
          if (action.retries >= action.maxRetries) {
            console.error('❌ Acción falló después de máximos reintentos:', action);
            failedActions.push(action);
          } else {
            failedActions.push(action);
          }
        }
      } catch (error) {
        console.error('❌ Error procesando acción pendiente:', error);
        action.retries += 1;
        if (action.retries < action.maxRetries) {
          failedActions.push(action);
        }
      }
    }

    // Actualizar cola con acciones no exitosas
    this.pendingActions = failedActions;
    await AsyncStorage.setItem('pendingActions', JSON.stringify(this.pendingActions));

    console.log('✅ Sincronización completada:', successfulActions.length, 'exitosas,', failedActions.length, 'pendientes');
  }

  /**
   * Procesar una acción pendiente específica
   */
  async processPendingAction(action) {
    try {
      switch (action.type) {
        case 'STATUS_UPDATE':
          return await this.syncStatusUpdate(action.data);
        case 'LOCATION_UPDATE':
          return await this.syncLocationUpdate(action.data);
        default:
          console.warn('⚠️ Tipo de acción desconocido:', action.type);
          return false;
      }
    } catch (error) {
      console.error('❌ Error procesando acción:', action.type, error);
      return false;
    }
  }

  /**
   * Sincronizar actualización de estado con el servidor
   */
  async syncStatusUpdate(statusData) {
    try {
      // Simular llamada a API - reemplazar con apiClient real
      console.log('📤 Sincronizando estado:', statusData);
      
      // const response = await apiClient.put(`/delivery/${statusData.deliveryId}/status`, statusData);
      // return response.data?.success || false;
      
      // Por ahora, simular éxito
      return true;
    } catch (error) {
      console.error('❌ Error sincronizando estado:', error);
      return false;
    }
  }

  /**
   * Sincronizar actualización de ubicación con el servidor
   */
  async syncLocationUpdate(locationData) {
    try {
      // Simular llamada a API - reemplazar con apiClient real
      console.log('📤 Sincronizando ubicación:', locationData);
      
      // const response = await apiClient.put(`/delivery/${locationData.deliveryId}/location`, locationData);
      // return response.data?.success || false;
      
      // Por ahora, simular éxito
      return true;
    } catch (error) {
      console.error('❌ Error sincronizando ubicación:', error);
      return false;
    }
  }

  /**
   * Obtener historial de ubicaciones offline
   */
  async getLocationHistory() {
    try {
      const storedHistory = await AsyncStorage.getItem('offlineLocationHistory');
      if (storedHistory) {
        this.offlineData.locationHistory = JSON.parse(storedHistory);
        return this.offlineData.locationHistory;
      }
      return [];
    } catch (error) {
      console.error('❌ Error obteniendo historial de ubicaciones:', error);
      return [];
    }
  }

  /**
   * Obtener historial de estados offline
   */
  async getStatusHistory() {
    try {
      const storedHistory = await AsyncStorage.getItem('offlineStatusHistory');
      if (storedHistory) {
        this.offlineData.statusHistory = JSON.parse(storedHistory);
        return this.offlineData.statusHistory;
      }
      return [];
    } catch (error) {
      console.error('❌ Error obteniendo historial de estados:', error);
      return [];
    }
  }

  /**
   * Cargar acciones pendientes desde storage
   */
  async loadPendingActions() {
    try {
      const storedActions = await AsyncStorage.getItem('pendingActions');
      if (storedActions) {
        this.pendingActions = JSON.parse(storedActions);
        console.log('📋 Acciones pendientes cargadas:', this.pendingActions.length);
      }
    } catch (error) {
      console.error('❌ Error cargando acciones pendientes:', error);
    }
  }

  /**
   * Obtener estadísticas del modo offline
   */
  getOfflineStats() {
    return {
      isOnline: this.isOnline,
      pendingActions: this.pendingActions.length,
      locationHistoryCount: this.offlineData.locationHistory.length,
      statusHistoryCount: this.offlineData.statusHistory.length,
      hasOfflineData: !!this.offlineData.deliveryData,
      lastSync: this.offlineData.lastSync
    };
  }

  /**
   * Verificar si hay datos offline disponibles
   */
  async hasOfflineData() {
    try {
      const deliveryData = await AsyncStorage.getItem('offlineDeliveryData');
      const locationHistory = await AsyncStorage.getItem('offlineLocationHistory');
      const statusHistory = await AsyncStorage.getItem('offlineStatusHistory');
      
      return !!(deliveryData || locationHistory || statusHistory);
    } catch (error) {
      console.error('❌ Error verificando datos offline:', error);
      return false;
    }
  }

  /**
   * Limpiar todos los datos offline
   */
  async clearOfflineData() {
    try {
      await AsyncStorage.multiRemove([
        'offlineDeliveryData',
        'offlineLocationHistory',
        'offlineStatusHistory',
        'pendingActions'
      ]);
      
      this.offlineData = {
        deliveryData: null,
        locationHistory: [],
        statusHistory: [],
        lastSync: null
      };
      this.pendingActions = [];
      
      console.log('🧹 Datos offline limpiados completamente');
    } catch (error) {
      console.error('❌ Error limpiando datos offline:', error);
    }
  }

  /**
   * Forzar sincronización manual
   */
  async forceSyncNow() {
    if (!this.isOnline) {
      console.warn('⚠️ No hay conexión para sincronizar');
      return false;
    }

    console.log('🔄 Forzando sincronización manual...');
    await this.syncPendingData();
    
    // Actualizar timestamp de última sincronización
    this.offlineData.lastSync = new Date().toISOString();
    
    return true;
  }

  /**
   * Inicializar servicio offline
   */
  async initialize() {
    try {
      console.log('🚀 Inicializando OfflineService...');
      
      // Cargar acciones pendientes
      await this.loadPendingActions();
      
      // Cargar historial offline
      await this.getLocationHistory();
      await this.getStatusHistory();
      
      // Si estamos online, intentar sincronizar
      if (this.isOnline && this.pendingActions.length > 0) {
        setTimeout(() => this.syncPendingData(), 2000); // Delay para permitir inicialización completa
      }
      
      console.log('✅ OfflineService inicializado:', this.getOfflineStats());
    } catch (error) {
      console.error('❌ Error inicializando OfflineService:', error);
    }
  }

  /**
   * Cleanup del servicio
   */
  cleanup() {
    console.log('🧹 Limpiando OfflineService...');
    // NetInfo maneja su propio cleanup automáticamente
  }
}

// Exportar instancia singleton
export default new OfflineService();