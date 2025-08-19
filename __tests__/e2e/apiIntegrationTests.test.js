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

describe('E2E: API and Backend Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('Authentication and Authorization Integration', () => {
    test('Complete authentication flow with token refresh and validation', async () => {
      // User registration
      const userData = createTestUser('customer', {
        name: 'Integration Test User',
        email: 'integration@test.com'
      });

      const registerResponse = await apiRequest('post', '/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.message).toMatch(/user created successfully/i);

      // User login
      const loginResponse = await apiRequest('post', '/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
      expect(loginResponse.body.user).toBeDefined();
      expect(loginResponse.body.user.email).toBe(userData.email);

      const token = loginResponse.body.token;

      // Test protected route access
      const protectedResponse = await apiRequest('get', '/api/auth/profile', token);
      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body.user.email).toBe(userData.email);

      // Test token validation middleware
      const cartResponse = await apiRequest('get', '/api/cart', token);
      expect(cartResponse.status).toBe(200);

      // Test invalid token handling
      const invalidTokenResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token-here');
      expect(invalidTokenResponse.status).toBe(401);

      // Test missing token handling
      const noTokenResponse = await request(app)
        .get('/api/auth/profile');
      expect(noTokenResponse.status).toBe(401);

      // Test token expiration handling (simulate expired token)
      const expiredTokenResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwYzFhNjExZTQ0YjMxMDAyMGI3ZTYxZSIsImlhdCI6MTYyMzM0NjIwMSwiZXhwIjoxNjIzMzQ5ODAxfQ.expired');
      expect(expiredTokenResponse.status).toBe(401);
    });

    test('Role-based access control across user types', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const deliveryAuth = await authenticateUser('delivery');

      // Customer permissions
      const customerCartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(customerCartResponse.status).toBe(200);

      const customerMerchantAccess = await apiRequest('get', '/api/merchant/orders/pending', customerAuth.token);
      expect(customerMerchantAccess.status).toBe(403);

      const customerDeliveryAccess = await apiRequest('get', '/api/delivery/active', customerAuth.token);
      expect(customerDeliveryAccess.status).toBe(403);

      // Merchant permissions
      const merchantServicesResponse = await apiRequest('get', '/api/merchant/services', merchantAuth.token);
      expect(merchantServicesResponse.status).toBe(200);

      const merchantCartAccess = await apiRequest('get', '/api/cart', merchantAuth.token);
      expect(merchantCartAccess.status).toBe(403);

      const merchantDeliveryAccess = await apiRequest('get', '/api/delivery/active', merchantAuth.token);
      expect(merchantDeliveryAccess.status).toBe(403);

      // Delivery person permissions
      const deliveryActiveResponse = await apiRequest('get', '/api/delivery/active', deliveryAuth.token);
      expect(deliveryActiveResponse.status).toBe(200);

      const deliveryCartAccess = await apiRequest('get', '/api/cart', deliveryAuth.token);
      expect(deliveryCartAccess.status).toBe(403);

      const deliveryMerchantAccess = await apiRequest('get', '/api/merchant/services', deliveryAuth.token);
      expect(deliveryMerchantAccess.status).toBe(403);
    });

    test('Cross-origin request handling and CORS', async () => {
      const customerAuth = await authenticateUser('customer');

      // Test CORS headers in response
      const corsResponse = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${customerAuth.token}`)
        .set('Origin', 'http://localhost:3000');

      expect(corsResponse.headers['access-control-allow-origin']).toBeDefined();
      expect(corsResponse.headers['access-control-allow-methods']).toBeDefined();
      expect(corsResponse.headers['access-control-allow-headers']).toBeDefined();

      // Test preflight request
      const preflightResponse = await request(app)
        .options('/api/orders/checkout')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Authorization,Content-Type');

      expect(preflightResponse.status).toBe(200);
      expect(preflightResponse.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('API Response Standardization and Error Handling', () => {
    test('Consistent API response format across all endpoints', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Test successful responses
      const endpoints = [
        { method: 'get', path: '/api/search', auth: customerAuth.token },
        { method: 'get', path: '/api/cart', auth: customerAuth.token },
        { method: 'get', path: '/api/merchant/services', auth: merchantAuth.token },
        { method: 'get', path: '/api/orders/history', auth: customerAuth.token }
      ];

      for (const endpoint of endpoints) {
        const response = await apiRequest(endpoint.method, endpoint.path, endpoint.auth);
        
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/json/);
        
        // Check for consistent response structure
        if (response.body.data !== undefined) {
          expect(response.body).toHaveProperty('data');
        }
        
        // Response should have request tracking
        expect(response.headers['x-request-id']).toBeDefined();
      }
    });

    test('Error responses follow standard format', async () => {
      const customerAuth = await authenticateUser('customer');

      // Test various error scenarios
      const errorTests = [
        {
          request: () => apiRequest('get', '/api/orders/invalid-order-id', customerAuth.token),
          expectedStatus: 400,
          expectedErrorType: 'validation'
        },
        {
          request: () => apiRequest('get', '/api/nonexistent-endpoint', customerAuth.token),
          expectedStatus: 404,
          expectedErrorType: 'not_found'
        },
        {
          request: () => apiRequest('post', '/api/cart/add', customerAuth.token).send({
            // Missing required fields
            quantity: 1
          }),
          expectedStatus: 400,
          expectedErrorType: 'validation'
        },
        {
          request: () => apiRequest('get', '/api/merchant/services', customerAuth.token),
          expectedStatus: 403,
          expectedErrorType: 'authorization'
        }
      ];

      for (const test of errorTests) {
        const response = await test.request();
        
        expect(response.status).toBe(test.expectedStatus);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBeDefined();
        expect(typeof response.body.error).toBe('string');
        
        // Should have timestamp and request ID for debugging
        expect(response.headers['x-request-id']).toBeDefined();
      }
    });

    test('Request validation and sanitization', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Test input sanitization
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: '<script>alert("xss")</script>Safe Service Name',
          description: 'Safe description with <b>HTML</b> tags'
        }));

      expect(serviceResponse.status).toBe(201);
      // HTML should be sanitized or rejected
      expect(serviceResponse.body.name).not.toContain('<script>');

      // Test parameter validation
      const invalidSearchResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({
          query: '', // Empty query
          location: 'invalid-location-format',
          radius: -5 // Negative radius
        });

      expect(invalidSearchResponse.status).toBe(400);
      expect(invalidSearchResponse.body.error).toBeDefined();

      // Test SQL injection prevention
      const injectionAttemptResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({
          query: "'; DROP TABLE users; --",
          location: '-69.9,18.5'
        });

      // Should not cause server error, should sanitize input
      expect(injectionAttemptResponse.status).toBe(200);
    });

    test('Rate limiting and request throttling', async () => {
      const customerAuth = await authenticateUser('customer');

      // Make rapid successive requests
      const rapidRequests = Array.from({ length: 50 }, () =>
        apiRequest('get', '/api/search', customerAuth.token)
          .query({ query: 'test', location: '-69.9,18.5' })
          .catch(error => ({ status: error.response?.status || 500 }))
      );

      const responses = await Promise.all(rapidRequests);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      const successfulResponses = responses.filter(r => r.status === 200);

      console.log(`Rate limiting test: ${successfulResponses.length} successful, ${rateLimitedResponses.length} rate limited`);

      // Should have some rate limiting in effect
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Database Connection and Transaction Management', () => {
    test('Database connection health and recovery', async () => {
      // Test health check endpoint
      const healthResponse = await request(app).get('/api/health');
      
      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body).toHaveProperty('status');
      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body).toHaveProperty('database');
      expect(healthResponse.body.database.status).toBe('connected');
      expect(healthResponse.body).toHaveProperty('timestamp');
    });

    test('Transaction rollback on error maintains data consistency', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Create service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // Add to cart
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      const initialCartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(initialCartResponse.body.items).toHaveLength(1);

      // Attempt checkout with data that will cause transaction failure
      const invalidCheckoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '', // Invalid - will cause validation error
              city: '',
              coordinates: [] // Invalid coordinates
            },
            contactPhone: 'invalid-phone'
          },
          paymentMethod: 'invalid_method'
        });

      expect(invalidCheckoutResponse.status).toBe(400);

      // Verify cart remains unchanged after failed transaction
      const cartAfterFailedCheckoutResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(cartAfterFailedCheckoutResponse.body.items).toHaveLength(1);
      expect(cartAfterFailedCheckoutResponse.body.items[0].quantity).toBe(1);
    });

    test('Connection pooling and concurrent request handling', async () => {
      const numberOfConcurrentUsers = 20;
      
      // Create multiple users simultaneously
      const userCreationPromises = Array.from({ length: numberOfConcurrentUsers }, (_, i) =>
        authenticateUser('customer', { 
          email: `concurrent${i}@test.com`,
          name: `Concurrent User ${i}`
        })
      );

      const userAuths = await Promise.all(userCreationPromises);

      // All users make simultaneous requests
      const concurrentRequestPromises = userAuths.map(async (auth, index) => {
        const startTime = Date.now();
        
        const response = await apiRequest('get', '/api/search', auth.token)
          .query({ 
            query: `search${index}`,
            location: `-69.${90 + index},18.${40 + index}`
          });
        
        const endTime = Date.now();
        
        return {
          index,
          status: response.status,
          responseTime: endTime - startTime,
          success: response.status === 200
        };
      });

      const results = await Promise.all(concurrentRequestPromises);

      // Analyze results
      const successfulRequests = results.filter(r => r.success);
      const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.responseTime));

      console.log(`Concurrent requests: ${successfulRequests.length}/${numberOfConcurrentUsers} successful`);
      console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`Max response time: ${maxResponseTime}ms`);

      // Performance assertions
      expect(successfulRequests.length).toBe(numberOfConcurrentUsers);
      expect(averageResponseTime).toBeLessThan(2000); // Should be under 2 seconds on average
      expect(maxResponseTime).toBeLessThan(5000); // No request should take more than 5 seconds
    });
  });

  describe('External Service Integration', () => {
    test('Location services integration for delivery', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const deliveryAuth = await authenticateUser('delivery');

      // Create order flow
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
              street: '123 Integration Test St',
              city: 'Location City',
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

      // Test location updates during delivery
      const locationUpdates = [
        [-69.85, 18.45],
        [-69.82, 18.42],
        [-69.81, 18.41],
        [-69.8, 18.4]
      ];

      for (const [lng, lat] of locationUpdates) {
        const updateResponse = await apiRequest('put', '/api/delivery/location', deliveryAuth.token)
          .send({
            coordinates: [lng, lat],
            heading: 90,
            speed: 25,
            accuracy: 10
          });

        expect(updateResponse.status).toBe(200);

        // Verify customer can track location
        const trackingResponse = await apiRequest('get', `/api/delivery/tracking/${orderId}`, customerAuth.token);
        expect(trackingResponse.status).toBe(200);
        expect(trackingResponse.body.currentLocation).toBeDefined();
        expect(trackingResponse.body.currentLocation.coordinates).toBeDefined();
      }

      // Test route optimization query
      const routeResponse = await apiRequest('get', '/api/delivery/route', deliveryAuth.token)
        .query({
          from: '-69.9,18.5',
          to: '-69.8,18.4',
          waypoints: '-69.85,18.45'
        });

      expect(routeResponse.status).toBe(200);
      expect(routeResponse.body).toHaveProperty('distance');
      expect(routeResponse.body).toHaveProperty('duration');
      expect(routeResponse.body).toHaveProperty('route');
    });

    test('Push notification integration', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Register device token for notifications
      const deviceTokenResponse = await apiRequest('post', '/api/notifications/register', customerAuth.token)
        .send({
          deviceToken: 'test-device-token-12345',
          platform: 'ios',
          appVersion: '1.0.0'
        });

      expect(deviceTokenResponse.status).toBe(200);

      // Create order to trigger notifications
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
              street: '123 Notification St',
              city: 'Push City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Merchant confirms order (should trigger notification)
      const confirmResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });

      expect(confirmResponse.status).toBe(200);

      // Check notification was queued/sent
      const notificationHistoryResponse = await apiRequest('get', '/api/notifications/history', customerAuth.token);
      expect(notificationHistoryResponse.status).toBe(200);
      expect(notificationHistoryResponse.body.length).toBeGreaterThan(0);

      const latestNotification = notificationHistoryResponse.body[0];
      expect(latestNotification.type).toBe('order_confirmed');
      expect(latestNotification.orderId).toBe(orderId);
    });

    test('Payment service integration mock', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Create order
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      // Test cash payment (no external service needed)
      const cashCheckoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Payment St',
              city: 'Cash City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      expect(cashCheckoutResponse.status).toBe(201);
      expect(cashCheckoutResponse.body.paymentStatus).toBe('pending');

      // Test card payment validation (mock)
      const cardCheckoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Payment St',
              city: 'Card City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'card',
          paymentDetails: {
            cardToken: 'mock-card-token-12345',
            cardLastFour: '1234',
            cardBrand: 'visa'
          }
        });

      expect(cardCheckoutResponse.status).toBe(201);
      expect(cardCheckoutResponse.body.paymentStatus).toBe('processing');
    });
  });

  describe('WebSocket and Real-time Communication', () => {
    test('Order status updates broadcast to relevant parties', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const deliveryAuth = await authenticateUser('delivery');

      // Create order
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
              street: '123 WebSocket St',
              city: 'Realtime City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Test status update propagation
      const statusUpdateResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });

      expect(statusUpdateResponse.status).toBe(200);

      // Wait for real-time update propagation
      await waitForCondition(async () => {
        const customerOrderResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
        return customerOrderResponse.body.status === 'confirmed';
      }, 5000);

      // Verify all parties see the updated status
      const customerOrderResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(customerOrderResponse.body.status).toBe('confirmed');

      const merchantOrderResponse = await apiRequest('get', `/api/orders/${orderId}`, merchantAuth.token);
      expect(merchantOrderResponse.body.status).toBe('confirmed');
    });

    test('Real-time delivery location updates', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const deliveryAuth = await authenticateUser('delivery');

      // Setup order and assignment
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
              street: '123 Tracking St',
              city: 'Location City',
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

      await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId });

      await apiRequest('put', `/api/delivery/${orderId}/pickup`, deliveryAuth.token)
        .send({
          pickupLocation: [-69.9, 18.5],
          pickupTime: new Date().toISOString()
        });

      // Test real-time location updates
      const newLocation = [-69.85, 18.45];
      const locationUpdateResponse = await apiRequest('put', '/api/delivery/location', deliveryAuth.token)
        .send({
          coordinates: newLocation,
          heading: 90,
          speed: 30
        });

      expect(locationUpdateResponse.status).toBe(200);

      // Customer should receive real-time location update
      await waitForCondition(async () => {
        const trackingResponse = await apiRequest('get', `/api/delivery/tracking/${orderId}`, customerAuth.token);
        const currentLocation = trackingResponse.body.currentLocation?.coordinates;
        return currentLocation && 
               Math.abs(currentLocation[0] - newLocation[0]) < 0.001 &&
               Math.abs(currentLocation[1] - newLocation[1]) < 0.001;
      }, 5000);

      const finalTrackingResponse = await apiRequest('get', `/api/delivery/tracking/${orderId}`, customerAuth.token);
      expect(finalTrackingResponse.body.currentLocation.coordinates).toEqual(newLocation);
    });
  });

  describe('Search and Filtering Integration', () => {
    test('Complex search queries with multiple filters', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchant1Auth = await authenticateUser('merchant', { email: 'merchant1@test.com' });
      const merchant2Auth = await authenticateUser('merchant', { email: 'merchant2@test.com' });

      // Create diverse services for testing
      const services = [
        { merchant: merchant1Auth, data: createTestService(merchant1Auth.user._id, { 
          name: 'Pizza Margherita', 
          price: 250, 
          category: 'food',
          tags: ['italian', 'vegetarian', 'pizza']
        })},
        { merchant: merchant1Auth, data: createTestService(merchant1Auth.user._id, { 
          name: 'Burger Deluxe', 
          price: 300, 
          category: 'food',
          tags: ['american', 'meat', 'burger']
        })},
        { merchant: merchant2Auth, data: createTestService(merchant2Auth.user._id, { 
          name: 'Yoga Class', 
          price: 150, 
          category: 'fitness',
          tags: ['wellness', 'exercise', 'beginner']
        })},
        { merchant: merchant2Auth, data: createTestService(merchant2Auth.user._id, { 
          name: 'Phone Repair', 
          price: 500, 
          category: 'electronics',
          tags: ['repair', 'technology', 'mobile']
        })}
      ];

      // Create all services
      for (const service of services) {
        const response = await apiRequest('post', '/api/services', service.merchant.token)
          .send(service.data);
        expect(response.status).toBe(201);
      }

      // Test basic text search
      const pizzaSearchResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          query: 'pizza',
          location: '-69.9,18.5',
          radius: 10
        });

      expect(pizzaSearchResponse.status).toBe(200);
      expect(pizzaSearchResponse.body.results.some(r => r.name.toLowerCase().includes('pizza'))).toBe(true);

      // Test category filter
      const foodSearchResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          category: 'food',
          location: '-69.9,18.5',
          radius: 10
        });

      expect(foodSearchResponse.status).toBe(200);
      expect(foodSearchResponse.body.results.every(r => r.category === 'food')).toBe(true);

      // Test price range filter
      const priceFilterResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          minPrice: 200,
          maxPrice: 400,
          location: '-69.9,18.5',
          radius: 10
        });

      expect(priceFilterResponse.status).toBe(200);
      expect(priceFilterResponse.body.results.every(r => r.price >= 200 && r.price <= 400)).toBe(true);

      // Test combined filters
      const combinedSearchResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          query: 'food',
          category: 'food',
          maxPrice: 300,
          location: '-69.9,18.5',
          radius: 10
        });

      expect(combinedSearchResponse.status).toBe(200);
      const results = combinedSearchResponse.body.results;
      expect(results.every(r => r.category === 'food' && r.price <= 300)).toBe(true);

      // Test location-based search with radius
      const nearbySearchResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          location: '-69.9,18.5',
          radius: 1 // Very small radius
        });

      expect(nearbySearchResponse.status).toBe(200);
      // Results should include distance information
      if (nearbySearchResponse.body.results.length > 0) {
        expect(nearbySearchResponse.body.results[0]).toHaveProperty('distance');
      }
    });

    test('Search result sorting and pagination', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Create multiple services for pagination testing
      const numberOfServices = 25;
      for (let i = 0; i < numberOfServices; i++) {
        const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
          .send(createTestService(merchantAuth.user._id, {
            name: `Test Service ${i.toString().padStart(2, '0')}`,
            price: 100 + (i * 10),
            description: `Description for service number ${i}`
          }));
        expect(serviceResponse.status).toBe(201);
      }

      // Test pagination
      const page1Response = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          query: 'Test Service',
          location: '-69.9,18.5',
          limit: 10,
          offset: 0
        });

      expect(page1Response.status).toBe(200);
      expect(page1Response.body.results).toHaveLength(10);
      expect(page1Response.body.total).toBe(numberOfServices);

      const page2Response = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          query: 'Test Service',
          location: '-69.9,18.5',
          limit: 10,
          offset: 10
        });

      expect(page2Response.status).toBe(200);
      expect(page2Response.body.results).toHaveLength(10);

      // Test sorting by price (ascending)
      const sortByPriceAscResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          query: 'Test Service',
          location: '-69.9,18.5',
          sortBy: 'price',
          sortOrder: 'asc',
          limit: 5
        });

      expect(sortByPriceAscResponse.status).toBe(200);
      const ascResults = sortByPriceAscResponse.body.results;
      for (let i = 1; i < ascResults.length; i++) {
        expect(ascResults[i].price).toBeGreaterThanOrEqual(ascResults[i-1].price);
      }

      // Test sorting by price (descending)
      const sortByPriceDescResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          query: 'Test Service',
          location: '-69.9,18.5',
          sortBy: 'price',
          sortOrder: 'desc',
          limit: 5
        });

      expect(sortByPriceDescResponse.status).toBe(200);
      const descResults = sortByPriceDescResponse.body.results;
      for (let i = 1; i < descResults.length; i++) {
        expect(descResults[i].price).toBeLessThanOrEqual(descResults[i-1].price);
      }
    });
  });
});