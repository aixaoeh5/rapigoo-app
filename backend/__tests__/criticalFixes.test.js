const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const DeliveryTracking = require('../models/DeliveryTracking');
const TransactionHelper = require('../utils/transactionHelper');

describe('Critical Fixes Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoURI = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/rapigoo_test';
    await mongoose.connect(mongoURI);
  });

  afterAll(async () => {
    // Clean up and disconnect
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await DeliveryTracking.deleteMany({});
  });

  describe('P0 Fix 1: Transaction Boundaries', () => {
    test('Order creation and cart clearing should be atomic', async () => {
      // Create a test cart
      const cart = new Cart({
        userId: new mongoose.Types.ObjectId(),
        items: [{
          serviceId: new mongoose.Types.ObjectId(),
          merchantId: new mongoose.Types.ObjectId(),
          quantity: 2,
          price: 100,
          serviceName: 'Test Service',
          merchantName: 'Test Merchant'
        }]
      });
      await cart.save();

      // Create order data
      const orderData = new Order({
        customerId: cart.userId,
        merchantId: cart.items[0].merchantId,
        items: cart.items.map(item => ({
          serviceId: item.serviceId,
          name: item.serviceName,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity
        })),
        subtotal: 200,
        total: 250,
        deliveryInfo: {
          address: {
            street: 'Test Street',
            city: 'Test City',
            coordinates: [-69.9, 18.5]
          }
        }
      });

      // Test successful transaction
      const result = await TransactionHelper.createOrderAndClearCart(orderData, cart);
      
      expect(result).toBeDefined();
      expect(result.orderNumber).toBeDefined();
      
      // Verify cart was cleared
      const updatedCart = await Cart.findById(cart._id);
      expect(updatedCart.items).toHaveLength(0);
    });

    test('Transaction should rollback on order creation failure', async () => {
      const cart = new Cart({
        userId: new mongoose.Types.ObjectId(),
        items: [{
          serviceId: new mongoose.Types.ObjectId(),
          merchantId: new mongoose.Types.ObjectId(),
          quantity: 1,
          price: 100,
          serviceName: 'Test Service',
          merchantName: 'Test Merchant'
        }]
      });
      await cart.save();

      // Create invalid order data (missing required fields)
      const invalidOrderData = new Order({
        // Missing required fields to trigger validation error
        customerId: null
      });

      // Transaction should fail and rollback
      await expect(
        TransactionHelper.createOrderAndClearCart(invalidOrderData, cart)
      ).rejects.toThrow();

      // Verify cart was NOT cleared
      const unchangedCart = await Cart.findById(cart._id);
      expect(unchangedCart.items).toHaveLength(1);
    });
  });

  describe('P0 Fix 2: Optimistic Locking', () => {
    test('Concurrent status updates should be detected', async () => {
      // Create an order
      const order = new Order({
        customerId: new mongoose.Types.ObjectId(),
        merchantId: new mongoose.Types.ObjectId(),
        items: [{
          serviceId: new mongoose.Types.ObjectId(),
          name: 'Test Service',
          price: 100,
          quantity: 1,
          subtotal: 100
        }],
        subtotal: 100,
        total: 120,
        deliveryInfo: {
          address: {
            street: 'Test Street',
            city: 'Test City',
            coordinates: [-69.9, 18.5]
          }
        }
      });
      await order.save();

      // Simulate concurrent updates
      const order1 = await Order.findById(order._id);
      const order2 = await Order.findById(order._id);

      // First update should succeed
      await order1.updateStatus('confirmed');

      // Second update should fail with concurrency conflict
      await expect(order2.updateStatus('preparing')).rejects.toThrow(/Concurrent modification detected/);
    });

    test('Sequential status updates should work normally', async () => {
      const order = new Order({
        customerId: new mongoose.Types.ObjectId(),
        merchantId: new mongoose.Types.ObjectId(),
        items: [{
          serviceId: new mongoose.Types.ObjectId(),
          name: 'Test Service',
          price: 100,
          quantity: 1,
          subtotal: 100
        }],
        subtotal: 100,
        total: 120,
        deliveryInfo: {
          address: {
            street: 'Test Street',
            city: 'Test City',
            coordinates: [-69.9, 18.5]
          }
        }
      });
      await order.save();

      // Sequential updates should work
      await order.updateStatus('confirmed');
      await order.updateStatus('preparing');
      await order.updateStatus('ready');

      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.status).toBe('ready');
      expect(updatedOrder.__v).toBe(3); // Version should be incremented
    });
  });

  describe('P0 Fix 3: Atomic Delivery Assignment', () => {
    test('Delivery assignment should be atomic', async () => {
      // Create order and tracking
      const order = new Order({
        customerId: new mongoose.Types.ObjectId(),
        merchantId: new mongoose.Types.ObjectId(),
        items: [{
          serviceId: new mongoose.Types.ObjectId(),
          name: 'Test Service',
          price: 100,
          quantity: 1,
          subtotal: 100
        }],
        subtotal: 100,
        total: 120,
        status: 'ready',
        deliveryInfo: {
          address: {
            street: 'Test Street',
            city: 'Test City',
            coordinates: [-69.9, 18.5]
          }
        }
      });
      await order.save();

      const deliveryPersonId = new mongoose.Types.ObjectId();
      const deliveryTracking = new DeliveryTracking({
        orderId: order._id,
        deliveryPersonId,
        pickupLocation: {
          coordinates: [-69.9, 18.5],
          address: 'Pickup Address'
        },
        deliveryLocation: {
          coordinates: [-69.8, 18.4],
          address: 'Delivery Address'
        }
      });

      // Test atomic assignment
      const result = await TransactionHelper.assignDeliveryPerson(
        order,
        deliveryPersonId,
        deliveryTracking
      );

      expect(result.order.deliveryPersonId.toString()).toBe(deliveryPersonId.toString());
      expect(result.order.status).toBe('assigned');
      expect(result.tracking.status).toBe('assigned');
    });

    test('Double assignment should be prevented', async () => {
      const order = new Order({
        customerId: new mongoose.Types.ObjectId(),
        merchantId: new mongoose.Types.ObjectId(),
        items: [{
          serviceId: new mongoose.Types.ObjectId(),
          name: 'Test Service',
          price: 100,
          quantity: 1,
          subtotal: 100
        }],
        subtotal: 100,
        total: 120,
        status: 'ready',
        deliveryPersonId: new mongoose.Types.ObjectId(), // Already assigned
        deliveryInfo: {
          address: {
            street: 'Test Street',
            city: 'Test City',
            coordinates: [-69.9, 18.5]
          }
        }
      });
      await order.save();

      const newDeliveryPersonId = new mongoose.Types.ObjectId();
      const deliveryTracking = new DeliveryTracking({
        orderId: order._id,
        deliveryPersonId: newDeliveryPersonId,
        pickupLocation: {
          coordinates: [-69.9, 18.5],
          address: 'Pickup Address'
        },
        deliveryLocation: {
          coordinates: [-69.8, 18.4],
          address: 'Delivery Address'
        }
      });

      // Should fail due to existing assignment
      await expect(
        TransactionHelper.assignDeliveryPerson(order, newDeliveryPersonId, deliveryTracking)
      ).rejects.toThrow(/already assigned to another delivery person/);
    });
  });

  describe('Data Consistency Fixes', () => {
    test('Status constants should be used consistently', async () => {
      const { ORDER_STATUS, DELIVERY_STATUS } = require('../utils/statusConstants');
      
      // Test order status enum
      const order = new Order({
        customerId: new mongoose.Types.ObjectId(),
        merchantId: new mongoose.Types.ObjectId(),
        items: [{
          serviceId: new mongoose.Types.ObjectId(),
          name: 'Test Service',
          price: 100,
          quantity: 1,
          subtotal: 100
        }],
        subtotal: 100,
        total: 120,
        status: ORDER_STATUS.PENDING,
        deliveryInfo: {
          address: {
            street: 'Test Street',
            city: 'Test City',
            coordinates: [-69.9, 18.5]
          }
        }
      });
      await order.save();

      expect(order.status).toBe('pending');

      // Test delivery status enum
      const delivery = new DeliveryTracking({
        orderId: order._id,
        deliveryPersonId: new mongoose.Types.ObjectId(),
        status: DELIVERY_STATUS.ASSIGNED,
        pickupLocation: {
          coordinates: [-69.9, 18.5],
          address: 'Pickup Address'
        },
        deliveryLocation: {
          coordinates: [-69.8, 18.4],
          address: 'Delivery Address'
        }
      });
      await delivery.save();

      expect(delivery.status).toBe('assigned');
    });
  });
});

module.exports = {
  // Export test utilities for integration tests
  createTestOrder: async () => {
    const order = new Order({
      customerId: new mongoose.Types.ObjectId(),
      merchantId: new mongoose.Types.ObjectId(),
      items: [{
        serviceId: new mongoose.Types.ObjectId(),
        name: 'Test Service',
        price: 100,
        quantity: 1,
        subtotal: 100
      }],
      subtotal: 100,
      total: 120,
      deliveryInfo: {
        address: {
          street: 'Test Street',
          city: 'Test City',
          coordinates: [-69.9, 18.5]
        }
      }
    });
    return await order.save();
  }
};