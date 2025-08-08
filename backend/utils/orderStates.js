// Estados válidos de pedidos
const ORDER_STATES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed', 
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Transiciones válidas entre estados
const VALID_TRANSITIONS = {
  [ORDER_STATES.PENDING]: [ORDER_STATES.CONFIRMED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.CONFIRMED]: [ORDER_STATES.PREPARING, ORDER_STATES.CANCELLED],
  [ORDER_STATES.PREPARING]: [ORDER_STATES.READY, ORDER_STATES.CANCELLED],
  [ORDER_STATES.READY]: [ORDER_STATES.COMPLETED, ORDER_STATES.CANCELLED],
  [ORDER_STATES.COMPLETED]: [], // Estado final
  [ORDER_STATES.CANCELLED]: []  // Estado final
};

// Descripciones de estados para mostrar al usuario
const STATE_DESCRIPTIONS = {
  [ORDER_STATES.PENDING]: {
    title: 'Pendiente',
    description: 'Esperando confirmación del comerciante',
    icon: '⏳',
    color: '#FFA500'
  },
  [ORDER_STATES.CONFIRMED]: {
    title: 'Confirmado',
    description: 'El comerciante confirmó tu pedido',
    icon: '✅',
    color: '#4CAF50'
  },
  [ORDER_STATES.PREPARING]: {
    title: 'Preparando',
    description: 'Tu pedido está siendo preparado',
    icon: '👨‍🍳',
    color: '#2196F3'
  },
  [ORDER_STATES.READY]: {
    title: 'Listo',
    description: 'Tu pedido está listo para entrega',
    icon: '📦',
    color: '#FF9800'
  },
  [ORDER_STATES.COMPLETED]: {
    title: 'Completado',
    description: 'Pedido entregado exitosamente',
    icon: '🎉',
    color: '#4CAF50'
  },
  [ORDER_STATES.CANCELLED]: {
    title: 'Cancelado',
    description: 'El pedido fue cancelado',
    icon: '❌',
    color: '#F44336'
  }
};

// Acciones que puede realizar cada rol en cada estado
const ROLE_ACTIONS = {
  merchant: {
    [ORDER_STATES.PENDING]: ['confirm', 'cancel'],
    [ORDER_STATES.CONFIRMED]: ['prepare', 'cancel'],
    [ORDER_STATES.PREPARING]: ['ready', 'cancel'],
    [ORDER_STATES.READY]: ['complete', 'cancel'],
    [ORDER_STATES.COMPLETED]: [],
    [ORDER_STATES.CANCELLED]: []
  },
  customer: {
    [ORDER_STATES.PENDING]: ['cancel'],
    [ORDER_STATES.CONFIRMED]: [],
    [ORDER_STATES.PREPARING]: [],
    [ORDER_STATES.READY]: [],
    [ORDER_STATES.COMPLETED]: [],
    [ORDER_STATES.CANCELLED]: []
  },
  admin: {
    [ORDER_STATES.PENDING]: ['confirm', 'cancel'],
    [ORDER_STATES.CONFIRMED]: ['prepare', 'cancel'],
    [ORDER_STATES.PREPARING]: ['ready', 'cancel'],
    [ORDER_STATES.READY]: ['complete', 'cancel'],
    [ORDER_STATES.COMPLETED]: ['reopen'],
    [ORDER_STATES.CANCELLED]: ['reopen']
  }
};

// Mapeo de acciones a estados resultantes
const ACTION_TO_STATE = {
  confirm: ORDER_STATES.CONFIRMED,
  prepare: ORDER_STATES.PREPARING,
  ready: ORDER_STATES.READY,
  complete: ORDER_STATES.COMPLETED,
  cancel: ORDER_STATES.CANCELLED,
  reopen: ORDER_STATES.PENDING
};

// Validar si una transición es válida
const isValidTransition = (currentState, newState) => {
  return VALID_TRANSITIONS[currentState]?.includes(newState) || false;
};

// Obtener acciones disponibles para un rol en un estado específico
const getAvailableActions = (state, role) => {
  return ROLE_ACTIONS[role]?.[state] || [];
};

// Obtener el próximo estado basado en una acción
const getNextState = (action) => {
  return ACTION_TO_STATE[action];
};

// Validar si un rol puede realizar una acción específica
const canPerformAction = (currentState, action, role) => {
  const availableActions = getAvailableActions(currentState, role);
  return availableActions.includes(action);
};

// Obtener tiempo estimado hasta el siguiente estado
const getEstimatedTimeToNext = (currentState, preparationTime = 30) => {
  const estimates = {
    [ORDER_STATES.PENDING]: 5, // 5 minutos para confirmar
    [ORDER_STATES.CONFIRMED]: 2, // 2 minutos para empezar a preparar
    [ORDER_STATES.PREPARING]: preparationTime, // tiempo de preparación
    [ORDER_STATES.READY]: 20, // 20 minutos para entregar
    [ORDER_STATES.COMPLETED]: 0,
    [ORDER_STATES.CANCELLED]: 0
  };
  
  return estimates[currentState] || 0;
};

// Generar mensaje de notificación para cambio de estado
const getStateChangeMessage = (oldState, newState, orderNumber) => {
  const messages = {
    [`${ORDER_STATES.PENDING}-${ORDER_STATES.CONFIRMED}`]: 
      `¡Tu pedido #${orderNumber} ha sido confirmado! El comerciante comenzará a prepararlo pronto.`,
    [`${ORDER_STATES.CONFIRMED}-${ORDER_STATES.PREPARING}`]: 
      `Tu pedido #${orderNumber} está siendo preparado. ¡Ya casi está listo!`,
    [`${ORDER_STATES.PREPARING}-${ORDER_STATES.READY}`]: 
      `¡Tu pedido #${orderNumber} está listo! Será enviado en breve.`,
    [`${ORDER_STATES.READY}-${ORDER_STATES.COMPLETED}`]: 
      `¡Tu pedido #${orderNumber} ha sido entregado! Gracias por usar Rapigoo.`,
    [`${ORDER_STATES.PENDING}-${ORDER_STATES.CANCELLED}`]: 
      `Tu pedido #${orderNumber} ha sido cancelado.`,
    [`${ORDER_STATES.CONFIRMED}-${ORDER_STATES.CANCELLED}`]: 
      `Tu pedido #${orderNumber} ha sido cancelado.`,
    [`${ORDER_STATES.PREPARING}-${ORDER_STATES.CANCELLED}`]: 
      `Tu pedido #${orderNumber} ha sido cancelado.`
  };
  
  return messages[`${oldState}-${newState}`] || 
         `Tu pedido #${orderNumber} cambió de estado a ${STATE_DESCRIPTIONS[newState].title}.`;
};

module.exports = {
  ORDER_STATES,
  VALID_TRANSITIONS,
  STATE_DESCRIPTIONS,
  ROLE_ACTIONS,
  ACTION_TO_STATE,
  isValidTransition,
  getAvailableActions,
  getNextState,
  canPerformAction,
  getEstimatedTimeToNext,
  getStateChangeMessage
};