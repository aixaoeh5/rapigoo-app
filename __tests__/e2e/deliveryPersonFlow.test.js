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
  sleep,
  app
} = require('./testSetup');

const request = require('supertest');

describe('E2E: Delivery Person Flow', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('Complete Delivery Person Workflow', () => {
    test('Delivery person can complete full delivery cycle: registration → assignment → pickup → delivery → completion', async () => {
      // Step 1: Setup delivery person
      const deliveryAuth = await authenticateUser('delivery', {
        name: 'Delivery Driver',
        email: 'driver@delivery.com',
        deliveryInfo: {
          vehicleType: 'motorcycle',
          licensePlate: 'ABC123',
          availability: true,
          currentLocation: {
            coordinates: [-69.9, 18.5]
          }
        }
      });

      expect(deliveryAuth.user.userType).toBe('delivery');
      expect(deliveryAuth.user.isApproved).toBe(true);

      // Step 2: Setup merchant and customer for order creation
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Test Food Item',
          price: 200
        }));

      // Customer creates order
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 200
        });

      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Delivery St',
              city: 'Delivery City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Merchant confirms and prepares order
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });

      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });

      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      // Step 3: Delivery person views available deliveries
      const availableDeliveriesResponse = await apiRequest('get', '/api/delivery/available', deliveryAuth.token)
        .query({ 
          latitude: -69.9, 
          longitude: 18.5, 
          radius: 10 
        });

      expect(availableDeliveriesResponse.status).toBe(200);
      expect(availableDeliveriesResponse.body).toHaveLength(1);
      expect(availableDeliveriesResponse.body[0].orderId).toBe(orderId);

      // Step 4: Delivery person accepts assignment
      const assignResponse = await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId });

      expect(assignResponse.status).toBe(200);
      expect(assignResponse.body.deliveryPersonId).toBe(deliveryAuth.user._id);
      expect(assignResponse.body.status).toBe('assigned');

      // Step 5: Delivery person views active deliveries
      const activeDeliveriesResponse = await apiRequest('get', '/api/delivery/active', deliveryAuth.token);
      expect(activeDeliveriesResponse.status).toBe(200);
      expect(activeDeliveriesResponse.body).toHaveLength(1);
      expect(activeDeliveriesResponse.body[0].orderId).toBe(orderId);

      // Step 6: Delivery person updates location while en route to pickup
      const updateLocationResponse = await apiRequest('put', '/api/delivery/location', deliveryAuth.token)
        .send({
          coordinates: [-69.92, 18.52],
          heading: 45,
          speed: 25
        });

      expect(updateLocationResponse.status).toBe(200);

      // Step 7: Delivery person arrives at merchant and picks up order
      const pickupResponse = await apiRequest('put', `/api/delivery/${orderId}/pickup`, deliveryAuth.token)
        .send({
          pickupLocation: [-69.9, 18.5],
          pickupTime: new Date().toISOString(),
          verificationCode: '1234'
        });

      expect(pickupResponse.status).toBe(200);
      expect(pickupResponse.body.status).toBe('picked_up');

      // Step 8: Delivery person updates status to in transit
      const transitResponse = await apiRequest('put', `/api/delivery/${orderId}/status`, deliveryAuth.token)
        .send({
          status: 'in_transit',
          currentLocation: [-69.85, 18.45],
          estimatedArrival: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
        });

      expect(transitResponse.status).toBe(200);
      expect(transitResponse.body.status).toBe('in_transit');

      // Step 9: Delivery person provides location updates during transit
      await apiRequest('put', '/api/delivery/location', deliveryAuth.token)
        .send({
          coordinates: [-69.82, 18.42],
          heading: 90,
          speed: 30
        });

      await sleep(100); // Small delay for realistic timing

      await apiRequest('put', '/api/delivery/location', deliveryAuth.token)
        .send({
          coordinates: [-69.81, 18.41],
          heading: 90,
          speed: 20
        });

      // Step 10: Delivery person completes delivery
      const completeResponse = await apiRequest('put', `/api/delivery/${orderId}/complete`, deliveryAuth.token)
        .send({
          deliveryLocation: [-69.8, 18.4],
          completionTime: new Date().toISOString(),
          completionNotes: 'Delivered to customer at front door',
          customerSignature: 'base64_signature_data',
          deliveryPhoto: 'base64_photo_data'
        });

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.status).toBe('delivered');

      // Step 11: Verify order is marked as delivered
      const finalOrderResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(finalOrderResponse.body.status).toBe('delivered');

      // Step 12: Delivery person views delivery history
      const historyResponse = await apiRequest('get', '/api/delivery/history', deliveryAuth.token);
      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body).toHaveLength(1);
      expect(historyResponse.body[0].orderId).toBe(orderId);
      expect(historyResponse.body[0].status).toBe('delivered');

      // Step 13: Check delivery earnings
      const earningsResponse = await apiRequest('get', '/api/delivery/earnings', deliveryAuth.token)
        .query({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

      expect(earningsResponse.status).toBe(200);
      expect(earningsResponse.body.totalEarnings).toBeGreaterThan(0);
      expect(earningsResponse.body.completedDeliveries).toBe(1);
    });

    test('Delivery person can handle multiple concurrent deliveries', async () => {
      const deliveryAuth = await authenticateUser('delivery');
      const merchantAuth = await authenticateUser('merchant');
      const customer1Auth = await authenticateUser('customer', { email: 'customer1@test.com' });
      const customer2Auth = await authenticateUser('customer', { email: 'customer2@test.com' });

      // Create services and orders
      const service1Response = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, { name: 'Service 1' }));

      const service2Response = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, { name: 'Service 2' }));

      // Customer 1 order
      await apiRequest('post', '/api/cart/add', customer1Auth.token)
        .send({
          serviceId: service1Response.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      const order1Response = await apiRequest('post', '/api/orders/checkout', customer1Auth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Customer1 St',
              city: 'City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1111111111'
          },
          paymentMethod: 'cash'
        });

      // Customer 2 order
      await apiRequest('post', '/api/cart/add', customer2Auth.token)
        .send({
          serviceId: service2Response.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      const order2Response = await apiRequest('post', '/api/orders/checkout', customer2Auth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '456 Customer2 St',
              city: 'City',
              coordinates: [-69.82, 18.42]
            },
            contactPhone: '+2222222222'
          },
          paymentMethod: 'cash'
        });

      // Merchant prepares both orders
      for (const orderId of [order1Response.body._id, order2Response.body._id]) {
        await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
          .send({ status: 'confirmed' });
        await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
          .send({ status: 'preparing' });
        await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
          .send({ status: 'ready' });
      }

      // Delivery person assigns both orders
      await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId: order1Response.body._id });

      await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId: order2Response.body._id });

      // Check active deliveries
      const activeResponse = await apiRequest('get', '/api/delivery/active', deliveryAuth.token);
      expect(activeResponse.status).toBe(200);
      expect(activeResponse.body).toHaveLength(2);

      // Pick up both orders
      await apiRequest('put', `/api/delivery/${order1Response.body._id}/pickup`, deliveryAuth.token)
        .send({
          pickupLocation: [-69.9, 18.5],
          pickupTime: new Date().toISOString()
        });

      await apiRequest('put', `/api/delivery/${order2Response.body._id}/pickup`, deliveryAuth.token)
        .send({
          pickupLocation: [-69.9, 18.5],
          pickupTime: new Date().toISOString()
        });

      // Complete both deliveries
      await apiRequest('put', `/api/delivery/${order1Response.body._id}/complete`, deliveryAuth.token)
        .send({
          deliveryLocation: [-69.8, 18.4],
          completionTime: new Date().toISOString()
        });

      await apiRequest('put', `/api/delivery/${order2Response.body._id}/complete`, deliveryAuth.token)
        .send({
          deliveryLocation: [-69.82, 18.42],
          completionTime: new Date().toISOString()
        });

      // Verify both deliveries completed
      const historyResponse = await apiRequest('get', '/api/delivery/history', deliveryAuth.token);
      expect(historyResponse.body).toHaveLength(2);
    });

    test('Delivery person can handle delivery issues and cancellations', async () => {
      const deliveryAuth = await authenticateUser('delivery');
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

      // Prepare order
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      // Assign delivery
      await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId });

      // Report delivery issue
      const issueResponse = await apiRequest('post', `/api/delivery/${orderId}/issue`, deliveryAuth.token)
        .send({
          issueType: 'customer_not_available',
          description: 'Customer not answering phone or door',
          attemptsMade: 2,
          currentLocation: [-69.8, 18.4]
        });

      expect(issueResponse.status).toBe(200);
      expect(issueResponse.body.issue).toBeDefined();

      // Retry delivery after issue resolution
      const retryResponse = await apiRequest('put', `/api/delivery/${orderId}/retry`, deliveryAuth.token)
        .send({
          retryReason: 'Customer called back, will be available now',
          estimatedArrival: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        });

      expect(retryResponse.status).toBe(200);

      // Complete delivery after retry
      const completeResponse = await apiRequest('put', `/api/delivery/${orderId}/complete`, deliveryAuth.token)
        .send({
          deliveryLocation: [-69.8, 18.4],
          completionTime: new Date().toISOString(),
          completionNotes: 'Successfully delivered on second attempt'
        });

      expect(completeResponse.status).toBe(200);
    });
  });

  describe('Delivery Person Location and Availability Management', () => {
    test('Delivery person can manage availability status', async () => {
      const deliveryAuth = await authenticateUser('delivery');

      // Set unavailable
      const unavailableResponse = await apiRequest('put', '/api/delivery/availability', deliveryAuth.token)
        .send({ 
          availability: false,
          reason: 'Taking a break'
        });

      expect(unavailableResponse.status).toBe(200);
      expect(unavailableResponse.body.availability).toBe(false);

      // Verify no available deliveries are shown when unavailable
      const availableResponse = await apiRequest('get', '/api/delivery/available', deliveryAuth.token);
      expect(availableResponse.status).toBe(200);
      expect(availableResponse.body).toHaveLength(0);

      // Set available again
      const availableAgainResponse = await apiRequest('put', '/api/delivery/availability', deliveryAuth.token)
        .send({ 
          availability: true,
          currentLocation: [-69.9, 18.5]
        });

      expect(availableAgainResponse.status).toBe(200);
      expect(availableAgainResponse.body.availability).toBe(true);
    });

    test('Delivery person receives location-based delivery suggestions', async () => {
      const deliveryAuth = await authenticateUser('delivery');
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      // Update delivery person location
      await apiRequest('put', '/api/delivery/location', deliveryAuth.token)
        .send({
          coordinates: [-69.9, 18.5]
        });

      // Create orders at different distances
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // Close order
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      const closeOrderResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Close St',
              city: 'City',
              coordinates: [-69.91, 18.51] // Very close
            },
            contactPhone: '+1111111111'
          },
          paymentMethod: 'cash'
        });

      // Prepare order
      await apiRequest('put', `/api/orders/${closeOrderResponse.body._id}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });
      await apiRequest('put', `/api/orders/${closeOrderResponse.body._id}/status`, merchantAuth.token)
        .send({ status: 'preparing' });
      await apiRequest('put', `/api/orders/${closeOrderResponse.body._id}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      // Get suggestions (should prioritize closer orders)
      const suggestionsResponse = await apiRequest('get', '/api/delivery/suggestions', deliveryAuth.token);
      expect(suggestionsResponse.status).toBe(200);
      expect(suggestionsResponse.body.length).toBeGreaterThan(0);
      expect(suggestionsResponse.body[0].distance).toBeDefined();
    });
  });

  describe('Delivery Person Edge Cases and Error Handling', () => {
    test('Delivery person cannot assign already assigned orders', async () => {
      const delivery1Auth = await authenticateUser('delivery', { email: 'delivery1@test.com' });
      const delivery2Auth = await authenticateUser('delivery', { email: 'delivery2@test.com' });
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

      // Prepare order
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      // First delivery person assigns
      const firstAssignResponse = await apiRequest('post', '/api/delivery/assign', delivery1Auth.token)
        .send({ orderId });

      expect(firstAssignResponse.status).toBe(200);

      // Second delivery person tries to assign same order
      const secondAssignResponse = await apiRequest('post', '/api/delivery/assign', delivery2Auth.token)
        .send({ orderId });

      expect(secondAssignResponse.status).toBe(409);
      expect(secondAssignResponse.body.error).toMatch(/already assigned/i);
    });

    test('Delivery person handles network connectivity issues gracefully', async () => {
      const deliveryAuth = await authenticateUser('delivery');

      // Test with invalid order ID (simulating network/sync issues)
      const invalidAssignResponse = await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId: '60b5d5f6c8e4a5d5f6c8e4a5' });

      expect(invalidAssignResponse.status).toBe(404);

      // Test location update with invalid coordinates
      const invalidLocationResponse = await apiRequest('put', '/api/delivery/location', deliveryAuth.token)
        .send({
          coordinates: [1000, 1000] // Invalid coordinates
        });

      expect(invalidLocationResponse.status).toBe(400);
    });

    test('Delivery person cannot modify deliveries of other drivers', async () => {
      const delivery1Auth = await authenticateUser('delivery', { email: 'delivery1@test.com' });
      const delivery2Auth = await authenticateUser('delivery', { email: 'delivery2@test.com' });
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      // Setup and assign order to delivery person 1
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

      // Prepare and assign order
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      await apiRequest('post', '/api/delivery/assign', delivery1Auth.token)
        .send({ orderId });

      // Delivery person 2 tries to update delivery person 1's order
      const unauthorizedUpdateResponse = await apiRequest('put', `/api/delivery/${orderId}/status`, delivery2Auth.token)
        .send({ status: 'picked_up' });

      expect(unauthorizedUpdateResponse.status).toBe(403);

      const unauthorizedCompleteResponse = await apiRequest('put', `/api/delivery/${orderId}/complete`, delivery2Auth.token)
        .send({
          deliveryLocation: [-69.8, 18.4],
          completionTime: new Date().toISOString()
        });

      expect(unauthorizedCompleteResponse.status).toBe(403);
    });
  });

  describe('Delivery Analytics and Performance', () => {
    test('Delivery person can view performance analytics', async () => {
      const deliveryAuth = await authenticateUser('delivery');

      // Get performance metrics
      const performanceResponse = await apiRequest('get', '/api/delivery/performance', deliveryAuth.token)
        .query({
          period: 'week'
        });

      expect(performanceResponse.status).toBe(200);
      expect(performanceResponse.body).toHaveProperty('completedDeliveries');
      expect(performanceResponse.body).toHaveProperty('averageDeliveryTime');
      expect(performanceResponse.body).toHaveProperty('totalEarnings');
      expect(performanceResponse.body).toHaveProperty('customerRating');
    });

    test('Delivery person can view detailed delivery history', async () => {
      const deliveryAuth = await authenticateUser('delivery');

      const historyResponse = await apiRequest('get', '/api/delivery/history', deliveryAuth.token)
        .query({
          limit: 10,
          offset: 0,
          status: 'delivered'
        });

      expect(historyResponse.status).toBe(200);
      expect(Array.isArray(historyResponse.body)).toBe(true);
    });
  });
});