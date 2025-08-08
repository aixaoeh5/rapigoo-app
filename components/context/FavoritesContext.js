import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../api/apiClient';
import { Alert } from 'react-native';

const FavoritesContext = createContext();

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites debe ser usado dentro de FavoritesProvider');
  }
  return context;
};

export const FavoritesProvider = ({ children }) => {
  const [favorites, setFavorites] = useState({
    merchants: [],
    services: []
  });
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Cargar favoritos al inicializar
  useEffect(() => {
    loadFavorites();
  }, []);

  // Cargar favoritos desde AsyncStorage y sincronizar con servidor
  const loadFavorites = async () => {
    try {
      setLoading(true);
      
      // Cargar desde storage local primero
      const localFavorites = await AsyncStorage.getItem('favorites');
      if (localFavorites) {
        const parsed = JSON.parse(localFavorites);
        setFavorites(parsed);
      }

      // Sincronizar con servidor
      await syncFavorites();
      
    } catch (error) {
      console.error('Error cargando favoritos:', error);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  // Sincronizar favoritos con el servidor
  const syncFavorites = async () => {
    try {
      const response = await apiClient.get('/favorites');
      if (response.data.success) {
        const serverFavorites = {
          merchants: response.data.merchants || [],
          services: response.data.services || []
        };
        
        setFavorites(serverFavorites);
        await saveFavoritesToStorage(serverFavorites);
      }
    } catch (error) {
      console.error('Error sincronizando favoritos:', error);
      // Si falla la sincronización, usar datos locales
    }
  };

  // Guardar favoritos en AsyncStorage
  const saveFavoritesToStorage = async (favoritesData) => {
    try {
      await AsyncStorage.setItem('favorites', JSON.stringify(favoritesData));
    } catch (error) {
      console.error('Error guardando favoritos:', error);
    }
  };

  // Verificar si un comerciante está en favoritos
  const isMerchantFavorite = (merchantId) => {
    return favorites.merchants.some(merchant => merchant._id === merchantId);
  };

  // Verificar si un servicio está en favoritos
  const isServiceFavorite = (serviceId) => {
    return favorites.services.some(service => service._id === serviceId);
  };

  // Agregar comerciante a favoritos
  const addMerchantToFavorites = async (merchant) => {
    try {
      const newFavorites = {
        ...favorites,
        merchants: [...favorites.merchants, merchant]
      };

      setFavorites(newFavorites);
      await saveFavoritesToStorage(newFavorites);

      // Sincronizar con servidor
      await apiClient.post('/favorites/merchant', { merchantId: merchant._id });
      
      return true;
    } catch (error) {
      console.error('Error agregando comerciante a favoritos:', error);
      // Revertir cambio local si falla en servidor
      setFavorites(favorites);
      Alert.alert('Error', 'No se pudo agregar a favoritos');
      return false;
    }
  };

  // Remover comerciante de favoritos
  const removeMerchantFromFavorites = async (merchantId) => {
    try {
      const newFavorites = {
        ...favorites,
        merchants: favorites.merchants.filter(merchant => merchant._id !== merchantId)
      };

      setFavorites(newFavorites);
      await saveFavoritesToStorage(newFavorites);

      // Sincronizar con servidor
      await apiClient.delete(`/favorites/merchant/${merchantId}`);
      
      return true;
    } catch (error) {
      console.error('Error removiendo comerciante de favoritos:', error);
      // Revertir cambio local si falla en servidor
      setFavorites(favorites);
      Alert.alert('Error', 'No se pudo remover de favoritos');
      return false;
    }
  };

  // Toggle favorito de comerciante
  const toggleMerchantFavorite = async (merchant) => {
    if (isMerchantFavorite(merchant._id)) {
      return await removeMerchantFromFavorites(merchant._id);
    } else {
      return await addMerchantToFavorites(merchant);
    }
  };

  // Agregar servicio a favoritos
  const addServiceToFavorites = async (service) => {
    try {
      const newFavorites = {
        ...favorites,
        services: [...favorites.services, service]
      };

      setFavorites(newFavorites);
      await saveFavoritesToStorage(newFavorites);

      // Sincronizar con servidor
      await apiClient.post('/favorites/service', { serviceId: service._id });
      
      return true;
    } catch (error) {
      console.error('Error agregando servicio a favoritos:', error);
      // Revertir cambio local si falla en servidor
      setFavorites(favorites);
      Alert.alert('Error', 'No se pudo agregar a favoritos');
      return false;
    }
  };

  // Remover servicio de favoritos
  const removeServiceFromFavorites = async (serviceId) => {
    try {
      const newFavorites = {
        ...favorites,
        services: favorites.services.filter(service => service._id !== serviceId)
      };

      setFavorites(newFavorites);
      await saveFavoritesToStorage(newFavorites);

      // Sincronizar con servidor
      await apiClient.delete(`/favorites/service/${serviceId}`);
      
      return true;
    } catch (error) {
      console.error('Error removiendo servicio de favoritos:', error);
      // Revertir cambio local si falla en servidor
      setFavorites(favorites);
      Alert.alert('Error', 'No se pudo remover de favoritos');
      return false;
    }
  };

  // Toggle favorito de servicio
  const toggleServiceFavorite = async (service) => {
    if (isServiceFavorite(service._id)) {
      return await removeServiceFromFavorites(service._id);
    } else {
      return await addServiceToFavorites(service);
    }
  };

  // Limpiar todos los favoritos
  const clearAllFavorites = async () => {
    try {
      const emptyFavorites = { merchants: [], services: [] };
      setFavorites(emptyFavorites);
      await saveFavoritesToStorage(emptyFavorites);
      
      // Limpiar en servidor
      await apiClient.delete('/favorites/all');
      
      return true;
    } catch (error) {
      console.error('Error limpiando favoritos:', error);
      Alert.alert('Error', 'No se pudo limpiar favoritos');
      return false;
    }
  };

  // Obtener estadísticas de favoritos
  const getFavoritesStats = () => {
    return {
      totalMerchants: favorites.merchants.length,
      totalServices: favorites.services.length,
      total: favorites.merchants.length + favorites.services.length
    };
  };

  // Obtener favoritos por categoría
  const getFavoritesByCategory = () => {
    const merchantsByCategory = {};
    const servicesByCategory = {};

    favorites.merchants.forEach(merchant => {
      const category = merchant.business?.category || 'Otros';
      if (!merchantsByCategory[category]) {
        merchantsByCategory[category] = [];
      }
      merchantsByCategory[category].push(merchant);
    });

    favorites.services.forEach(service => {
      const category = service.category || 'Otros';
      if (!servicesByCategory[category]) {
        servicesByCategory[category] = [];
      }
      servicesByCategory[category].push(service);
    });

    return {
      merchants: merchantsByCategory,
      services: servicesByCategory
    };
  };

  // Buscar en favoritos
  const searchFavorites = (query) => {
    const searchTerm = query.toLowerCase();
    
    const matchingMerchants = favorites.merchants.filter(merchant => 
      merchant.business?.businessName?.toLowerCase().includes(searchTerm) ||
      merchant.business?.category?.toLowerCase().includes(searchTerm)
    );

    const matchingServices = favorites.services.filter(service =>
      service.name?.toLowerCase().includes(searchTerm) ||
      service.description?.toLowerCase().includes(searchTerm) ||
      service.merchantName?.toLowerCase().includes(searchTerm)
    );

    return {
      merchants: matchingMerchants,
      services: matchingServices,
      total: matchingMerchants.length + matchingServices.length
    };
  };

  // Exportar favoritos (para backup)
  const exportFavorites = async () => {
    try {
      const exportData = {
        ...favorites,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exportando favoritos:', error);
      return null;
    }
  };

  // Importar favoritos (desde backup)
  const importFavorites = async (favoritesData) => {
    try {
      const parsed = typeof favoritesData === 'string' 
        ? JSON.parse(favoritesData) 
        : favoritesData;

      if (parsed.merchants && parsed.services) {
        setFavorites({
          merchants: parsed.merchants,
          services: parsed.services
        });
        
        await saveFavoritesToStorage({
          merchants: parsed.merchants,
          services: parsed.services
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error importando favoritos:', error);
      return false;
    }
  };

  const value = {
    // Estado
    favorites,
    loading,
    initialized,
    
    // Verificaciones
    isMerchantFavorite,
    isServiceFavorite,
    
    // Acciones de comerciantes
    addMerchantToFavorites,
    removeMerchantFromFavorites,
    toggleMerchantFavorite,
    
    // Acciones de servicios
    addServiceToFavorites,
    removeServiceFromFavorites,
    toggleServiceFavorite,
    
    // Utilidades
    syncFavorites,
    clearAllFavorites,
    getFavoritesStats,
    getFavoritesByCategory,
    searchFavorites,
    exportFavorites,
    importFavorites
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};