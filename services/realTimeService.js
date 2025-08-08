// services/realTimeService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from '../config/api';

// Importación dinámica de socket.io-client para evitar errores de bundling
let io = null;
try {
  // Intentar importar socket.io-client si está disponible
  const ioModule = require('socket.io-client');
  io = ioModule.default || ioModule;
} catch (error) {
  console.log('⚠️ socket.io-client no disponible, usando fallback WebSocket nativo');
}

class RealTimeService {
  constructor() {
    this.socket = null;
    this.subscribers = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.useSocketIO = !!io; // Usar Socket.IO si está disponible
  }

  getSocketUrl() {
    // Obtener la URL base del API client
    const apiUrl = getApiUrl();
    const baseUrl = apiUrl.replace('/api', ''); // Remover /api del final
    console.log('🔗 Socket URL:', baseUrl);
    return baseUrl;
  }

  async connect(serverUrl = null) {
    try {
      const token = await AsyncStorage.getItem('userToken');
      
      if (!token) {
        console.log('⚠️ No token available for socket connection');
        return Promise.resolve();
      }

      // Usar la URL automática si no se proporciona una específica
      const socketUrl = serverUrl || this.getSocketUrl();
      
      if (this.useSocketIO && io) {
        // Usar Socket.IO client si está disponible
        return this.connectSocketIO(socketUrl, token);
      } else {
        // Fallback a WebSocket nativo (pero no funcionará con el servidor actual)
        console.log('⚠️ Socket.IO no disponible - funcionando sin tiempo real');
        this.isConnected = false;
        return Promise.resolve();
      }

    } catch (error) {
      console.log('⚠️ WebSocket no disponible - funcionando sin tiempo real:', error.message);
      this.isConnected = false;
      this.socket = null;
      return Promise.resolve();
    }
  }

