/**
 * Centralized status constants for data consistency
 */

// Order status constants
const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed', 
  PREPARING: 'preparing',
  READY: 'ready',
  ASSIGNED: 'assigned',
  AT_PICKUP: 'at_pickup',  // Delivery llegó al restaurante
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

// Delivery tracking status constants  
const DELIVERY_STATUS = {
  ASSIGNED: 'assigned',
  HEADING_TO_PICKUP: 'heading_to_pickup',
  AT_PICKUP: 'at_pickup', 
  PICKED_UP: 'picked_up',
  HEADING_TO_DELIVERY: 'heading_to_delivery',
  AT_DELIVERY: 'at_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

// Map order status to delivery status
const ORDER_TO_DELIVERY_STATUS_MAP = {
  [ORDER_STATUS.ASSIGNED]: DELIVERY_STATUS.ASSIGNED,
  [ORDER_STATUS.PICKED_UP]: DELIVERY_STATUS.PICKED_UP,
  [ORDER_STATUS.IN_TRANSIT]: DELIVERY_STATUS.HEADING_TO_DELIVERY,
  [ORDER_STATUS.DELIVERED]: DELIVERY_STATUS.DELIVERED,
  [ORDER_STATUS.CANCELLED]: DELIVERY_STATUS.CANCELLED
};

// Payment status constants
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded'
};

// Currency constants
const CURRENCY = {
  DEFAULT: 'DOP', // Dominican Peso
  SYMBOL: 'RD$',
  DISPLAY_FORMAT: 'RD${amount}'
};

// Coordinate format helper
const formatCoordinates = (lng, lat) => {
  // Always return [longitude, latitude] for MongoDB GeoJSON format
  return [parseFloat(lng), parseFloat(lat)];
};

const parseCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new Error('Invalid coordinates format. Expected [longitude, latitude]');
  }
  return {
    longitude: parseFloat(coordinates[0]),
    latitude: parseFloat(coordinates[1])
  };
};

module.exports = {
  ORDER_STATUS,
  DELIVERY_STATUS,
  ORDER_TO_DELIVERY_STATUS_MAP,
  PAYMENT_STATUS,
  CURRENCY,
  formatCoordinates,
  parseCoordinates
};