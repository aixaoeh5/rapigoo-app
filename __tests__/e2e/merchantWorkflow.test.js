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

describe('E2E: Merchant Workflow', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('Complete Merchant Business Flow', () => {
    test('Merchant can complete full business setup: registration → approval → service management → order fulfillment', async () => {
      // Step 1: Merchant Registration
      const merchantAuth = await authenticateUser('merchant', {
        name: 'Restaurant Owner',
        email: 'owner@restaurant.com',
        businessInfo: {
          businessName: 'Amazing Restaurant',
          businessType: 'restaurant',
          address: {
            street: '123 Business St',
            city: 'Business City',
            coordinates: [-69.9, 18.5]
          },
          operatingHours: {
            monday: { open: '09:00', close: '21:00' },
            tuesday: { open: '09:00', close: '21:00' },
            wednesday: { open: '09:00', close: '21:00' },
            thursday: { open: '09:00', close: '21:00' },
            friday: { open: '09:00', close: '21:00' },
            saturday: { open: '10:00', close: '22:00' },
            sunday: { open: '10:00', close: '20:00' }
          }
        }
      });

      expect(merchantAuth.user).toBeDefined();
      expect(merchantAuth.user.userType).toBe('merchant');
      expect(merchantAuth.user.isApproved).toBe(true); // Auto-approved in test setup

      // Step 2: Create Services
      const service1Response = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Signature Pizza',
          description: 'Our famous wood-fired pizza with premium ingredients',
          price: 350,
          category: 'food',
          estimatedTime: 25,
          availability: true
        }));

      expect(service1Response.status).toBe(201);
      expect(service1Response.body.name).toBe('Signature Pizza');

      const service2Response = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Fresh Salad Bowl',
          description: 'Healthy mix of fresh vegetables and dressing',
          price: 180,
          category: 'food',
          estimatedTime: 15,
          availability: true
        }));

      expect(service2Response.status).toBe(201);

      // Step 3: Manage Service Catalog
      const servicesResponse = await apiRequest('get', '/api/merchant/services', merchantAuth.token);
      expect(servicesResponse.status).toBe(200);
      expect(servicesResponse.body).toHaveLength(2);

      // Update service details
      const updateResponse = await apiRequest('put', `/api/services/${service1Response.body._id}`, merchantAuth.token)
        .send({
          price: 380,
          description: 'Updated: Our premium wood-fired pizza with artisanal ingredients'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.price).toBe(380);

      // Step 4: Handle Customer Orders
      const customerAuth = await authenticateUser('customer', {
        name: 'John Customer',
        email: 'customer@example.com'
      });

      // Customer places order
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: service1Response.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 2,
          price: 380
        });

      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '456 Customer St',
              city: 'Customer City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      expect(checkoutResponse.status).toBe(201);
      const orderId = checkoutResponse.body._id;

      // Step 5: Order Management
      // Merchant views pending orders
      const pendingOrdersResponse = await apiRequest('get', '/api/merchant/orders/pending', merchantAuth.token);
      expect(pendingOrdersResponse.status).toBe(200);
      expect(pendingOrdersResponse.body).toHaveLength(1);
      expect(pendingOrdersResponse.body[0]._id).toBe(orderId);

      // Merchant confirms order
      const confirmResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ 
          status: 'confirmed',
          estimatedPrepTime: 25
        });

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.status).toBe('confirmed');

      // Merchant updates order to preparing
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });

      // Merchant marks order as ready
      const readyResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ 
          status: 'ready',
          readyTime: new Date().toISOString()
        });

      expect(readyResponse.status).toBe(200);
      expect(readyResponse.body.status).toBe('ready');

      // Step 6: Order History and Analytics
      const orderHistoryResponse = await apiRequest('get', '/api/merchant/orders/history', merchantAuth.token);
      expect(orderHistoryResponse.status).toBe(200);
      expect(orderHistoryResponse.body).toHaveLength(1);

      // Step 7: Business Analytics
      const analyticsResponse = await apiRequest('get', '/api/merchant/analytics/summary', merchantAuth.token);
      expect(analyticsResponse.status).toBe(200);
      expect(analyticsResponse.body.totalOrders).toBe(1);
      expect(analyticsResponse.body.totalRevenue).toBe(760); // 380 * 2
    });

    test('Merchant can handle order rejections and modifications', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      // Setup service and order
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

      // Merchant rejects order
      const rejectResponse = await apiRequest('put', `/api/orders/${orderId}/reject`, merchantAuth.token)
        .send({ 
          reason: 'Ingredient not available',
          refundAmount: 100
        });

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.status).toBe('cancelled');
      expect(rejectResponse.body.cancellationReason).toBe('Ingredient not available');
    });

    test('Merchant can manage service availability and operating hours', async () => {
      const merchantAuth = await authenticateUser('merchant');

      // Create service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      const serviceId = serviceResponse.body._id;

      // Toggle service availability
      const unavailableResponse = await apiRequest('put', `/api/services/${serviceId}/availability`, merchantAuth.token)
        .send({ availability: false });

      expect(unavailableResponse.status).toBe(200);
      expect(unavailableResponse.body.availability).toBe(false);

      // Update operating hours
      const hoursResponse = await apiRequest('put', '/api/merchant/operating-hours', merchantAuth.token)
        .send({
          monday: { open: '10:00', close: '20:00' },
          tuesday: { open: '10:00', close: '20:00' },
          wednesday: { open: '10:00', close: '20:00' },
          thursday: { open: '10:00', close: '20:00' },
          friday: { open: '10:00', close: '22:00' },
          saturday: { open: '11:00', close: '23:00' },
          sunday: { open: '11:00', close: '21:00' }
        });

      expect(hoursResponse.status).toBe(200);
    });

    test('Merchant receives real-time order notifications', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      // Setup service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // Customer places order
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

      // Merchant should see new order in pending orders
      await waitForCondition(async () => {
        const pendingResponse = await apiRequest('get', '/api/merchant/orders/pending', merchantAuth.token);
        return pendingResponse.body.length === 1;
      });

      const pendingOrdersResponse = await apiRequest('get', '/api/merchant/orders/pending', merchantAuth.token);
      expect(pendingOrdersResponse.body).toHaveLength(1);
      expect(pendingOrdersResponse.body[0]._id).toBe(checkoutResponse.body._id);
    });
  });

  describe('Merchant Service Management', () => {
    test('Merchant can perform complete CRUD operations on services', async () => {
      const merchantAuth = await authenticateUser('merchant');

      // CREATE
      const createResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Premium Service',
          description: 'High-quality premium service',
          price: 500,
          category: 'premium'
        }));

      expect(createResponse.status).toBe(201);
      const serviceId = createResponse.body._id;

      // READ
      const readResponse = await apiRequest('get', `/api/services/${serviceId}`, merchantAuth.token);
      expect(readResponse.status).toBe(200);
      expect(readResponse.body.name).toBe('Premium Service');

      // UPDATE
      const updateResponse = await apiRequest('put', `/api/services/${serviceId}`, merchantAuth.token)
        .send({
          name: 'Updated Premium Service',
          price: 550,
          description: 'Updated high-quality premium service'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.name).toBe('Updated Premium Service');
      expect(updateResponse.body.price).toBe(550);

      // DELETE
      const deleteResponse = await apiRequest('delete', `/api/services/${serviceId}`, merchantAuth.token);
      expect(deleteResponse.status).toBe(200);

      // Verify deletion
      const verifyDeleteResponse = await apiRequest('get', `/api/services/${serviceId}`, merchantAuth.token);
      expect(verifyDeleteResponse.status).toBe(404);
    });

    test('Merchant cannot modify services of other merchants', async () => {
      const merchant1Auth = await authenticateUser('merchant', { email: 'merchant1@test.com' });
      const merchant2Auth = await authenticateUser('merchant', { email: 'merchant2@test.com' });

      // Merchant 1 creates service
      const serviceResponse = await apiRequest('post', '/api/services', merchant1Auth.token)
        .send(createTestService(merchant1Auth.user._id));

      const serviceId = serviceResponse.body._id;

      // Merchant 2 tries to update Merchant 1's service
      const unauthorizedUpdateResponse = await apiRequest('put', `/api/services/${serviceId}`, merchant2Auth.token)
        .send({ price: 999 });

      expect(unauthorizedUpdateResponse.status).toBe(403);

      // Merchant 2 tries to delete Merchant 1's service
      const unauthorizedDeleteResponse = await apiRequest('delete', `/api/services/${serviceId}`, merchant2Auth.token);
      expect(unauthorizedDeleteResponse.status).toBe(403);
    });
  });

  describe('Merchant Order Processing Edge Cases', () => {
    test('Merchant handles concurrent order status updates correctly', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      // Setup order
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

      // First update should succeed
      const firstUpdateResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });

      expect(firstUpdateResponse.status).toBe(200);

      // Sequential update should work
      const secondUpdateResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });

      expect(secondUpdateResponse.status).toBe(200);
    });

    test('Merchant cannot update orders from other merchants', async () => {
      const merchant1Auth = await authenticateUser('merchant', { email: 'merchant1@test.com' });
      const merchant2Auth = await authenticateUser('merchant', { email: 'merchant2@test.com' });
      const customerAuth = await authenticateUser('customer');

      // Merchant 1's service and order
      const serviceResponse = await apiRequest('post', '/api/services', merchant1Auth.token)
        .send(createTestService(merchant1Auth.user._id));

      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchant1Auth.user._id,
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

      // Merchant 2 tries to update Merchant 1's order
      const unauthorizedResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchant2Auth.token)
        .send({ status: 'confirmed' });

      expect(unauthorizedResponse.status).toBe(403);
    });

    test('Merchant handles invalid status transitions gracefully', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      // Setup order
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

      // Try invalid status transition (pending -> delivered)
      const invalidTransitionResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'delivered' });

      expect(invalidTransitionResponse.status).toBe(400);
      expect(invalidTransitionResponse.body.error).toMatch(/invalid status transition/i);
    });
  });

  describe('Merchant Profile and Settings', () => {
    test('Merchant can update business profile information', async () => {
      const merchantAuth = await authenticateUser('merchant');

      const updateProfileResponse = await apiRequest('put', '/api/merchant/profile', merchantAuth.token)
        .send({
          businessInfo: {
            businessName: 'Updated Restaurant Name',
            businessType: 'fast_food',
            description: 'We serve the best fast food in town',
            phone: '+1987654321',
            address: {
              street: '456 Updated St',
              city: 'Updated City',
              coordinates: [-69.85, 18.45]
            }
          }
        });

      expect(updateProfileResponse.status).toBe(200);
      expect(updateProfileResponse.body.businessInfo.businessName).toBe('Updated Restaurant Name');

      // Verify update persisted
      const profileResponse = await apiRequest('get', '/api/merchant/profile', merchantAuth.token);
      expect(profileResponse.body.businessInfo.businessName).toBe('Updated Restaurant Name');
    });
  });
});