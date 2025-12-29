const admin = require('firebase-admin');
const DeviceToken = require('../models/DeviceToken');
const { logger } = require('../utils/logger');

class PushNotificationService {
  constructor() {
    this.isInitialized = false;
    this.init();
  }

  async init() {
    try {
      // Firebase Admin ya se inicializa en firebaseAdmin.js
      // Solo verificamos que esté disponible
      if (admin.apps.length > 0) {
        this.messaging = admin.messaging();
        this.isInitialized = true;
        console.log('✅ Push Notification Service inicializado');
      } else {
        console.warn('⚠️ Firebase Admin no está inicializado, notificaciones push deshabilitadas');
      }
    } catch (error) {
      console.error('❌ Error inicializando Push Notification Service:', error);
      this.isInitialized = false;
    }
  }

  // Enviar notificación a un usuario específico
  async sendToUser(userId, notification, data = {}) {
    if (!this.isInitialized) {
      console.warn('⚠️ Push notifications no disponibles');
      return { success: false, error: 'Service not initialized' };
    }

    try {
      console.log(`📱 Enviando notificación a usuario ${userId}:`, {
        title: notification.title,
        body: notification.body,
        data: data
      });

      // Obtener todos los tokens del usuario
      const deviceTokens = await DeviceToken.find({ 
        userId: userId, 
        isActive: true 
      });

      console.log(`📱 Tokens encontrados para usuario ${userId}:`, {
        count: deviceTokens.length,
        tokens: deviceTokens.map(dt => ({
          platform: dt.platform,
          lastUpdated: dt.lastUpdated,
          tokenPrefix: dt.deviceToken.substring(0, 10) + '...'
        }))
      });

      if (deviceTokens.length === 0) {
        console.warn(`⚠️ No se encontraron tokens activos para el usuario ${userId}`);
        return { success: true, sent: 0, message: 'No tokens found' };
      }

      const tokens = deviceTokens.map(dt => dt.deviceToken);
      const result = await this.sendToTokens(tokens, notification, data);
      
      console.log(`📱 Resultado envío para usuario ${userId}:`, {
        sent: result.sent,
        failed: result.failed
      });
      
      return result;

    } catch (error) {
      console.error(`❌ Error enviando notificación a usuario ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Enviar notificación a múltiples tokens
  async sendToTokens(tokens, notification, data = {}) {
    if (!this.isInitialized) {
      console.warn('⚠️ Push notifications no disponibles');
      return { success: false, error: 'Service not initialized' };
    }

    try {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.image && { imageUrl: notification.image })
        },
        data: {
          ...data,
          // Convertir todos los valores a string (requerido por FCM)
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
            return acc;
          }, {})
        },
        android: {
          notification: {
            channelId: data.channelId || 'rapigoo-default',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body
              },
              sound: 'default',
              badge: 1
            }
          }
        },
        tokens: tokens
      };

      const response = await this.messaging.sendEachForMulticast(message);
      
      // Manejar tokens inválidos
      if (response.failureCount > 0) {
        await this.handleFailedTokens(tokens, response.responses);
      }

      logger.info(`Notificación enviada: ${response.successCount} éxitos, ${response.failureCount} fallos`);

      return {
        success: true,
        sent: response.successCount,
        failed: response.failureCount,
        results: response.responses
      };

    } catch (error) {
      logger.error('Error enviando notificación:', error);
      return { success: false, error: error.message };
    }
  }

  // Manejar tokens que fallaron (inválidos o expirados)
  async handleFailedTokens(tokens, responses) {
    try {
      const tokensToDeactivate = [];

      responses.forEach((response, index) => {
        if (!response.success) {
          const errorCode = response.error?.code;
          
          // Tokens que deben ser removidos/desactivados
          if (['messaging/invalid-registration-token', 
               'messaging/registration-token-not-registered'].includes(errorCode)) {
            tokensToDeactivate.push(tokens[index]);
          }
        }
      });

      if (tokensToDeactivate.length > 0) {
        await DeviceToken.updateMany(
          { deviceToken: { $in: tokensToDeactivate } },
          { isActive: false }
        );
        logger.info(`Desactivados ${tokensToDeactivate.length} tokens inválidos`);
      }

    } catch (error) {
      logger.error('Error manejando tokens fallidos:', error);
    }
  }

  // Enviar notificación de actualización de pedido
  async sendOrderUpdate(userId, order, status) {
    const statusMessages = {
      'confirmed': 'Tu pedido ha sido confirmado',
      'preparing': 'Tu pedido está siendo preparado',
      'ready': 'Tu pedido está listo para recoger',
      'picked_up': 'Tu pedido ha sido recogido por el delivery',
      'in_transit': 'Tu pedido está en camino',
      'delivered': 'Tu pedido ha sido entregado',
      'cancelled': 'Tu pedido ha sido cancelado'
    };

    const notification = {
      title: `Pedido ${order.orderNumber}`,
      body: statusMessages[status] || 'Estado de pedido actualizado'
    };

    const data = {
      type: 'order_update',
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      status: status,
      channelId: 'rapigoo-orders'
    };

    return await this.sendToUser(userId, notification, data);
  }

  // Enviar notificación de promoción
  async sendPromotion(userIds, promotion) {
    const notification = {
      title: promotion.title || 'Nueva promoción disponible',
      body: promotion.description,
      image: promotion.image
    };

    const data = {
      type: 'promotion',
      promotionId: promotion._id?.toString(),
      merchantId: promotion.merchantId?.toString(),
      channelId: 'rapigoo-promotions'
    };

    const results = [];
    for (const userId of userIds) {
      const result = await this.sendToUser(userId, notification, data);
      results.push({ userId, ...result });
    }

    return results;
  }

  // Notificación a comerciante sobre nuevo pedido
  async sendNewOrderToMerchant(merchantId, order) {
    const notification = {
      title: 'Nuevo pedido recibido',
      body: `Pedido ${order.orderNumber} - Total: $${order.total}`
    };

    const data = {
      type: 'new_order',
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      total: order.total.toString(),
      channelId: 'rapigoo-orders'
    };

    return await this.sendToUser(merchantId, notification, data);
  }

  // Enviar notificación programada (para testing)
  async sendTestNotification(userId) {
    const notification = {
      title: '🧪 Notificación de prueba',
      body: 'Esta es una notificación de prueba de Rapigoo'
    };

    const data = {
      type: 'test',
      timestamp: new Date().toISOString(),
      channelId: 'rapigoo-default'
    };

    return await this.sendToUser(userId, notification, data);
  }
}

module.exports = new PushNotificationService();