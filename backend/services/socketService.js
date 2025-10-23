const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const User = require('../models/User');
const { logger } = require('../utils/logger');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // Map of userId -> socket.id
    this.userSockets = new Map(); // Map of socket.id -> user info
    this.lastLocations = new Map(); // Map of orderId -> last location for deduplication
    this.locationUpdateThreshold = 0.01; // 10 meters in km
    this.locationTimeThreshold = 5000; // 5 seconds minimum between updates
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          process.env.FRONTEND_URL || 'http://localhost:3000',
          process.env.ADMIN_URL || 'http://localhost:3001',
          'http://localhost:19006', // Expo web
          'exp://localhost:19000'   // Expo development
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Middleware de autenticación
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('name email role');
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.setupEventHandlers();
    
    logger.info('Socket.IO server initialized');
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('User connected:', {
        socketId: socket.id,
        userId: socket.userId,
        userName: socket.user.name
      });

      // Registrar usuario conectado
      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, {
        userId: socket.userId,
        user: socket.user,
        connectedAt: new Date()
      });

      // Unirse a salas de chat activos
      this.joinUserChats(socket);

      // Event handlers
      socket.on('join_chat', (data) => this.handleJoinChat(socket, data));
      socket.on('leave_chat', (data) => this.handleLeaveChat(socket, data));
      socket.on('send_message', (data) => this.handleSendMessage(socket, data));
      socket.on('edit_message', (data) => this.handleEditMessage(socket, data));
      socket.on('delete_message', (data) => this.handleDeleteMessage(socket, data));
      socket.on('mark_as_read', (data) => this.handleMarkAsRead(socket, data));
      socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
      socket.on('user_online', () => this.handleUserOnline(socket));
      socket.on('user_offline', () => this.handleUserOffline(socket));

      // Delivery tracking events
      socket.on('join_delivery_tracking', (data) => this.handleJoinDeliveryTracking(socket, data));
      socket.on('leave_delivery_tracking', (data) => this.handleLeaveDeliveryTracking(socket, data));
      socket.on('delivery_location_update', (data) => this.handleDeliveryLocationUpdate(socket, data));

      // Disconnect handler
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  async joinUserChats(socket) {
    try {
      const chats = await Chat.findUserChats(socket.userId);
      
      chats.forEach(chat => {
        const roomName = `chat_${chat._id}`;
        socket.join(roomName);
      });

      logger.info('User joined chat rooms:', {
        userId: socket.userId,
        chatCount: chats.length
      });
    } catch (error) {
      logger.error('Error joining user chats:', error);
    }
  }

  async handleJoinChat(socket, data) {
    try {
      const { chatId } = data;
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      // Verificar que el usuario es participante
      const isParticipant = chat.participants.some(p => 
        p.userId.toString() === socket.userId && p.isActive
      );

      if (!isParticipant) {
        socket.emit('error', { message: 'Access denied to this chat' });
        return;
      }

      const roomName = `chat_${chatId}`;
      socket.join(roomName);

      // Emitir mensajes recientes
      const messages = chat.getMessages({ limit: 50 });
      socket.emit('chat_messages', {
        chatId,
        messages: messages.reverse() // Enviar en orden cronológico
      });

      // Notificar a otros participantes que el usuario se unió
      socket.to(roomName).emit('user_joined_chat', {
        chatId,
        user: {
          id: socket.userId,
          name: socket.user.name,
          role: socket.user.role
        }
      });

      logger.info('User joined chat:', {
        userId: socket.userId,
        chatId
      });

    } catch (error) {
      logger.error('Error joining chat:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  }

  async handleLeaveChat(socket, data) {
    try {
      const { chatId } = data;
      const roomName = `chat_${chatId}`;
      
      socket.leave(roomName);

      // Notificar a otros participantes
      socket.to(roomName).emit('user_left_chat', {
        chatId,
        user: {
          id: socket.userId,
          name: socket.user.name,
          role: socket.user.role
        }
      });

      logger.info('User left chat:', {
        userId: socket.userId,
        chatId
      });

    } catch (error) {
      logger.error('Error leaving chat:', error);
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const { chatId, content, messageType = 'text', metadata = {}, replyTo } = data;
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      // Verificar permisos
      const isParticipant = chat.participants.some(p => 
        p.userId.toString() === socket.userId && p.isActive
      );

      if (!isParticipant) {
        socket.emit('error', { message: 'Access denied to this chat' });
        return;
      }

      // Crear mensaje
      const message = await chat.addMessage({
        senderId: socket.userId,
        senderType: socket.user.role,
        content,
        messageType,
        metadata,
        replyTo
      });

      // Emitir a todos los participantes en la sala
      const roomName = `chat_${chatId}`;
      const messageData = {
        chatId,
        message: {
          _id: message._id,
          senderId: socket.userId,
          senderName: socket.user.name,
          senderType: socket.user.role,
          content: message.content,
          messageType: message.messageType,
          metadata: message.metadata,
          timestamp: message.timestamp,
          replyTo: message.replyTo
        }
      };

      this.io.to(roomName).emit('new_message', messageData);

      // Enviar notificaciones push a usuarios offline
      await this.sendMessageNotifications(chat, message, socket.userId);

      logger.info('Message sent:', {
        chatId,
        senderId: socket.userId,
        messageType
      });

    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  async handleEditMessage(socket, data) {
    try {
      const { chatId, messageId, newContent } = data;
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      await chat.editMessage(messageId, newContent, socket.userId);

      const roomName = `chat_${chatId}`;
      this.io.to(roomName).emit('message_edited', {
        chatId,
        messageId,
        newContent,
        editedBy: socket.userId,
        editedAt: new Date()
      });

      logger.info('Message edited:', {
        chatId,
        messageId,
        editedBy: socket.userId
      });

    } catch (error) {
      logger.error('Error editing message:', error);
      socket.emit('error', { message: error.message });
    }
  }

  async handleDeleteMessage(socket, data) {
    try {
      const { chatId, messageId } = data;
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      await chat.deleteMessage(messageId, socket.userId);

      const roomName = `chat_${chatId}`;
      this.io.to(roomName).emit('message_deleted', {
        chatId,
        messageId,
        deletedBy: socket.userId,
        deletedAt: new Date()
      });

      logger.info('Message deleted:', {
        chatId,
        messageId,
        deletedBy: socket.userId
      });

    } catch (error) {
      logger.error('Error deleting message:', error);
      socket.emit('error', { message: error.message });
    }
  }

  async handleMarkAsRead(socket, data) {
    try {
      const { chatId, messageId } = data;
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
      }

      await chat.markAsRead(socket.userId, messageId);

      const roomName = `chat_${chatId}`;
      socket.to(roomName).emit('message_read', {
        chatId,
        messageId,
        readBy: socket.userId,
        readAt: new Date()
      });

      logger.info('Message marked as read:', {
        chatId,
        messageId,
        readBy: socket.userId
      });

    } catch (error) {
      logger.error('Error marking message as read:', error);
      socket.emit('error', { message: 'Failed to mark as read' });
    }
  }

  handleTypingStart(socket, data) {
    const { chatId } = data;
    const roomName = `chat_${chatId}`;
    
    socket.to(roomName).emit('user_typing', {
      chatId,
      user: {
        id: socket.userId,
        name: socket.user.name,
        role: socket.user.role
      },
      isTyping: true
    });
  }

  handleTypingStop(socket, data) {
    const { chatId } = data;
    const roomName = `chat_${chatId}`;
    
    socket.to(roomName).emit('user_typing', {
      chatId,
      user: {
        id: socket.userId,
        name: socket.user.name,
        role: socket.user.role
      },
      isTyping: false
    });
  }

  handleUserOnline(socket) {
    // Actualizar estado online
    this.io.emit('user_status_change', {
      userId: socket.userId,
      status: 'online',
      lastSeen: new Date()
    });
  }

  handleUserOffline(socket) {
    // El estado offline se manejará en disconnect
  }

  async handleJoinDeliveryTracking(socket, data) {
    try {
      const { orderId } = data;
      const roomName = `delivery_${orderId}`;
      
      socket.join(roomName);
      
      logger.info('User joined delivery tracking:', {
        userId: socket.userId,
        orderId
      });

    } catch (error) {
      logger.error('Error joining delivery tracking:', error);
      socket.emit('error', { message: 'Failed to join delivery tracking' });
    }
  }

  handleLeaveDeliveryTracking(socket, data) {
    const { orderId } = data;
    const roomName = `delivery_${orderId}`;
    
    socket.leave(roomName);
    
    logger.info('User left delivery tracking:', {
      userId: socket.userId,
      orderId
    });
  }

  handleDeliveryLocationUpdate(socket, data) {
    const { orderId, location, status } = data;
    const roomName = `delivery_${orderId}`;
    
    // Emitir actualización de ubicación a todos los interesados
    socket.to(roomName).emit('delivery_location_updated', {
      orderId,
      location,
      status,
      timestamp: new Date()
    });
  }

  handleDisconnect(socket) {
    logger.info('User disconnected:', {
      socketId: socket.id,
      userId: socket.userId
    });

    // Limpiar mapas de usuarios conectados
    if (socket.userId) {
      this.connectedUsers.delete(socket.userId);
    }
    this.userSockets.delete(socket.id);

    // Notificar estado offline
    if (socket.userId) {
      this.io.emit('user_status_change', {
        userId: socket.userId,
        status: 'offline',
        lastSeen: new Date()
      });
    }
  }

  // Métodos para enviar notificaciones
  async sendMessageNotifications(chat, message, senderId) {
    try {
      const offlineParticipants = chat.participants.filter(p => 
        p.userId.toString() !== senderId && 
        p.isActive && 
        p.notifications.enabled &&
        !this.connectedUsers.has(p.userId.toString())
      );

      // Aquí integrarías con el servicio de notificaciones push
      // await notificationService.sendMessageNotification(offlineParticipants, message);

    } catch (error) {
      logger.error('Error sending message notifications:', error);
    }
  }

  // Métodos públicos para usar desde otras partes de la aplicación
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  sendToChat(chatId, event, data) {
    const roomName = `chat_${chatId}`;
    this.io.to(roomName).emit(event, data);
  }

  sendDeliveryUpdate(orderId, data) {
    const roomName = `delivery_${orderId}`;
    this.io.to(roomName).emit('delivery_update', {
      orderId,
      ...data,
      timestamp: new Date()
    });
  }

  // Enhanced delivery status update with operation tracking
  emitStatusUpdate(data) {
    try {
      const { orderId, deliveryPersonId, status, currentLocation, operationId, automatic = false } = data;
      
      // Emit to delivery room (customers, merchants, delivery person)
      const deliveryRoom = `delivery_${orderId}`;
      const statusUpdateData = {
        orderId,
        deliveryPersonId,
        status,
        currentLocation,
        operationId,
        automatic,
        timestamp: new Date()
      };

      this.io.to(deliveryRoom).emit('delivery_status_updated', statusUpdateData);

      // Also emit to delivery person's personal room for their dashboard
      if (deliveryPersonId) {
        const deliveryPersonRoom = `delivery_person_${deliveryPersonId}`;
        this.io.to(deliveryPersonRoom).emit('delivery_status_updated', statusUpdateData);
      }

      logger.info('Delivery status update emitted:', {
        orderId,
        status,
        operationId,
        automatic
      });

    } catch (error) {
      logger.error('Error emitting status update:', error);
    }
  }

  // Enhanced location update with deduplication
  emitLocationUpdate(data) {
    try {
      const { orderId, deliveryPersonId, location, operationId } = data;
      
      // Only emit if location has meaningful change
      if (!this.shouldEmitLocationUpdate(orderId, location)) {
        return false;
      }

      const deliveryRoom = `delivery_${orderId}`;
      const locationUpdateData = {
        orderId,
        deliveryPersonId,
        location,
        operationId,
        timestamp: new Date()
      };

      this.io.to(deliveryRoom).emit('delivery_location_updated', locationUpdateData);

      // Store last location for deduplication
      this.storeLastLocation(orderId, location);

      logger.info('Delivery location update emitted:', {
        orderId,
        operationId,
        coordinates: location.coordinates
      });

      return true;

    } catch (error) {
      logger.error('Error emitting location update:', error);
      return false;
    }
  }

  // Delivery operation result emission
  emitOperationResult(data) {
    try {
      const { operationId, operationType, success, error, deliveryId, userId } = data;
      
      // Emit to specific user who initiated the operation
      if (userId) {
        this.sendToUser(userId, 'delivery_operation_result', {
          operationId,
          operationType,
          success,
          error,
          deliveryId,
          timestamp: new Date()
        });
      }

      logger.info('Delivery operation result emitted:', {
        operationId,
        operationType,
        success
      });

    } catch (error) {
      logger.error('Error emitting operation result:', error);
    }
  }

  // Batch operation updates
  emitBatchUpdate(updates) {
    try {
      updates.forEach(update => {
        switch (update.type) {
          case 'status':
            this.emitStatusUpdate(update.data);
            break;
          case 'location':
            this.emitLocationUpdate(update.data);
            break;
          case 'operation_result':
            this.emitOperationResult(update.data);
            break;
        }
      });

      logger.info('Batch updates emitted:', { count: updates.length });

    } catch (error) {
      logger.error('Error emitting batch updates:', error);
    }
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  getUserSockets() {
    return Array.from(this.userSockets.values());
  }

  // Location deduplication helpers
  shouldEmitLocationUpdate(orderId, newLocation) {
    const lastLocationData = this.lastLocations.get(orderId);
    
    if (!lastLocationData) {
      return true; // First location update
    }

    const { location: lastLocation, timestamp: lastTimestamp } = lastLocationData;
    const now = Date.now();
    
    // Check time threshold
    if (now - lastTimestamp < this.locationTimeThreshold) {
      return false;
    }

    // Check distance threshold
    const distance = this.calculateDistance(
      lastLocation.coordinates[1], // latitude
      lastLocation.coordinates[0], // longitude
      newLocation.coordinates[1],
      newLocation.coordinates[0]
    );

    return distance >= this.locationUpdateThreshold;
  }

  storeLastLocation(orderId, location) {
    this.lastLocations.set(orderId, {
      location,
      timestamp: Date.now()
    });

    // Clean up old locations (keep only last 100)
    if (this.lastLocations.size > 100) {
      const oldestKey = this.lastLocations.keys().next().value;
      this.lastLocations.delete(oldestKey);
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Room management for delivery tracking
  joinDeliveryRoom(socket, orderId) {
    const roomName = `delivery_${orderId}`;
    socket.join(roomName);
    
    // Also join delivery person room if applicable
    if (socket.user && socket.user.role === 'delivery') {
      const deliveryPersonRoom = `delivery_person_${socket.userId}`;
      socket.join(deliveryPersonRoom);
    }

    logger.info('User joined delivery room:', {
      userId: socket.userId,
      orderId,
      role: socket.user?.role
    });
  }

  leaveDeliveryRoom(socket, orderId) {
    const roomName = `delivery_${orderId}`;
    socket.leave(roomName);

    if (socket.user && socket.user.role === 'delivery') {
      const deliveryPersonRoom = `delivery_person_${socket.userId}`;
      socket.leave(deliveryPersonRoom);
    }

    logger.info('User left delivery room:', {
      userId: socket.userId,
      orderId
    });
  }

  // Cleanup when delivery is completed
  cleanupDeliveryTracking(orderId) {
    // Remove stored location data
    this.lastLocations.delete(orderId);
    
    // Optionally emit cleanup notification to room
    const roomName = `delivery_${orderId}`;
    this.io.to(roomName).emit('delivery_tracking_ended', {
      orderId,
      timestamp: new Date()
    });

    logger.info('Delivery tracking cleanup completed:', { orderId });
  }
}

module.exports = new SocketService();