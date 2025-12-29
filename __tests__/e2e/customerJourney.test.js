const {
  setupTestDatabase,
  cleanupTestDatabase,
  clearCollections,
  createTestUser,
  createTestService,
  createTestOrder,
  authenticateUser,
  apiRequest,
  waitForCondition,
  app
} = require('./testSetup');

const request = require('supertest');

describe('E2E: Customer Journey', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('Complete Customer Order Flow', () => {
    test('Customer can complete full order journey: registration → browsing → ordering → tracking → completion', async () => {
      // Step 1: Customer Registration and Authentication
      const customerAuth = await authenticateUser('customer', {
        name: 'John Customer',
        email: 'john@customer.com'
      });

      expect(customerAuth.user).toBeDefined();
      expect(customerAuth.token).toBeDefined();

      // Step 2: Setup Merchant and Services (for testing)
      const merchantAuth = await authenticateUser('merchant', {
        name: 'Restaurant Owner',
        email: 'owner@restaurant.com'
      });

      // Create a service for the merchant
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Delicious Pizza',
          price: 250,
          description: 'Authentic wood-fired pizza'
        }));

      expect(serviceResponse.status).toBe(201);
      const service = serviceResponse.body;

      // Step 3: Customer Browse Services
      const browseResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ query: 'pizza', location: '-69.9,18.5' });

      expect(browseResponse.status).toBe(200);
      expect(browseResponse.body.results).toHaveLength(1);
      expect(browseResponse.body.results[0].name).toBe('Delicious Pizza');

      // Step 4: Add Items to Cart
      const cartAddResponse = await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: service._id,
          merchantId: merchantAuth.user._id,
          quantity: 2,
          price: 250
        });

      expect(cartAddResponse.status).toBe(200);

      // Verify cart contents
      const cartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(cartResponse.status).toBe(200);
      expect(cartResponse.body.items).toHaveLength(1);
      expect(cartResponse.body.items[0].quantity).toBe(2);
      expect(cartResponse.body.total).toBe(500);

      // Step 5: Checkout Process
      const checkoutData = {
        deliveryInfo: {
          address: {
            street: '123 Customer St',
            city: 'Customer City',
            coordinates: [-69.8, 18.4]
          },
          contactPhone: '+1234567890',
          deliveryInstructions: 'Ring doorbell'
        },
        paymentMethod: 'cash'
      };

      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send(checkoutData);

      expect(checkoutResponse.status).toBe(201);
      expect(checkoutResponse.body.orderNumber).toBeDefined();
      expect(checkoutResponse.body.status).toBe('pending');
      
      const orderId = checkoutResponse.body._id;

      // Verify cart was cleared after checkout
      const clearedCartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(clearedCartResponse.body.items).toHaveLength(0);

      // Step 6: Order Status Tracking
      const orderStatusResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(orderStatusResponse.status).toBe(200);
      expect(orderStatusResponse.body.status).toBe('pending');

      // Step 7: Merchant Confirms Order
      const confirmResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });

      expect(confirmResponse.status).toBe(200);

      // Customer sees updated status
      const updatedStatusResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(updatedStatusResponse.status).toBe(200);
      expect(updatedStatusResponse.body.status).toBe('confirmed');

      // Step 8: Order Preparation
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });

      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      // Step 9: Delivery Assignment (simulated)
      const deliveryAuth = await authenticateUser('delivery', {
        name: 'Delivery Person',
        email: 'delivery@person.com'
      });

      const assignResponse = await apiRequest('post', `/api/delivery/assign`, deliveryAuth.token)
        .send({ orderId });

      expect(assignResponse.status).toBe(200);
      expect(assignResponse.body.deliveryPersonId).toBe(deliveryAuth.user._id);

      // Step 10: Delivery Tracking
      const trackingResponse = await apiRequest('get', `/api/delivery/tracking/${orderId}`, customerAuth.token);
      expect(trackingResponse.status).toBe(200);
      expect(trackingResponse.body.status).toBe('assigned');

      // Step 11: Delivery Progress Updates
      await apiRequest('put', `/api/delivery/${orderId}/status`, deliveryAuth.token)
        .send({ 
          status: 'picked_up',
          currentLocation: [-69.85, 18.45]
        });

      await apiRequest('put', `/api/delivery/${orderId}/status`, deliveryAuth.token)
        .send({ 
          status: 'in_transit',
          currentLocation: [-69.82, 18.42]
        });

      // Step 12: Order Completion
      const completeResponse = await apiRequest('put', `/api/delivery/${orderId}/complete`, deliveryAuth.token)
        .send({
          deliveryLocation: [-69.8, 18.4],
          completionNotes: 'Delivered successfully'
        });

      expect(completeResponse.status).toBe(200);

      // Verify final order status
      const finalOrderResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(finalOrderResponse.status).toBe(200);
      expect(finalOrderResponse.body.status).toBe('delivered');

      // Step 13: Customer Order History
      const historyResponse = await apiRequest('get', '/api/orders/history', customerAuth.token);
      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body).toHaveLength(1);
      expect(historyResponse.body[0]._id).toBe(orderId);
    });

    test('Customer can handle order cancellation', async () => {
      // Setup
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // Add to cart and checkout
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Test St',
              city: 'Test City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Customer cancels order (only allowed when pending/confirmed)
      const cancelResponse = await apiRequest('put', `/api/orders/${orderId}/cancel`, customerAuth.token)
        .send({ reason: 'Changed my mind' });

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.status).toBe('cancelled');

      // Verify cancellation in order history
      const historyResponse = await apiRequest('get', '/api/orders/history', customerAuth.token);
      expect(historyResponse.body[0].status).toBe('cancelled');
    });

    test('Customer experiences proper error handling during checkout', async () => {
      const customerAuth = await authenticateUser('customer');

      // Attempt checkout with empty cart
      const emptyCartCheckout = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Test St',
              city: 'Test City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      expect(emptyCartCheckout.status).toBe(400);
      expect(emptyCartCheckout.body.error).toMatch(/cart is empty/i);

      // Add item to cart
      const merchantAuth = await authenticateUser('merchant');
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      // Attempt checkout with invalid delivery address
      const invalidAddressCheckout = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '',
              city: '',
              coordinates: []
            },
            contactPhone: 'invalid-phone'
          },
          paymentMethod: 'cash'
        });

      expect(invalidAddressCheckout.status).toBe(400);
      expect(invalidAddressCheckout.body.error).toBeDefined();
    });

    test('Customer receives real-time order updates', async () => {
      // This test would require WebSocket testing, simplified here
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Create order (simplified setup)
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Test St',
              city: 'Test City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Simulate status updates and verify customer can retrieve them
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });

      await waitForCondition(async () => {
        const statusResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
        return statusResponse.body.status === 'confirmed';
      });

      const finalStatusResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(finalStatusResponse.body.status).toBe('confirmed');
    });
  });

  describe('Customer Authentication Edge Cases', () => {
    test('Customer handles invalid credentials gracefully', async () => {
      const invalidLoginResponse = await apiRequest('post', '/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      expect(invalidLoginResponse.status).toBe(401);
      expect(invalidLoginResponse.body.error).toMatch(/invalid credentials/i);
    });

    test('Customer cannot access protected routes without authentication', async () => {
      const unauthorizedResponse = await apiRequest('get', '/api/orders/history');
      expect(unauthorizedResponse.status).toBe(401);
    });

    test('Customer token expires and requires re-authentication', async () => {
      // This would require implementing token expiration testing
      // For now, test with invalid token format
      const invalidTokenResponse = await request(app)
        .get('/api/orders/history')
        .set('Authorization', 'Bearer invalid-token');

      expect(invalidTokenResponse.status).toBe(401);
    });
  });

  describe('Customer Cart Management', () => {
    test('Customer can manage cart items properly', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Create multiple services
      const service1Response = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, { name: 'Service 1', price: 100 }));

      const service2Response = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, { name: 'Service 2', price: 150 }));

      // Add items to cart
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: service1Response.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 2,
          price: 100
        });

      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: service2Response.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 150
        });

      // Verify cart contents
      const cartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(cartResponse.body.items).toHaveLength(2);
      expect(cartResponse.body.total).toBe(350); // (100*2) + (150*1)

      // Update item quantity
      await apiRequest('put', '/api/cart/update', customerAuth.token)
        .send({
          serviceId: service1Response.body._id,
          quantity: 1
        });

      const updatedCartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(updatedCartResponse.body.total).toBe(250); // (100*1) + (150*1)

      // Remove item from cart
      await apiRequest('delete', `/api/cart/remove/${service2Response.body._id}`, customerAuth.token);

      const finalCartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(finalCartResponse.body.items).toHaveLength(1);
      expect(finalCartResponse.body.total).toBe(100);
    });
  });
});