const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderType: {
    type: String,
    enum: ['customer', 'merchant', 'delivery'],
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'location', 'file', 'system'],
    default: 'text'
  },
  metadata: {
    // Para mensajes de imagen
    imageUrl: String,
    imageWidth: Number,
    imageHeight: Number,
    
    // Para mensajes de ubicación
    latitude: Number,
    longitude: Number,
    locationName: String,
    
    // Para archivos
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    mimeType: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  
  // Estado del mensaje
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read'],
    default: 'sent'
  },
  
  // Lecturas por usuario
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Para respuestas
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }
}, {
  _id: true,
  timestamps: true
});

const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['customer', 'merchant', 'delivery'],
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  // Configuraciones de notificación
  notifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    sound: {
      type: Boolean,
      default: true
    },
    vibration: {
      type: Boolean,
      default: true
    }
  }
}, {
  _id: false
});

const chatSchema = new mongoose.Schema({
  // Información del pedido asociado
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true
  },
  
  // Tipo de chat
  chatType: {
    type: String,
    enum: ['order_support', 'delivery_coordination', 'customer_service'],
    default: 'order_support'
  },
  
  // Participantes del chat
  participants: [participantSchema],
  
  // Mensajes del chat
  messages: [messageSchema],
  
  // Estado del chat
  status: {
    type: String,
    enum: ['active', 'archived', 'closed'],
    default: 'active'
  },
  
  // Configuraciones del chat
  settings: {
    autoClose: {
      type: Boolean,
      default: true
    },
    autoCloseDelay: {
      type: Number,
      default: 24 * 60 * 60 * 1000 // 24 horas en ms
    },
    allowFileSharing: {
      type: Boolean,
      default: true
    },
    maxFileSize: {
      type: Number,
      default: 10 * 1024 * 1024 // 10MB
    }
  },
  
  // Información del último mensaje
  lastMessage: {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    content: String,
    messageType: String,
    timestamp: Date
  },
  
  // Metadatos
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Cierre del chat
  closedAt: Date,
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  closureReason: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes para mejor performance
chatSchema.index({ orderId: 1 });
chatSchema.index({ 'participants.userId': 1, status: 1 });
chatSchema.index({ status: 1, updatedAt: -1 });
chatSchema.index({ 'messages.timestamp': -1 });
chatSchema.index({ 'lastMessage.timestamp': -1 });

// Index compuesto para búsquedas de mensajes
chatSchema.index({ 
  'messages.content': 'text',
  'messages.messageType': 1,
  'messages.timestamp': -1 
});

// Virtual para contar mensajes no leídos por usuario
chatSchema.virtual('unreadMessages').get(function() {
  const unreadCounts = {};
  this.participants.forEach(participant => {
    unreadCounts[participant.userId.toString()] = participant.unreadCount;
  });
  return unreadCounts;
});

// Virtual para verificar si el chat está activo
chatSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// Virtual para obtener participantes activos
chatSchema.virtual('activeParticipants').get(function() {
  return this.participants.filter(p => p.isActive);
});

// Pre-save middleware para actualizar información del último mensaje
chatSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    const lastMsg = this.messages[this.messages.length - 1];
    this.lastMessage = {
      senderId: lastMsg.senderId,
      content: lastMsg.content,
      messageType: lastMsg.messageType,
      timestamp: lastMsg.timestamp
    };
  }
  
  // Auto-cerrar chat si está configurado
  if (this.settings.autoClose && this.status === 'active' && this.lastMessage) {
    const timeSinceLastMessage = Date.now() - this.lastMessage.timestamp.getTime();
    if (timeSinceLastMessage > this.settings.autoCloseDelay) {
      this.status = 'archived';
      this.closedAt = new Date();
      this.closureReason = 'Auto-closed due to inactivity';
    }
  }
  
  next();
});

// Instance methods
chatSchema.methods.addMessage = function(messageData) {
  const { senderId, senderType, content, messageType = 'text', metadata = {}, replyTo } = messageData;
  
  const message = {
    senderId,
    senderType,
    content,
    messageType,
    metadata,
    replyTo,
    timestamp: new Date(),
    status: 'sent'
  };
  
  this.messages.push(message);
  
  // Actualizar contadores de no leídos para otros participantes
  this.participants.forEach(participant => {
    if (participant.userId.toString() !== senderId.toString()) {
      participant.unreadCount += 1;
    }
  });
  
  return this.save().then(() => {
    return this.messages[this.messages.length - 1];
  });
};

chatSchema.methods.markAsRead = function(userId, messageId = null) {
  const participant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (!participant) {
    throw new Error('User is not a participant in this chat');
  }
  
  if (messageId) {
    // Marcar mensaje específico como leído
    const message = this.messages.id(messageId);
    if (message) {
      const readEntry = message.readBy.find(r => r.userId.toString() === userId.toString());
      if (!readEntry) {
        message.readBy.push({ userId, readAt: new Date() });
      }
    }
  } else {
    // Marcar todos los mensajes como leídos
    participant.unreadCount = 0;
    participant.lastSeenAt = new Date();
    
    // Marcar mensajes recientes como leídos
    this.messages.forEach(message => {
      if (message.senderId.toString() !== userId.toString()) {
        const readEntry = message.readBy.find(r => r.userId.toString() === userId.toString());
        if (!readEntry) {
          message.readBy.push({ userId, readAt: new Date() });
        }
      }
    });
  }
  
  return this.save();
};

