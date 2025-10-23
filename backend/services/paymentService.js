const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { logger, businessLogger } = require('../utils/logger');

class PaymentService {
  constructor() {
    this.stripe = stripe;
  }

  // Crear Payment Intent para Stripe
  async createPaymentIntent(orderId, amount, currency = 'usd', metadata = {}) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          orderId: orderId.toString(),
          customerEmail: order.customerId?.email || '',
          merchantId: order.merchantId?.toString() || '',
          ...metadata
        },
        description: `Payment for order ${order.orderNumber}`,
        receipt_email: order.customerId?.email
      });

      // Actualizar el pedido con el Payment Intent ID
      order.paymentInfo.paymentIntentId = paymentIntent.id;
      order.paymentInfo.status = 'processing';
      await order.save();

      logger.info('Payment Intent created', {
        orderId,
        paymentIntentId: paymentIntent.id,
        amount: amount
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status
      };

    } catch (error) {
      logger.error('Error creating payment intent', {
        orderId,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Payment Intent creation failed: ${error.message}`);
    }
  }

  // Confirmar pago
  async confirmPayment(paymentIntentId, paymentMethodId = null) {
    try {
      let paymentIntent;

      if (paymentMethodId) {
        // Confirmar con método de pago específico
        paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
          payment_method: paymentMethodId,
        });
      } else {
        // Solo obtener el estado actual
        paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      }

      const orderId = paymentIntent.metadata.orderId;
      const order = await Order.findById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      // Actualizar estado del pago en el pedido
      switch (paymentIntent.status) {
        case 'succeeded':
          order.paymentInfo.status = 'completed';
          order.paymentInfo.processedAt = new Date();
          order.paymentInfo.transactionId = paymentIntent.charges.data[0]?.id || paymentIntent.id;
          
          businessLogger.paymentProcessed(
            paymentIntent.id,
            orderId,
            paymentIntent.amount / 100,
            'card',
            'completed'
          );
          break;
          
        case 'processing':
          order.paymentInfo.status = 'processing';
          break;
          
        case 'requires_payment_method':
        case 'requires_confirmation':
          order.paymentInfo.status = 'pending';
          break;
          
        case 'canceled':
          order.paymentInfo.status = 'failed';
          order.paymentInfo.failureReason = 'Payment canceled';
          break;
          
        default:
          order.paymentInfo.status = 'failed';
          order.paymentInfo.failureReason = `Unknown status: ${paymentIntent.status}`;
      }

      await order.save();

      logger.info('Payment confirmed', {
        orderId,
        paymentIntentId,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100
      });

      return {
        status: paymentIntent.status,
        paymentIntent: {
          id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: paymentIntent.status
        },
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentInfo.status
        }
      };

    } catch (error) {
      logger.error('Error confirming payment', {
        paymentIntentId,
        error: error.message,
        stack: error.stack
      });

      // Marcar pago como fallido si hay una orden asociada
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId).catch(() => null);
      if (paymentIntent?.metadata?.orderId) {
        const order = await Order.findById(paymentIntent.metadata.orderId);
        if (order) {
          order.paymentInfo.status = 'failed';
          order.paymentInfo.failureReason = error.message;
          await order.save();
        }
      }

      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  // Cancelar Payment Intent
  async cancelPayment(paymentIntentId, reason = 'requested_by_customer') {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId, {
        cancellation_reason: reason
      });

      const orderId = paymentIntent.metadata.orderId;
      const order = await Order.findById(orderId);
      
      if (order) {
        order.paymentInfo.status = 'failed';
        order.paymentInfo.failureReason = `Payment canceled: ${reason}`;
        await order.save();
      }

      logger.info('Payment canceled', {
        orderId,
        paymentIntentId,
        reason
      });

      return {
        status: 'canceled',
        paymentIntentId,
        reason
      };

    } catch (error) {
      logger.error('Error canceling payment', {
        paymentIntentId,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Payment cancellation failed: ${error.message}`);
    }
  }

  // Procesar reembolso
  async processRefund(orderId, amount = null, reason = 'requested_by_customer') {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.paymentInfo.status !== 'completed') {
        throw new Error('Cannot refund a payment that is not completed');
      }

      const paymentIntentId = order.paymentInfo.paymentIntentId;
      const transactionId = order.paymentInfo.transactionId;

      if (!paymentIntentId && !transactionId) {
        throw new Error('No payment information found for refund');
      }

      // Crear reembolso
      const refundAmount = amount ? Math.round(amount * 100) : Math.round(order.total * 100);
      
      let refund;
      if (transactionId) {
        refund = await this.stripe.refunds.create({
          charge: transactionId,
          amount: refundAmount,
          reason: reason,
          metadata: {
            orderId: orderId.toString(),
            orderNumber: order.orderNumber
          }
        });
      } else {
        refund = await this.stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: refundAmount,
          reason: reason,
          metadata: {
            orderId: orderId.toString(),
            orderNumber: order.orderNumber
          }
        });
      }

      // Actualizar estado del pedido
      order.paymentInfo.status = 'refunded';
      order.paymentInfo.refundId = refund.id;
      order.paymentInfo.refundedAt = new Date();
      await order.save();

      businessLogger.paymentProcessed(
        refund.id,
        orderId,
        refund.amount / 100,
        'refund',
        'completed'
      );

      logger.info('Refund processed', {
        orderId,
        refundId: refund.id,
        amount: refund.amount / 100,
        reason
      });

      return {
        refundId: refund.id,
        amount: refund.amount / 100,
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason
      };

    } catch (error) {
      logger.error('Error processing refund', {
        orderId,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Refund processing failed: ${error.message}`);
    }
  }

  // Obtener información del pago
  async getPaymentInfo(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['charges.data.balance_transaction']
      });

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created: new Date(paymentIntent.created * 1000),
        description: paymentIntent.description,
        metadata: paymentIntent.metadata,
        charges: paymentIntent.charges.data.map(charge => ({
          id: charge.id,
          amount: charge.amount / 100,
          currency: charge.currency,
          status: charge.status,
          created: new Date(charge.created * 1000),
          receiptUrl: charge.receipt_url,
          balanceTransaction: charge.balance_transaction ? {
            id: charge.balance_transaction.id,
            fee: charge.balance_transaction.fee / 100,
            net: charge.balance_transaction.net / 100
          } : null
        }))
      };

    } catch (error) {
      logger.error('Error getting payment info', {
        paymentIntentId,
        error: error.message
      });
      throw new Error(`Failed to get payment info: ${error.message}`);
    }
  }

  // Manejar webhook de Stripe
  async handleWebhook(body, signature) {
    try {
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const event = this.stripe.webhooks.constructEvent(body, signature, endpointSecret);

      logger.info('Stripe webhook received', {
        type: event.type,
        id: event.id
      });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
          
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;
          
        case 'charge.dispute.created':
          await this.handleChargeDispute(event.data.object);
          break;
          
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
          
        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }

      return { received: true };

    } catch (error) {
      logger.error('Webhook error', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Webhook handling failed: ${error.message}`);
    }
  }

  // Manejar pago exitoso
  async handlePaymentIntentSucceeded(paymentIntent) {
    try {
      const orderId = paymentIntent.metadata.orderId;
      if (!orderId) return;

      const order = await Order.findById(orderId);
      if (!order) return;

      order.paymentInfo.status = 'completed';
      order.paymentInfo.processedAt = new Date();
      order.paymentInfo.transactionId = paymentIntent.charges.data[0]?.id || paymentIntent.id;
      
      await order.save();

      businessLogger.paymentProcessed(
        paymentIntent.id,
        orderId,
        paymentIntent.amount / 100,
        'card',
        'completed'
      );

      logger.info('Payment intent succeeded processed', {
        orderId,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100
      });

    } catch (error) {
      logger.error('Error handling payment intent succeeded', {
        paymentIntentId: paymentIntent.id,
        error: error.message
      });
    }
  }

  // Manejar pago fallido
  async handlePaymentIntentFailed(paymentIntent) {
    try {
      const orderId = paymentIntent.metadata.orderId;
      if (!orderId) return;

      const order = await Order.findById(orderId);
      if (!order) return;

      order.paymentInfo.status = 'failed';
      order.paymentInfo.failureReason = paymentIntent.last_payment_error?.message || 'Payment failed';
      
      await order.save();

      logger.info('Payment intent failed processed', {
        orderId,
        paymentIntentId: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message
      });

    } catch (error) {
      logger.error('Error handling payment intent failed', {
        paymentIntentId: paymentIntent.id,
        error: error.message
      });
    }
  }

  // Manejar disputa de cargo
  async handleChargeDispute(dispute) {
    try {
      logger.warn('Charge dispute created', {
        disputeId: dispute.id,
        chargeId: dispute.charge,
        amount: dispute.amount / 100,
        reason: dispute.reason,
        status: dispute.status
      });

      // Aquí podrías implementar lógica para notificar al comerciante
      // y manejar el proceso de disputa

    } catch (error) {
      logger.error('Error handling charge dispute', {
        disputeId: dispute.id,
        error: error.message
      });
    }
  }

  // Crear customer en Stripe
  async createCustomer(userId, email, name, phone = null) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        phone,
        metadata: {
          userId: userId.toString()
        }
      });

      logger.info('Stripe customer created', {
        userId,
        customerId: customer.id,
        email
      });

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone
      };

    } catch (error) {
      logger.error('Error creating Stripe customer', {
        userId,
        error: error.message
      });
      throw new Error(`Customer creation failed: ${error.message}`);
    }
  }

  // Obtener métodos de pago del customer
  async getPaymentMethods(customerId, type = 'card') {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: type
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        } : null,
        created: new Date(pm.created * 1000)
      }));

    } catch (error) {
      logger.error('Error getting payment methods', {
        customerId,
        error: error.message
      });
      throw new Error(`Failed to get payment methods: ${error.message}`);
    }
  }

  // Crear Setup Intent para guardar método de pago
  async createSetupIntent(customerId) {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session'
      });

      return {
        id: setupIntent.id,
        clientSecret: setupIntent.client_secret,
        status: setupIntent.status
      };

    } catch (error) {
      logger.error('Error creating setup intent', {
        customerId,
        error: error.message
      });
      throw new Error(`Setup intent creation failed: ${error.message}`);
    }
  }
}

module.exports = new PaymentService();