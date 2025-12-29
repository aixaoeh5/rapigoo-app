/**
 * Sistema de transiciones automáticas para delivery
 * Elimina botones manuales y usa solo detección por GPS
 */

export const AUTO_TRANSITION_CONFIG = {
  // Distancias de detección (metros)
  PICKUP_RADIUS: 100,    // Más conservador para restaurantes
  DELIVERY_RADIUS: 200,  // Más amplio para casas/edificios
  
  // Tiempos de debounce (milisegundos)
  DEBOUNCE_TIME: 15000,  // 15 segundos entre detecciones
  CONFIRMATION_DELAY: 3000, // 3 segundos para confirmar
  
  // Estados que permiten transición automática
  AUTO_STATES: {
    PICKUP: ['assigned', 'heading_to_pickup'],
    DELIVERY: ['picked_up', 'heading_to_delivery']
  }
};

export const getAutoTransitionState = (currentStatus, distanceToPickup, distanceToDelivery) => {
  const { PICKUP_RADIUS, DELIVERY_RADIUS, AUTO_STATES } = AUTO_TRANSITION_CONFIG;
  
  // Determinar si está cerca del pickup
  const isNearPickup = distanceToPickup !== null && distanceToPickup <= PICKUP_RADIUS;
  const canTransitionToPickup = AUTO_STATES.PICKUP.includes(currentStatus);
  
  // Determinar si está cerca del delivery
  const isNearDelivery = distanceToDelivery !== null && distanceToDelivery <= DELIVERY_RADIUS;
  const canTransitionToDelivery = AUTO_STATES.DELIVERY.includes(currentStatus);
  
  // Lógica de transición automática
  if (isNearPickup && canTransitionToPickup) {
    switch (currentStatus) {
      case 'assigned':
        return {
          shouldTransition: true,
          nextState: 'at_pickup',
          message: 'Has llegado al restaurante',
          type: 'pickup_arrival'
        };
      case 'heading_to_pickup':
        return {
          shouldTransition: true,
          nextState: 'at_pickup', 
          message: 'Has llegado al restaurante',
          type: 'pickup_arrival'
        };
      default:
        return null;
    }
  }
  
  if (isNearDelivery && canTransitionToDelivery) {
    switch (currentStatus) {
      case 'picked_up':
        return {
          shouldTransition: true,
          nextState: 'at_delivery',
          message: 'Has llegado al destino',
          type: 'delivery_arrival'
        };
      case 'heading_to_delivery':
        return {
          shouldTransition: true,
          nextState: 'at_delivery',
          message: 'Has llegado al destino', 
          type: 'delivery_arrival'
        };
      default:
        return null;
    }
  }
  
  return null;
};

export const getDeliveryActionUI = (currentStatus, autoTransition = null) => {
  // Si hay transición automática pendiente, mostrar eso
  if (autoTransition) {
    return {
      type: 'automatic',
      title: autoTransition.message,
      subtitle: 'Detectado automáticamente',
      action: autoTransition.nextState,
      color: '#4CAF50',
      icon: 'location',
      showProgress: true
    };
  }
  
  // Estados que requieren acción manual del usuario
  switch (currentStatus) {
    case 'assigned':
      return {
        type: 'manual',
        title: 'Ir a recoger pedido',
        subtitle: 'Toca para comenzar navegación',
        action: 'heading_to_pickup',
        color: '#2196F3',
        icon: 'car'
      };
      
    case 'at_pickup':
      return {
        type: 'waiting',
        title: 'Esperando entrega del restaurante',
        subtitle: 'El comerciante debe confirmar la entrega',
        action: null,
        color: '#FF9800',
        icon: 'restaurant'
      };
      
    case 'picked_up':
      return {
        type: 'manual',
        title: 'Ir a entregar pedido',
        subtitle: 'Toca para comenzar navegación',
        action: 'heading_to_delivery',
        color: '#2196F3',
        icon: 'car'
      };
      
    case 'at_delivery':
      return {
        type: 'manual',
        title: 'Marcar como entregado',
        subtitle: 'Confirma que entregaste el pedido',
        action: 'delivered',
        color: '#4CAF50',
        icon: 'checkmark-circle'
      };
      
    case 'delivered':
      return {
        type: 'completed',
        title: 'Entrega completada',
        subtitle: '¡Excelente trabajo!',
        action: null,
        color: '#4CAF50',
        icon: 'checkmark-done-circle'
      };
      
    default:
      return {
        type: 'unknown',
        title: 'Estado desconocido',
        subtitle: currentStatus,
        action: null,
        color: '#666',
        icon: 'help-circle'
      };
  }
};