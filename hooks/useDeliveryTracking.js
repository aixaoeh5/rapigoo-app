// hooks/useDeliveryTracking.js
import { useState, useEffect, useCallback } from 'react';
import realTimeService from '../services/realTimeService';
import apiClient from '../api/apiClient';

export const useDeliveryTracking = (orderId) => {
  const [deliveryData, setDeliveryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eta, setEta] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(false);

  const handleUpdate = useCallback((event, data) => {
    console.log('📨 Received update:', event, data);
    
    switch (event) {
      case 'location_update':
        setDeliveryData(prev => {
          if (!prev) return null;
          
          return {
            ...prev,
            currentLocation: data.location,
            lastLocationUpdate: data.timestamp || new Date().toISOString()
          };
        });
        break;
      
      case 'status_update':
        setDeliveryData(prev => {
          if (!prev) return null;
          
          return {
            ...prev,
            status: data.status,
            statusHistory: [...(prev.statusHistory || []), {
              status: data.status,
              timestamp: data.timestamp || new Date().toISOString(),
              notes: data.notes
            }]
          };
        });
        break;
      
      case 'eta_update':
        setEta(data.eta);
        break;
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!orderId) {
      setError('Order ID is required');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔄 Loading delivery tracking for order:', orderId);
      
      const response = await apiClient.get(`/delivery/order/${orderId}`);
      
      if (response.data.success) {
        const trackingData = response.data.data.deliveryTracking;
        
        // Validar estructura de datos antes de guardar
        console.log('✅ Delivery tracking loaded:', {
          id: trackingData?._id,
          status: trackingData?.status,
          hasCurrentLocation: !!trackingData?.currentLocation,
          hasDeliveryLocation: !!trackingData?.deliveryLocation,
          currentCoords: trackingData?.currentLocation?.coordinates,
          deliveryCoords: trackingData?.deliveryLocation?.coordinates
        });
        
        setDeliveryData(trackingData);
        
        // Conectar al servicio de tiempo real
        if (!realTimeService.getConnectionStatus().isConnected) {
          await realTimeService.connect();
        }
        
        // Suscribirse a actualizaciones
        realTimeService.subscribeToOrder(orderId, handleUpdate);
        setConnectionStatus(true);
        
      } else {
        setError(response.data.error?.message || 'Failed to load tracking data');
      }
    } catch (err) {
      const isNotFound = err.response?.status === 404;
      const isNetworkError = !err.response;
      const isUnauthorized = err.response?.status === 401 || err.response?.status === 403;
      
      let errorMessage = 'Failed to load tracking data';
      
      if (isNotFound) {
        // Para pedidos sin delivery asignado, esto es normal - no es realmente un error
        console.log('✅ Pedido sin delivery asignado - Esto es normal para pedidos en preparación:', orderId);
        setError(null); // No mostrar como error
        setDeliveryData(null); // Asegurar que no hay datos de delivery
        setIsLoading(false);
        return; // Salir sin setear error
      }
      
      // Solo mostrar error si realmente es un error (no un 404 esperado)
      console.error('❌ Error loading delivery tracking:', err);
      
      if (isNetworkError) {
        errorMessage = 'Error de conexión';
        console.log('🌐 Error de red al cargar tracking');
      } else if (isUnauthorized) {
        errorMessage = 'No tienes acceso a este pedido';
        console.log('🚫 Acceso denegado al tracking');
      } else {
        errorMessage = err.response?.data?.error?.message || err.message || 'Error desconocido';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, handleUpdate]);

  const refreshTracking = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  const updateStatus = useCallback(async (newStatus, notes = '') => {
    if (!deliveryData) return false;

    try {
      const response = await apiClient.put(`/delivery/${deliveryData._id}/status`, {
        status: newStatus,
        notes
      });

      if (response.data.success) {
        // El estado se actualizará via WebSocket
        return true;
      } else {
        setError(response.data.error?.message || 'Failed to update status');
        return false;
      }
    } catch (err) {
      console.error('❌ Error updating status:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to update status');
      return false;
    }
  }, [deliveryData]);

  const updateLocation = useCallback(async (location) => {
    if (!deliveryData) return false;

    try {
      const response = await apiClient.put(`/delivery/${deliveryData._id}/location`, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading
      });

      if (response.data.success) {
        // Emitir actualización en tiempo real
        realTimeService.emitLocationUpdate({
          orderId: deliveryData.orderId,
          deliveryPersonId: deliveryData.deliveryPersonId,
          location,
          status: deliveryData.status
        });
        
        return true;
      } else {
        console.error('Failed to update location:', response.data.error);
        return false;
      }
    } catch (err) {
      console.error('❌ Error updating location:', err);
      return false;
    }
  }, [deliveryData]);

  useEffect(() => {
    loadInitialData();

    // Cleanup function
    return () => {
      if (orderId) {
        realTimeService.unsubscribeFromOrder(orderId, handleUpdate);
      }
    };
  }, [orderId, loadInitialData, handleUpdate]);

  // Limpiar suscripción cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (orderId) {
        realTimeService.unsubscribeFromOrder(orderId, handleUpdate);
      }
    };
  }, []);

  return {
    deliveryData,
    isLoading,
    error,
    eta,
    connectionStatus,
    refreshTracking,
    updateStatus,
    updateLocation
  };
};

export default useDeliveryTracking;