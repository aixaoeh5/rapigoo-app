/**
 * Utility para validar payloads antes de enviarlos al backend
 * Previene errores de validación comunes
 */

export const validateStatusUpdatePayload = (payload) => {
  const errors = [];
  
  // Validar status requerido
  if (!payload.status) {
    errors.push('Status es requerido');
  }
  
  // Validar status válido
  const validStatuses = [
    'assigned', 'heading_to_pickup', 'at_pickup', 
    'picked_up', 'heading_to_delivery', 'at_delivery', 
    'delivered', 'cancelled'
  ];
  
  if (payload.status && !validStatuses.includes(payload.status)) {
    errors.push(`Status inválido: ${payload.status}`);
  }
  
  // Validar location si existe
  if (payload.location !== undefined && payload.location !== null) {
    if (typeof payload.location !== 'object') {
      errors.push('Location debe ser un objeto');
    } else {
      if (typeof payload.location.latitude !== 'number') {
        errors.push('Location.latitude debe ser un número');
      }
      if (typeof payload.location.longitude !== 'number') {
        errors.push('Location.longitude debe ser un número');
      }
      if (payload.location.latitude < -90 || payload.location.latitude > 90) {
        errors.push('Location.latitude debe estar entre -90 y 90');
      }
      if (payload.location.longitude < -180 || payload.location.longitude > 180) {
        errors.push('Location.longitude debe estar entre -180 y 180');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const sanitizeStatusUpdatePayload = (rawPayload) => {
  const payload = {
    status: rawPayload.status,
    notes: rawPayload.notes || undefined
  };
  
  // Solo incluir location si es válida
  if (rawPayload.location && 
      typeof rawPayload.location === 'object' &&
      typeof rawPayload.location.latitude === 'number' &&
      typeof rawPayload.location.longitude === 'number') {
    payload.location = rawPayload.location;
  }
  
  return payload;
};