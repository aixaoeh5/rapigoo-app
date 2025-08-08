const express = require('express');
const Chat = require('../models/Chat');
const Order = require('../models/Order');
const User = require('../models/User');
const verifyToken = require('../middleware/verifyToken');
const { cachePresets, invalidateCache } = require('../middleware/cache');
const { securityMonitoring } = require('../middleware/monitoring');
const socketService = require('../services/socketService');
const Joi = require('joi');
const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(verifyToken);

// Esquemas de validación
const createChatSchema = Joi.object({
  orderId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  chatType: Joi.string().valid('order_support', 'delivery_coordination', 'customer_service').default('order_support')
});

const sendMessageSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required(),
  messageType: Joi.string().valid('text', 'image', 'location', 'file').default('text'),
  metadata: Joi.object({
    // Para imágenes
    imageUrl: Joi.string().uri().optional(),
    imageWidth: Joi.number().optional(),
    imageHeight: Joi.number().optional(),
    
    // Para ubicación
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional(),
    locationName: Joi.string().optional(),
    
    // Para archivos
    fileUrl: Joi.string().uri().optional(),
    fileName: Joi.string().optional(),
    fileSize: Joi.number().optional(),
    mimeType: Joi.string().optional()
  }).optional(),
  replyTo: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
});

// POST /api/chat/create - Crear chat para un pedido
router.post('/create', invalidateCache(['api:chat:*']), async (req, res) => {
  try {
    const { error, value } = createChatSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { orderId, chatType } = value;

    // Verificar que el pedido existe
    const order = await Order.findById(orderId)
      .populate('customerId', 'name email role')
      .populate('merchantId', 'name email role')
      .populate('deliveryPersonId', 'name email role');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Pedido no encontrado',
          code: 'ORDER_NOT_FOUND'
        }
      });
    }

    // Verificar que el usuario tiene acceso al pedido
    const hasAccess = order.customerId._id.toString() === req.user.id ||
                      order.merchantId._id.toString() === req.user.id ||
                      (order.deliveryPersonId && order.deliveryPersonId._id.toString() === req.user.id);

    if (!hasAccess) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized chat creation attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este pedido',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Verificar si ya existe un chat para este pedido
    let existingChat = await Chat.findByOrderId(orderId);
    if (existingChat) {
      return res.json({
        success: true,
        message: 'Chat ya existe para este pedido',
        data: {
          chat: existingChat
        }
      });
    }

    // Crear participantes
    const participants = [
      {
        userId: order.customerId._id,
        role: 'customer'
      },
      {
        userId: order.merchantId._id,
        role: 'merchant'
      }
    ];

    // Agregar delivery person si existe
    if (order.deliveryPersonId) {
      participants.push({
        userId: order.deliveryPersonId._id,
        role: 'delivery'
      });
    }

    // Crear chat
    const chat = await Chat.createOrderChat(orderId, req.user.id, participants);

    // Mensaje inicial del sistema
    await chat.addMessage({
      senderId: req.user.id,
      senderType: 'system',
      content: `Chat iniciado para el pedido ${order.orderNumber}`,
      messageType: 'system'
    });

    // Populate para respuesta
    await chat.populate([
      { path: 'participants.userId', select: 'name email role' },
      { path: 'orderId', select: 'orderNumber status' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Chat creado exitosamente',
      data: {
        chat
      }
    });

  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/chat/list - Obtener chats del usuario
router.get('/list', cachePresets.static, async (req, res) => {
  try {
    const { status = 'active', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const chats = await Chat.findUserChats(req.user.id, {
      status,
      limit: parseInt(limit),
      skip
    });

    res.json({
      success: true,
      data: {
        chats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: chats.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user chats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/chat/:chatId - Obtener detalles de un chat específico
router.get('/:chatId', cachePresets.static, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId)
      .populate('participants.userId', 'name email role')
      .populate('messages.senderId', 'name role')
      .populate('orderId', 'orderNumber status total');

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Chat no encontrado',
          code: 'CHAT_NOT_FOUND'
        }
      });
    }

    // Verificar que el usuario es participante
    const isParticipant = chat.participants.some(p => 
      p.userId._id.toString() === req.user.id && p.isActive
    );

    if (!isParticipant) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized chat access attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este chat',
          code: 'ACCESS_DENIED'
        }
      });
    }

    res.json({
      success: true,
      data: {
        chat
      }
    });

  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/chat/:chatId/messages - Obtener mensajes de un chat
