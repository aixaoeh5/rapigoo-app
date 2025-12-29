import { useEffect } from 'react';
import { Alert } from 'react-native';
import realTimeService from '../services/realTimeService';
import { DELIVERY_STATE_LABELS } from '../utils/navigationStates';
import ActiveDeliveryManager from '../utils/activeDeliveryManager';

export const useDeliveryNotifications = (orderId, deliveryPersonId, onStatusChange) => {
  useEffect(() => {
    const handleAutomaticStatusChange = (data) => {
      if (data.automatic && (data.orderId === orderId || data.deliveryPersonId === deliveryPersonId)) {
        console.log('🔔 Cambio de estado automático recibido:', data.status);
        
        // Actualizar el manager de entrega activa
        ActiveDeliveryManager.updateActiveDeliveryStatus(data.status);
        
        // Llamar al callback del componente padre
        if (onStatusChange) {
          onStatusChange(data.status, data);
        }
        
        // Mostrar notificación visual al usuario
        const statusLabel = DELIVERY_STATE_LABELS[data.status] || data.status;
        const messages = {
          'at_pickup': '📍 Has llegado al restaurante automáticamente',
          'at_delivery': '🏠 Has llegado al destino automáticamente',
        };
        
        const message = messages[data.status] || `Estado actualizado a: ${statusLabel}`;
        
        Alert.alert(
          'Detección Automática',
          message,
          [{ text: 'OK' }]
        );
      }
    };
    
    const handleLocationUpdate = (data) => {
      if (data.orderId === orderId || data.deliveryPersonId === deliveryPersonId) {
        console.log('📍 Actualización de ubicación recibida');
        // El componente padre puede manejar esto si necesita
      }
    };
    
    // Suscribirse a eventos
    realTimeService.on('statusUpdate', handleAutomaticStatusChange);
    realTimeService.on('locationUpdate', handleLocationUpdate);
    
    return () => {
      // Limpiar suscripciones
      realTimeService.off('statusUpdate', handleAutomaticStatusChange);
      realTimeService.off('locationUpdate', handleLocationUpdate);
    };
  }, [orderId, deliveryPersonId, onStatusChange]);
  
  return {
    // Función para emitir manualmente una actualización de estado
    emitStatusUpdate: (status, data = {}) => {
      realTimeService.emitStatusUpdate({
        orderId,
        deliveryPersonId,
        status,
        ...data
      });
    },
    
    // Función para emitir manualmente una actualización de ubicación
    emitLocationUpdate: (location, status) => {
      realTimeService.emitLocationUpdate({
        orderId,
        deliveryPersonId,
        location,
        status
      });
    }
  };
};