chatSchema.methods.addParticipant = function(userId, role) {
  const existingParticipant = this.participants.find(p => p.userId.toString() === userId.toString());
  
  if (existingParticipant) {
    if (!existingParticipant.isActive) {
      existingParticipant.isActive = true;
      existingParticipant.joinedAt = new Date();
      existingParticipant.leftAt = null;
    }
    return this.save();
  }
  
  this.participants.push({
    userId,
    role,
    joinedAt: new Date(),
    isActive: true,
    lastSeenAt: new Date(),
    unreadCount: this.messages.length
  });
  
  // Mensaje del sistema
  return this.addMessage({
    senderId: userId,
    senderType: 'system',
    content: `${role} se unió al chat`,
    messageType: 'system'
  });
};

chatSchema.methods.removeParticipant = function(userId) {
  const participant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (participant) {
    participant.isActive = false;
    participant.leftAt = new Date();
    
    // Mensaje del sistema
    return this.addMessage({
      senderId: userId,
      senderType: 'system',
      content: `${participant.role} dejó el chat`,
      messageType: 'system'
    });
  }
  
  return this.save();
};

chatSchema.methods.closeChat = function(userId, reason = 'Chat closed') {
  this.status = 'closed';
  this.closedAt = new Date();
  this.closedBy = userId;
  this.closureReason = reason;
  
  // Mensaje del sistema
  return this.addMessage({
    senderId: userId,
    senderType: 'system',
    content: 'Chat cerrado',
    messageType: 'system'
  });
};

chatSchema.methods.editMessage = function(messageId, newContent, userId) {
  const message = this.messages.id(messageId);
  if (!message) {
    throw new Error('Message not found');
  }
  
  if (message.senderId.toString() !== userId.toString()) {
    throw new Error('Only message sender can edit the message');
  }
  
  // No se pueden editar mensajes después de 15 minutos
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (message.timestamp < fifteenMinutesAgo) {
    throw new Error('Message is too old to edit');
  }
  
  message.content = newContent;
  message.edited = true;
  message.editedAt = new Date();
  
  return this.save();
};

chatSchema.methods.deleteMessage = function(messageId, userId) {
  const message = this.messages.id(messageId);
  if (!message) {
    throw new Error('Message not found');
  }
  
  if (message.senderId.toString() !== userId.toString()) {
    throw new Error('Only message sender can delete the message');
  }
  
  // No se pueden eliminar mensajes después de 15 minutos
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (message.timestamp < fifteenMinutesAgo) {
    throw new Error('Message is too old to delete');
  }
  
  message.content = 'Este mensaje ha sido eliminado';
  message.messageType = 'system';
  message.edited = true;
  message.editedAt = new Date();
  
  return this.save();
};

chatSchema.methods.getMessages = function(options = {}) {
  const { limit = 50, skip = 0, before = null, after = null } = options;
  
  let messages = [...this.messages];
  
  // Filtrar por fecha si se especifica
  if (before) {
    messages = messages.filter(msg => msg.timestamp < new Date(before));
  }
  
  if (after) {
    messages = messages.filter(msg => msg.timestamp > new Date(after));
  }
  
  // Ordenar por timestamp descendente (más recientes primero)
  messages.sort((a, b) => b.timestamp - a.timestamp);
  
  // Aplicar paginación
  messages = messages.slice(skip, skip + limit);
  
  return messages;
};

// Static methods
chatSchema.statics.findByOrderId = function(orderId) {
  return this.findOne({ orderId })
    .populate('participants.userId', 'name email phone role')
    .populate('messages.senderId', 'name')
    .populate('lastMessage.senderId', 'name');
};

chatSchema.statics.findUserChats = function(userId, options = {}) {
  const { status = 'active', limit = 20, skip = 0 } = options;
  
  return this.find({
    'participants.userId': userId,
    'participants.isActive': true,
    status: status
  })
  .populate('participants.userId', 'name email phone role')
  .populate('lastMessage.senderId', 'name')
  .populate('orderId', 'orderNumber status')
  .sort({ 'lastMessage.timestamp': -1 })
  .limit(limit)
  .skip(skip);
};

chatSchema.statics.createOrderChat = function(orderId, createdBy, participants = []) {
  const chat = new this({
    orderId,
    createdBy,
    chatType: 'order_support',
    status: 'active'
  });
  
  // Agregar participantes
  participants.forEach(participant => {
    chat.participants.push({
      userId: participant.userId,
      role: participant.role,
      joinedAt: new Date(),
      isActive: true,
      lastSeenAt: new Date(),
      unreadCount: 0
    });
  });
  
  return chat.save();
};

chatSchema.statics.searchMessages = function(chatId, query, options = {}) {
  const { limit = 20, messageType = null } = options;
  
  const pipeline = [
    { $match: { _id: chatId } },
    { $unwind: '$messages' },
    {
      $match: {
        'messages.content': { $regex: query, $options: 'i' },
        ...(messageType && { 'messages.messageType': messageType })
      }
    },
    { $sort: { 'messages.timestamp': -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'messages.senderId',
        foreignField: '_id',
        as: 'messages.sender'
      }
    },
    {
      $unwind: '$messages.sender'
    },
    {
      $project: {
        message: '$messages',
        'message.sender': { name: 1, role: 1 }
      }
    }
  ];
  
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Chat', chatSchema);