router.get('/:chatId/messages', cachePresets.static, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, skip = 0, before, after } = req.query;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Chat no encontrado',
          code: 'CHAT_NOT_FOUND'
        }
      });
    }

    // Verificar acceso
    const isParticipant = chat.participants.some(p => 
      p.userId.toString() === req.user.id && p.isActive
    );

    if (!isParticipant) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized chat messages access attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este chat',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Obtener mensajes
    const messages = chat.getMessages({
      limit: parseInt(limit),
      skip: parseInt(skip),
      before,
      after
    });

    // Populate sender information
    await chat.populate('messages.senderId', 'name role');

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Enviar en orden cronológico
        chatId,
        pagination: {
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: messages.length === parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// POST /api/chat/:chatId/message - Enviar mensaje (también funciona con WebSocket)
router.post('/:chatId/message', invalidateCache(['api:chat:*']), async (req, res) => {
  try {
    const { chatId } = req.params;
    const { error, value } = sendMessageSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Datos inválidos',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        }
      });
    }

    const { content, messageType, metadata, replyTo } = value;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Chat no encontrado',
          code: 'CHAT_NOT_FOUND'
        }
      });
    }

    // Verificar permisos
    const isParticipant = chat.participants.some(p => 
      p.userId.toString() === req.user.id && p.isActive
    );

    if (!isParticipant) {
      securityMonitoring.suspiciousActivity(req, 'Unauthorized message send attempt');
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este chat',
          code: 'ACCESS_DENIED'
        }
      });
    }

    // Verificar que el chat está activo
    if (chat.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No se pueden enviar mensajes a un chat cerrado',
          code: 'CHAT_CLOSED'
        }
      });
    }

    // Crear mensaje
    const message = await chat.addMessage({
      senderId: req.user.id,
      senderType: req.user.role,
      content,
      messageType,
      metadata,
      replyTo
    });

    // Emitir via WebSocket si está disponible
    const messageData = {
      chatId,
      message: {
        _id: message._id,
        senderId: req.user.id,
        senderName: req.user.name,
        senderType: req.user.role,
        content: message.content,
        messageType: message.messageType,
        metadata: message.metadata,
        timestamp: message.timestamp,
        replyTo: message.replyTo
      }
    };

    socketService.sendToChat(chatId, 'new_message', messageData);

    res.status(201).json({
      success: true,
      message: 'Mensaje enviado exitosamente',
      data: {
        message
      }
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// PUT /api/chat/:chatId/message/:messageId - Editar mensaje
router.put('/:chatId/message/:messageId', invalidateCache(['api:chat:*']), async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { newContent } = req.body;

    if (!newContent || newContent.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'El contenido del mensaje no puede estar vacío',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Chat no encontrado',
          code: 'CHAT_NOT_FOUND'
        }
      });
    }

    await chat.editMessage(messageId, newContent, req.user.id);

    // Emitir via WebSocket
    socketService.sendToChat(chatId, 'message_edited', {
      chatId,
      messageId,
      newContent,
      editedBy: req.user.id,
      editedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Mensaje editado exitosamente'
    });

  } catch (error) {
    console.error('Error editing message:', error);
    res.status(400).json({
      success: false,
      error: {
        message: error.message || 'Error interno del servidor',
        code: 'MESSAGE_EDIT_ERROR'
      }
    });
  }
});

// DELETE /api/chat/:chatId/message/:messageId - Eliminar mensaje
router.delete('/:chatId/message/:messageId', invalidateCache(['api:chat:*']), async (req, res) => {
  try {
    const { chatId, messageId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Chat no encontrado',
          code: 'CHAT_NOT_FOUND'
        }
      });
    }

    await chat.deleteMessage(messageId, req.user.id);

    // Emitir via WebSocket
    socketService.sendToChat(chatId, 'message_deleted', {
      chatId,
      messageId,
      deletedBy: req.user.id,
      deletedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Mensaje eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(400).json({
      success: false,
      error: {
        message: error.message || 'Error interno del servidor',
        code: 'MESSAGE_DELETE_ERROR'
      }
    });
  }
});

// POST /api/chat/:chatId/read - Marcar mensajes como leídos
router.post('/:chatId/read', invalidateCache(['api:chat:*']), async (req, res) => {
  try {
    const { chatId } = req.params;
    const { messageId } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Chat no encontrado',
          code: 'CHAT_NOT_FOUND'
        }
      });
    }

    // Verificar acceso
    const isParticipant = chat.participants.some(p => 
      p.userId.toString() === req.user.id && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este chat',
          code: 'ACCESS_DENIED'
        }
      });
    }

    await chat.markAsRead(req.user.id, messageId);

    // Emitir via WebSocket
    socketService.sendToChat(chatId, 'message_read', {
      chatId,
      messageId,
      readBy: req.user.id,
      readAt: new Date()
    });

    res.json({
      success: true,
      message: 'Mensajes marcados como leídos'
    });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// PUT /api/chat/:chatId/close - Cerrar chat
router.put('/:chatId/close', invalidateCache(['api:chat:*']), async (req, res) => {
  try {
    const { chatId } = req.params;
    const { reason = 'Chat cerrado por el usuario' } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Chat no encontrado',
          code: 'CHAT_NOT_FOUND'
        }
      });
    }

    // Solo participantes pueden cerrar el chat
    const isParticipant = chat.participants.some(p => 
      p.userId.toString() === req.user.id && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este chat',
          code: 'ACCESS_DENIED'
        }
      });
    }

    await chat.closeChat(req.user.id, reason);

    // Emitir via WebSocket
    socketService.sendToChat(chatId, 'chat_closed', {
      chatId,
      closedBy: req.user.id,
      closedAt: new Date(),
      reason
    });

    res.json({
      success: true,
      message: 'Chat cerrado exitosamente'
    });

  } catch (error) {
    console.error('Error closing chat:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// GET /api/chat/:chatId/search - Buscar mensajes en un chat
router.get('/:chatId/search', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { q: query, messageType, limit = 20 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Query de búsqueda es requerido',
          code: 'VALIDATION_ERROR'
        }
      });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Chat no encontrado',
          code: 'CHAT_NOT_FOUND'
        }
      });
    }

    // Verificar acceso
    const isParticipant = chat.participants.some(p => 
      p.userId.toString() === req.user.id && p.isActive
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tienes acceso a este chat',
          code: 'ACCESS_DENIED'
        }
      });
    }

    const results = await Chat.searchMessages(chatId, query, {
      limit: parseInt(limit),
      messageType
    });

    res.json({
      success: true,
      data: {
        results,
        query,
        chatId
      }
    });

  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

module.exports = router;