  async connectSocketIO(socketUrl, token) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⚠️ Socket.IO timeout - funcionando sin tiempo real');
        this.isConnected = false;
        resolve();
      }, 5000);

      try {
        this.socket = io(socketUrl, {
          auth: {
            token: token
          },
          transports: ['websocket', 'polling'],
          timeout: 5000,
          forceNew: true
        });

        this.socket.on('connect', () => {
          clearTimeout(timeout);
          console.log('✅ Connected to Socket.IO service');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.setupSocketIOEventListeners();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          console.log('⚠️ Socket.IO no disponible - funcionando sin tiempo real');
          this.isConnected = false;
          this.socket = null;
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('🔌 Socket.IO connection closed');
          this.isConnected = false;
        });

      } catch (error) {
        clearTimeout(timeout);
        console.log('⚠️ Error connecting to Socket.IO:', error.message);
        this.isConnected = false;
        this.socket = null;
        resolve();
      }
    });
  }

  setupEventListeners() {
    // Legacy method - no longer used with Socket.IO
    console.log('⚠️ setupEventListeners called but using Socket.IO');
  }

  setupSocketIOEventListeners() {
    if (!this.socket) return;

    // Escuchar eventos de delivery tracking
    this.socket.on('delivery_location_updated', (data) => {
      console.log('📍 Location update received:', data);
      this.notifySubscribers('location_update', data);
    });

    this.socket.on('delivery_status_updated', (data) => {
      console.log('📊 Status update received:', data);
      this.notifySubscribers('status_update', data);
    });

    this.socket.on('order_assigned', (data) => {
      console.log('📦 Order assigned:', data);
      this.notifySubscribers('order_assigned', data);
    });

    this.socket.on('delivery_update', (data) => {
      console.log('🚚 Delivery update received:', data);
      this.notifySubscribers('delivery_update', data);
    });

    this.socket.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket.IO disconnected');
      this.isConnected = false;
      this.handleReconnection();
    });
  }

  handleMessage(data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'delivery_location_updated':
        console.log('📍 Location update received:', payload);
        this.notifySubscribers('location_update', payload);
        break;
      
      case 'delivery_status_updated':
        console.log('📊 Status update received:', payload);
        this.notifySubscribers('status_update', payload);
        break;
      
      case 'order_assigned':
        console.log('📦 Order assigned:', payload);
        this.notifySubscribers('order_assigned', payload);
        break;
      
      case 'eta_updated':
        console.log('⏰ ETA updated:', payload);
        this.notifySubscribers('eta_update', payload);
        break;
      
      default:
        console.log('Unknown message type:', type, payload);
    }
  }

  handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = 1000 * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  subscribeToOrder(orderId, callback) {
    if (!this.isConnected || !this.socket) {
      console.log('⚠️ Socket not connected, queuing subscription');
      // Intentar conectar si no está conectado
      this.connect().then(() => {
        this.subscribeToOrder(orderId, callback);
      }).catch(error => {
        console.error('Failed to connect for subscription:', error);
      });
      return;
    }

    console.log('🎯 Subscribing to order:', orderId);
    
    if (this.useSocketIO) {
      this.socket.emit('join_delivery_tracking', { orderId });
    }
    
    if (!this.subscribers.has(orderId)) {
      this.subscribers.set(orderId, []);
    }
    this.subscribers.get(orderId).push(callback);
  }

  unsubscribeFromOrder(orderId, callback) {
    if (this.isConnected && this.socket) {
      if (this.useSocketIO) {
        this.socket.emit('leave_delivery_tracking', { orderId });
      }
    }
    
    if (this.subscribers.has(orderId)) {
      const callbacks = this.subscribers.get(orderId);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
        
        // Si no quedan callbacks, eliminar la entrada
        if (callbacks.length === 0) {
          this.subscribers.delete(orderId);
        }
      }
    }
  }

  subscribeToDeliveryUpdates(deliveryPersonId, callback) {
    if (!this.isConnected || !this.socket) {
      console.log('⚠️ Socket not connected for delivery subscription');
      return;
    }

    console.log('🚚 Subscribing to delivery updates:', deliveryPersonId);
    
    if (this.useSocketIO) {
      this.socket.emit('join_delivery_person', { deliveryPersonId });
    }
    
    if (!this.subscribers.has(`delivery_${deliveryPersonId}`)) {
      this.subscribers.set(`delivery_${deliveryPersonId}`, []);
    }
    this.subscribers.get(`delivery_${deliveryPersonId}`).push(callback);
  }

  send(message) {
    if (this.isConnected && this.socket) {
      if (this.useSocketIO) {
        // Con Socket.IO, emitimos el evento directamente
        this.socket.emit(message.type, message.payload);
      }
    } else {
      console.warn('Cannot send message: Socket not connected');
    }
  }

  notifySubscribers(event, data) {
    const orderId = data.orderId;
    const deliveryPersonId = data.deliveryPersonId;

    // Notificar suscriptores de pedido específico
    if (orderId && this.subscribers.has(orderId)) {
      this.subscribers.get(orderId).forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error('Error in subscriber callback:', error);
        }
      });
    }

    // Notificar suscriptores de delivery person específico
    if (deliveryPersonId && this.subscribers.has(`delivery_${deliveryPersonId}`)) {
      this.subscribers.get(`delivery_${deliveryPersonId}`).forEach(callback => {
        try {
          callback(event, data);
        } catch (error) {
          console.error('Error in delivery subscriber callback:', error);
        }
      });
    }
  }

  emitLocationUpdate(data) {
    if (this.isConnected && this.socket && this.useSocketIO) {
      this.socket.emit('delivery_location_update', data);
    } else {
      console.warn('Cannot emit location update: Socket not connected');
    }
  }

  emitStatusUpdate(data) {
    if (this.isConnected && this.socket && this.useSocketIO) {
      this.socket.emit('delivery_status_update', data);
    } else {
      console.warn('Cannot emit status update: Socket not connected');
    }
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting Socket');
      if (this.useSocketIO) {
        this.socket.disconnect();
      } else {
        this.socket.close();
      }
      this.socket = null;
      this.isConnected = false;
      this.subscribers.clear();
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      hasSocket: !!this.socket
    };
  }
}

export default new RealTimeService();