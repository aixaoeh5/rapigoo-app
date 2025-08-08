// utils/navigationStates.js
export const DELIVERY_STATES = {
  ASSIGNED: 'assigned',
  HEADING_TO_PICKUP: 'heading_to_pickup',
  AT_PICKUP: 'at_pickup',
  PICKED_UP: 'picked_up',
  HEADING_TO_DELIVERY: 'heading_to_delivery',
  AT_DELIVERY: 'at_delivery',
  DELIVERED: 'delivered'
};

export const DELIVERY_STATE_LABELS = {
  [DELIVERY_STATES.ASSIGNED]: 'Asignado',
  [DELIVERY_STATES.HEADING_TO_PICKUP]: 'Yendo a recoger',
  [DELIVERY_STATES.AT_PICKUP]: 'En el restaurante',
  [DELIVERY_STATES.PICKED_UP]: 'Pedido recogido',
  [DELIVERY_STATES.HEADING_TO_DELIVERY]: 'En camino al cliente',
  [DELIVERY_STATES.AT_DELIVERY]: 'En destino',
  [DELIVERY_STATES.DELIVERED]: 'Entregado'
};

export const getNextWaypoint = (currentStatus, pickupCoords, deliveryCoords) => {
  switch (currentStatus) {
    case DELIVERY_STATES.ASSIGNED:
    case DELIVERY_STATES.HEADING_TO_PICKUP:
      return {
        coordinates: pickupCoords,
        type: 'pickup',
        address: 'Restaurante'
      };
    
    case DELIVERY_STATES.PICKED_UP:
    case DELIVERY_STATES.HEADING_TO_DELIVERY:
      return {
        coordinates: deliveryCoords,
        type: 'delivery',
        address: 'Cliente'
      };
    
    default:
      return null;
  }
};

export const getNextAction = (currentStatus) => {
  switch (currentStatus) {
    case DELIVERY_STATES.ASSIGNED:
      return {
        action: DELIVERY_STATES.HEADING_TO_PICKUP,
        label: 'Ir a recoger',
        color: '#2196F3'
      };
    
    case DELIVERY_STATES.HEADING_TO_PICKUP:
      return {
        action: DELIVERY_STATES.AT_PICKUP,
        label: 'He llegado',
        color: '#FF9800'
      };
    
    case DELIVERY_STATES.AT_PICKUP:
      return {
        action: DELIVERY_STATES.PICKED_UP,
        label: 'Pedido recogido',
        color: '#4CAF50'
      };
    
    case DELIVERY_STATES.PICKED_UP:
      return {
        action: DELIVERY_STATES.HEADING_TO_DELIVERY,
        label: 'Ir a entregar',
        color: '#2196F3'
      };
    
    case DELIVERY_STATES.HEADING_TO_DELIVERY:
      return {
        action: DELIVERY_STATES.AT_DELIVERY,
        label: 'He llegado',
        color: '#FF9800'
      };
    
    case DELIVERY_STATES.AT_DELIVERY:
      return {
        action: DELIVERY_STATES.DELIVERED,
        label: 'Pedido entregado',
        color: '#4CAF50'
      };
    
    default:
      return null;
  }
};

// Función para calcular distancia entre dos puntos
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c * 1000; // Convertir a metros
  return distance;
};

// Detección automática de llegada
export const checkArrival = (currentLocation, targetLocation, threshold = 50) => {
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    targetLocation[1], // latitude
    targetLocation[0]  // longitude
  );
  
  return distance <= threshold; // 50 metros por defecto
};

// Formatear distancia para mostrar
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    return `${(meters / 1000).toFixed(1)}km`;
  }
};

// Formatear tiempo para mostrar
export const formatDuration = (seconds) => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}min`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  }
};

// Calcular ETA basado en distancia y velocidad promedio
export const calculateETA = (distance, averageSpeed = 25) => {
  // distance en metros, averageSpeed en km/h
  const distanceKm = distance / 1000;
  const timeHours = distanceKm / averageSpeed;
  const timeMinutes = timeHours * 60;
  return Math.round(timeMinutes);
};