/**
 * SafeDeliveryRenderer - Utilidades para renderizar deliveries de forma segura
 * Previene errores cuando las órdenes son null o indefinidas
 */

// Función para verificar si una delivery tiene datos válidos
export const isValidDelivery = (delivery) => {
  if (!delivery) return false;
  
  // Verificar que tenga ID
  if (!delivery._id) return false;
  
  // Para deliveries activos, debe tener orderId válido
  if (!delivery.orderId) return false;
  
  return true;
};

// Función para verificar si una orden tiene datos válidos
export const isValidOrder = (order) => {
  if (!order) return false;
  
  // Verificar que tenga ID
  if (!order._id) return false;
  
  return true;
};

// Función para obtener el número de orden de forma segura
export const safeGetOrderNumber = (delivery) => {
  try {
    // Si orderId es un objeto con orderNumber
    if (delivery?.orderId && typeof delivery.orderId === 'object') {
      return delivery.orderId.orderNumber || 'Sin número';
    }
    
    // Si orderId es un string simple
    if (delivery?.orderId && typeof delivery.orderId === 'string') {
      return `Pedido ${delivery.orderId.slice(-6)}`;
    }
    
    // Si no hay orderId válido
    return 'Sin número';
  } catch (error) {
    console.warn('Error obteniendo número de orden:', error);
    return 'Sin número';
  }
};

// Función para obtener el ID de orden de forma segura
export const safeGetOrderId = (delivery) => {
  try {
    // Si orderId es un objeto con _id
    if (delivery?.orderId && typeof delivery.orderId === 'object') {
      return delivery.orderId._id || delivery.orderId.id || null;
    }
    
    // Si orderId es un string
    if (delivery?.orderId && typeof delivery.orderId === 'string') {
      return delivery.orderId;
    }
    
    return null;
  } catch (error) {
    console.warn('Error obteniendo ID de orden:', error);
    return null;
  }
};

// Función para filtrar deliveries válidos
export const filterValidDeliveries = (deliveries) => {
  if (!Array.isArray(deliveries)) return [];
  
  return deliveries.filter(delivery => {
    const isValid = isValidDelivery(delivery);
    
    if (!isValid) {
      console.warn('Delivery inválido filtrado:', {
        id: delivery?._id,
        orderId: delivery?.orderId,
        status: delivery?.status
      });
    }
    
    return isValid;
  });
};

// Función para filtrar órdenes válidas
export const filterValidOrders = (orders) => {
  if (!Array.isArray(orders)) return [];
  
  return orders.filter(order => {
    const isValid = isValidOrder(order);
    
    if (!isValid) {
      console.warn('Orden inválida filtrada:', {
        id: order?._id,
        orderNumber: order?.orderNumber
      });
    }
    
    return isValid;
  });
};

// Función para limpiar deliveries huérfanos del estado local
export const cleanOrphanedDeliveries = async (deliveries) => {
  const validDeliveries = [];
  const orphanedDeliveries = [];
  
  for (const delivery of deliveries) {
    if (isValidDelivery(delivery)) {
      validDeliveries.push(delivery);
    } else {
      orphanedDeliveries.push(delivery);
    }
  }
  
  if (orphanedDeliveries.length > 0) {
    console.warn(`🧹 Limpiando ${orphanedDeliveries.length} deliveries huérfanos del estado local`);
    orphanedDeliveries.forEach(delivery => {
      console.warn('  - Delivery huérfano:', {
        id: delivery?._id,
        orderId: delivery?.orderId,
        status: delivery?.status
      });
    });
  }
  
  return validDeliveries;
};

// Función para manejar errores de navegación con deliveries inválidos
export const safeNavigateToDelivery = (navigation, delivery, fallbackRoute = 'HomeDelivery') => {
  try {
    if (!isValidDelivery(delivery)) {
      console.error('❌ Intento de navegar con delivery inválido:', delivery);
      
      // Navegar a pantalla de fallback
      navigation.navigate(fallbackRoute);
      return false;
    }
    
    const trackingId = delivery._id;
    const orderId = safeGetOrderId(delivery);
    
    if (!orderId) {
      console.error('❌ No se pudo obtener orderId válido para navegación');
      navigation.navigate(fallbackRoute);
      return false;
    }
    
    navigation.navigate('DeliveryNavigation', {
      trackingId,
      orderId,
      deliveryTracking: delivery
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error en navegación segura:', error);
    navigation.navigate(fallbackRoute);
    return false;
  }
};

// Hook para usar en componentes funcionales
export const useSafeDeliveryData = (deliveries) => {
  const [validDeliveries, setValidDeliveries] = React.useState([]);
  const [hasOrphanedData, setHasOrphanedData] = React.useState(false);
  
  React.useEffect(() => {
    if (Array.isArray(deliveries)) {
      const valid = filterValidDeliveries(deliveries);
      setValidDeliveries(valid);
      setHasOrphanedData(valid.length < deliveries.length);
    } else {
      setValidDeliveries([]);
      setHasOrphanedData(false);
    }
  }, [deliveries]);
  
  return {
    validDeliveries,
    hasOrphanedData,
    originalCount: Array.isArray(deliveries) ? deliveries.length : 0,
    validCount: validDeliveries.length
  };
};

// Función para obtener texto de estado de forma segura
export const safeGetStatusLabel = (status) => {
  const statusLabels = {
    assigned: 'Asignado',
    heading_to_pickup: 'Yendo a recoger',
    at_pickup: 'En recogida',
    picked_up: 'Recogido',
    heading_to_delivery: 'En camino',
    at_delivery: 'En entrega',
    delivered: 'Entregado',
    cancelled: 'Cancelado'
  };
  
  return statusLabels[status] || status || 'Estado desconocido';
};

// Función para obtener color de estado de forma segura
export const safeGetStatusColor = (status) => {
  const statusColors = {
    assigned: '#FFA726',
    heading_to_pickup: '#42A5F5',
    at_pickup: '#AB47BC',
    picked_up: '#26A69A',
    heading_to_delivery: '#5C6BC0',
    at_delivery: '#FF7043',
    delivered: '#66BB6A',
    cancelled: '#EF5350'
  };
  
  return statusColors[status] || '#9E9E9E';
};

export default {
  isValidDelivery,
  isValidOrder,
  safeGetOrderNumber,
  safeGetOrderId,
  filterValidDeliveries,
  filterValidOrders,
  cleanOrphanedDeliveries,
  safeNavigateToDelivery,
  safeGetStatusLabel,
  safeGetStatusColor
};