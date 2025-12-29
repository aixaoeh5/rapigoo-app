// utils/activeDeliveryManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_DELIVERY_KEY = 'activeDelivery';

export const ActiveDeliveryManager = {
  // Guardar entrega activa
  async setActiveDelivery(deliveryData) {
    try {
      const data = {
        trackingId: deliveryData.trackingId,
        orderId: deliveryData.orderId,
        status: deliveryData.status,
        timestamp: new Date().toISOString()
      };
      
      await AsyncStorage.setItem(ACTIVE_DELIVERY_KEY, JSON.stringify(data));
      console.log('✅ Entrega activa guardada:', data);
      return true;
    } catch (error) {
      console.error('❌ Error guardando entrega activa:', error);
      return false;
    }
  },

  // Obtener entrega activa
  async getActiveDelivery() {
    try {
      const data = await AsyncStorage.getItem(ACTIVE_DELIVERY_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        
        // Verificar que no sea muy antigua (más de 24 horas)
        const timestamp = new Date(parsed.timestamp);
        const now = new Date();
        const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
          console.log('⚠️ Entrega activa muy antigua, eliminando...');
          await this.clearActiveDelivery();
          return null;
        }
        
        return parsed;
      }
      return null;
    } catch (error) {
      console.error('❌ Error obteniendo entrega activa:', error);
      return null;
    }
  },

  // Limpiar entrega activa
  async clearActiveDelivery() {
    try {
      await AsyncStorage.removeItem(ACTIVE_DELIVERY_KEY);
      console.log('✅ Entrega activa eliminada del storage');
      return true;
    } catch (error) {
      console.error('❌ Error eliminando entrega activa:', error);
      return false;
    }
  },

  // Verificar si hay entrega activa
  async hasActiveDelivery() {
    const delivery = await this.getActiveDelivery();
    return delivery !== null;
  },

  // Actualizar status de entrega activa
  async updateActiveDeliveryStatus(newStatus) {
    try {
      const current = await this.getActiveDelivery();
      if (current) {
        current.status = newStatus;
        current.timestamp = new Date().toISOString();
        
        await AsyncStorage.setItem(ACTIVE_DELIVERY_KEY, JSON.stringify(current));
        console.log('✅ Status de entrega activa actualizado:', newStatus);
        
        // Si se completó o canceló, limpiar después de un breve delay
        if (['delivered', 'cancelled'].includes(newStatus)) {
          console.log('🏁 Entrega completada, limpiando después de 2 segundos...');
          setTimeout(async () => {
            await this.clearActiveDelivery();
          }, 2000);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error actualizando status de entrega activa:', error);
      return false;
    }
  },

  // Verificar si el estado actual requiere navegación
  async shouldNavigateToDelivery() {
    try {
      const delivery = await this.getActiveDelivery();
      if (!delivery) return false;
      
      // Verificar que tenga IDs válidos
      if (!delivery.trackingId || !delivery.orderId) {
        console.log('⚠️ Delivery sin IDs válidos, no navegando:', delivery);
        await this.clearActiveDelivery();
        return false;
      }
      
      // Verificar que no sea muy antigua (más de 6 horas)
      const timestamp = new Date(delivery.timestamp);
      const now = new Date();
      const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
      
      if (hoursDiff > 6) {
        console.log('⚠️ Delivery muy antigua (>6h), limpiando:', { hoursDiff });
        await this.clearActiveDelivery();
        return false;
      }
      
      const activeStates = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'];
      const shouldNavigate = activeStates.includes(delivery.status);
      
      console.log('🔍 shouldNavigateToDelivery:', {
        hasDelivery: !!delivery,
        trackingId: delivery.trackingId,
        orderId: delivery.orderId,
        status: delivery.status,
        age: Math.round(hoursDiff * 100) / 100,
        shouldNavigate
      });
      
      return shouldNavigate;
    } catch (error) {
      console.error('❌ Error verificando si debe navegar:', error);
      return false;
    }
  },

  // Obtener información completa de la entrega activa
  async getActiveDeliveryInfo() {
    try {
      const delivery = await this.getActiveDelivery();
      if (!delivery) return null;
      
      return {
        ...delivery,
        isActive: await this.shouldNavigateToDelivery(),
        age: Math.floor((new Date() - new Date(delivery.timestamp)) / (1000 * 60)) // minutos
      };
    } catch (error) {
      console.error('❌ Error obteniendo info de entrega activa:', error);
      return null;
    }
  }
};

export default ActiveDeliveryManager;