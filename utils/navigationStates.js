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
    case DELIVERY_STATES.AT_PICKUP:  // FIX: Agregado para mostrar ubicación del restaurante
      return {
        coordinates: pickupCoords,
        type: 'pickup',
        address: 'Restaurante'
      };
    
    case DELIVERY_STATES.PICKED_UP:
    case DELIVERY_STATES.HEADING_TO_DELIVERY:
    case DELIVERY_STATES.AT_DELIVERY:  // FIX: Agregado para mostrar ubicación del cliente
      return {
        coordinates: deliveryCoords,
        type: 'delivery',
        address: 'Cliente'
      };
    
    case DELIVERY_STATES.DELIVERED:
      // Mostrar ubicación de entrega completada
      return {
        coordinates: deliveryCoords,
        type: 'completed',
        address: 'Entrega completada'
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
        label: 'Esperando confirmación del comerciante',
        color: '#FF9800',
        disabled: true, // El delivery no puede realizar esta acción
        waitingFor: 'merchant' // Indica que espera acción del comerciante
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

// Detección automática de llegada con debouncing
const arrivalHistory = new Map();

export const checkArrival = (currentLocation, targetLocation, threshold = 50, currentStatus = null, deliveryData = null) => {
  if (!currentLocation || !targetLocation || !targetLocation.length === 2) {
    return false;
  }

  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    targetLocation[1], // latitude
    targetLocation[0]  // longitude
  );
  
  const isWithinRange = distance <= threshold;
  
  // FIX: Verificación más robusta de estados ya arribados
  if (currentStatus === 'at_pickup' || currentStatus === 'at_delivery') {
    console.log(`⚠️ checkArrival: Already at location (${currentStatus}), skipping auto-detection`);
    return false;
  }
  
  // FIX: Verificar si ya arribó según deliveryData
  if (deliveryData) {
    // Para pickup
    if (deliveryData.pickupLocation?.arrived && 
        (currentStatus === 'assigned' || currentStatus === 'heading_to_pickup')) {
      console.log(`⚠️ checkArrival: Pickup already arrived at ${deliveryData.pickupLocation.arrivedAt}, skipping`);
      return false;
    }
    
    // Para delivery
    if (deliveryData.deliveryLocation?.arrived && 
        currentStatus === 'heading_to_delivery') {
      console.log(`⚠️ checkArrival: Delivery already arrived at ${deliveryData.deliveryLocation.arrivedAt}, skipping`);
      return false;
    }
  }
  
  // FIX: Solo permitir detección en estados específicos
  const allowedStatesForPickup = ['assigned', 'heading_to_pickup'];
  const allowedStatesForDelivery = ['picked_up', 'heading_to_delivery']; // FIX: Agregar picked_up
  
  // Determinar si es pickup o delivery basado en el contexto
  const isPickupTarget = allowedStatesForPickup.includes(currentStatus);
  const isDeliveryTarget = allowedStatesForDelivery.includes(currentStatus);
  
  // DEBUG: Log para diagnosticar problemas de detección
  console.log(`🔍 checkArrival DEBUG:`, {
    currentStatus,
    distance: distance.toFixed(1),
    isWithinRange,
    isPickupTarget,
    isDeliveryTarget,
    threshold
  });
  
  if (!isPickupTarget && !isDeliveryTarget) {
    console.log(`⚠️ checkArrival: State ${currentStatus} not allowed for auto-detection`);
    return false;
  }
  
  // Debouncing: solo permitir una detección cada 30 segundos por ubicación
  const locationKey = `${targetLocation[0]}_${targetLocation[1]}_${currentStatus}`;
  const now = Date.now();
  const lastDetection = arrivalHistory.get(locationKey);
  
  if (isWithinRange) {
    if (!lastDetection || (now - lastDetection) > 30000) { // 30 segundos
      console.log(`✅ checkArrival: Auto-detection allowed for ${currentStatus} at distance ${distance.toFixed(1)}m`);
      arrivalHistory.set(locationKey, now);
      return true;
    } else {
      console.log(`⚠️ checkArrival: Too soon since last detection (${(now - lastDetection)/1000}s ago)`);
    }
  } else {
    // Si nos alejamos, limpiar el historial para esa ubicación
    arrivalHistory.delete(locationKey);
  }
  
  return false;
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