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

describe('E2E: Cross-User Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('Multi-User Order Flow Integration', () => {
    test('Complete order flow with all user types: Customer → Merchant → Delivery → Completion', async () => {
      // Setup all user types
      const customerAuth = await authenticateUser('customer', {
        name: 'John Customer',
        email: 'customer@test.com'
      });

      const merchantAuth = await authenticateUser('merchant', {
        name: 'Restaurant Owner',
        email: 'merchant@test.com',
        businessInfo: {
          businessName: 'Test Restaurant',
          businessType: 'restaurant',
          address: {
            street: '123 Merchant St',
            city: 'Business District',
            coordinates: [-69.9, 18.5]
          }
        }
      });

      const deliveryAuth = await authenticateUser('delivery', {
        name: 'Delivery Driver',
        email: 'delivery@test.com',
        deliveryInfo: {
          vehicleType: 'motorcycle',
          licensePlate: 'ABC123',
          availability: true,
          currentLocation: {
            coordinates: [-69.92, 18.52]
          }
        }
      });

      // Merchant creates services
      const service1Response = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Grilled Chicken',
          price: 250,
          description: 'Juicy grilled chicken with herbs',
          estimatedTime: 20
        }));

      const service2Response = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Caesar Salad',
          price: 150,
          description: 'Fresh caesar salad with croutons',
          estimatedTime: 10
        }));

      expect(service1Response.status).toBe(201);
      expect(service2Response.status).toBe(201);

      // Customer discovers services
      const searchResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ 
          query: 'chicken',
          location: '-69.8,18.4',
          radius: 10
        });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.results.length).toBeGreaterThan(0);

      // Customer adds items to cart
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: service1Response.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 250
        });

      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: service2Response.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 150
        });

      // Customer places order
      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '456 Customer Ave',
              city: 'Residential Area',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890',
            deliveryInstructions: 'Ring doorbell twice'
          },
          paymentMethod: 'cash'
        });

      expect(checkoutResponse.status).toBe(201);
      const orderId = checkoutResponse.body._id;

      // Merchant receives order notification
      const pendingOrdersResponse = await apiRequest('get', '/api/merchant/orders/pending', merchantAuth.token);
      expect(pendingOrdersResponse.status).toBe(200);
      expect(pendingOrdersResponse.body).toHaveLength(1);
      expect(pendingOrdersResponse.body[0]._id).toBe(orderId);

      // Merchant confirms order
      const confirmResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ 
          status: 'confirmed',
          estimatedPrepTime: 25,
          merchantNotes: 'Order confirmed, starting preparation'
        });

      expect(confirmResponse.status).toBe(200);

      // Customer receives confirmation
      const orderStatusResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(orderStatusResponse.body.status).toBe('confirmed');

      // Merchant updates to preparing
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });

      // Merchant marks as ready
      const readyResponse = await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ 
          status: 'ready',
          readyTime: new Date().toISOString(),
          merchantNotes: 'Order ready for pickup'
        });

      expect(readyResponse.status).toBe(200);

      // Delivery person sees available delivery
      const availableDeliveriesResponse = await apiRequest('get', '/api/delivery/available', deliveryAuth.token)
        .query({ 
          latitude: -69.92, 
          longitude: 18.52, 
          radius: 5 
        });

      expect(availableDeliveriesResponse.status).toBe(200);
      expect(availableDeliveriesResponse.body).toHaveLength(1);

      // Delivery person accepts assignment
      const assignResponse = await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId });

      expect(assignResponse.status).toBe(200);

      // All parties can see updated status
      const orderAfterAssignmentResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(orderAfterAssignmentResponse.body.status).toBe('assigned');
      expect(orderAfterAssignmentResponse.body.deliveryPersonId).toBe(deliveryAuth.user._id);

      // Delivery person picks up order
      await apiRequest('put', `/api/delivery/${orderId}/pickup`, deliveryAuth.token)
        .send({
          pickupLocation: [-69.9, 18.5],
          pickupTime: new Date().toISOString(),
          verificationCode: '1234'
        });

      // Delivery person provides location updates
      await apiRequest('put', '/api/delivery/location', deliveryAuth.token)
        .send({
          coordinates: [-69.88, 18.48],
          heading: 90,
          speed: 25
        });

      await apiRequest('put', `/api/delivery/${orderId}/status`, deliveryAuth.token)
        .send({
          status: 'in_transit',
          currentLocation: [-69.88, 18.48],
          estimatedArrival: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        });

      // Customer can track delivery
      const trackingResponse = await apiRequest('get', `/api/delivery/tracking/${orderId}`, customerAuth.token);
      expect(trackingResponse.status).toBe(200);
      expect(trackingResponse.body.status).toBe('in_transit');

      // Delivery person completes delivery
      const completeResponse = await apiRequest('put', `/api/delivery/${orderId}/complete`, deliveryAuth.token)
        .send({
          deliveryLocation: [-69.8, 18.4],
          completionTime: new Date().toISOString(),
          completionNotes: 'Delivered successfully to customer',
          customerSignature: 'digital_signature_data'
        });

      expect(completeResponse.status).toBe(200);

      // Verify final status for all parties
      const finalOrderResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(finalOrderResponse.body.status).toBe('delivered');

      const merchantFinalResponse = await apiRequest('get', `/api/orders/${orderId}`, merchantAuth.token);
      expect(merchantFinalResponse.body.status).toBe('delivered');

      const deliveryFinalResponse = await apiRequest('get', `/api/delivery/tracking/${orderId}`, deliveryAuth.token);
      expect(deliveryFinalResponse.body.status).toBe('delivered');
    });

    test('Multiple customers ordering from same merchant simultaneously', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customer1Auth = await authenticateUser('customer', { email: 'customer1@test.com' });
      const customer2Auth = await authenticateUser('customer', { email: 'customer2@test.com' });
      const customer3Auth = await authenticateUser('customer', { email: 'customer3@test.com' });

      // Merchant creates service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Popular Dish',
          price: 200
        }));

      // All customers add to cart and checkout simultaneously
      const orderPromises = [customer1Auth, customer2Auth, customer3Auth].map(async (customerAuth, index) => {
        await apiRequest('post', '/api/cart/add', customerAuth.token)
          .send({
            serviceId: serviceResponse.body._id,
            merchantId: merchantAuth.user._id,
            quantity: 1,
            price: 200
          });

        return await apiRequest('post', '/api/orders/checkout', customerAuth.token)
          .send({
            deliveryInfo: {
              address: {
                street: `${index + 1}00 Customer St`,
                city: 'City',
                coordinates: [-69.8 - (index * 0.01), 18.4 + (index * 0.01)]
              },
              contactPhone: `+123456${index}890`
            },
            paymentMethod: 'cash'
          });
      });

      const orderResponses = await Promise.all(orderPromises);
      
      // All orders should be created successfully
      orderResponses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body._id).toBeDefined();
      });

      // Merchant should see all pending orders
      const pendingOrdersResponse = await apiRequest('get', '/api/merchant/orders/pending', merchantAuth.token);
      expect(pendingOrdersResponse.status).toBe(200);
      expect(pendingOrdersResponse.body).toHaveLength(3);

      // Merchant processes orders in sequence
      for (const orderResponse of orderResponses) {
        const orderId = orderResponse.body._id;
        
        await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
          .send({ status: 'confirmed' });
        
        await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
          .send({ status: 'preparing' });
        
        await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
          .send({ status: 'ready' });
      }

      // Verify all orders are ready
      const readyOrdersResponse = await apiRequest('get', '/api/merchant/orders/ready', merchantAuth.token);
      expect(readyOrdersResponse.status).toBe(200);
      expect(readyOrdersResponse.body).toHaveLength(3);
    });

    test('Multiple delivery persons competing for available orders', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');
      const delivery1Auth = await authenticateUser('delivery', { email: 'delivery1@test.com' });
      const delivery2Auth = await authenticateUser('delivery', { email: 'delivery2@test.com' });

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

      // Both delivery persons try to assign simultaneously
      const assignPromises = [
        apiRequest('post', '/api/delivery/assign', delivery1Auth.token).send({ orderId }),
        apiRequest('post', '/api/delivery/assign', delivery2Auth.token).send({ orderId })
      ];

      const assignResponses = await Promise.all(assignPromises);

      // One should succeed, one should fail
      const successfulAssignments = assignResponses.filter(r => r.status === 200);
      const failedAssignments = assignResponses.filter(r => r.status === 409);

      expect(successfulAssignments).toHaveLength(1);
      expect(failedAssignments).toHaveLength(1);

      // Verify only one delivery person got the assignment
      const orderAfterAssignmentResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(orderAfterAssignmentResponse.body.deliveryPersonId).toBeDefined();
    });
  });

  describe('Real-time Communication Integration', () => {
    test('Cross-user real-time status updates', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const deliveryAuth = await authenticateUser('delivery');

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

      // Test status update propagation
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });

      // Customer should see updated status immediately
      await waitForCondition(async () => {
        const response = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
        return response.body.status === 'confirmed';
      });

      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });

      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      // Delivery assignment should be visible to all parties
      await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId });

      await waitForCondition(async () => {
        const customerResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
        const merchantResponse = await apiRequest('get', `/api/orders/${orderId}`, merchantAuth.token);
        
        return customerResponse.body.status === 'assigned' && 
               merchantResponse.body.status === 'assigned';
      });
    });

    test('Delivery location updates visible to customer', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const deliveryAuth = await authenticateUser('delivery');

      // Setup and assign order
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

      // Delivery person updates location multiple times
      const locations = [
        [-69.88, 18.48],
        [-69.85, 18.45],
        [-69.82, 18.42],
        [-69.8, 18.4]
      ];

      for (const [lng, lat] of locations) {
        await apiRequest('put', '/api/delivery/location', deliveryAuth.token)
          .send({
            coordinates: [lng, lat],
            heading: 90,
            speed: 25
          });

        await sleep(100); // Small delay between updates

        // Customer should be able to see current location
        const trackingResponse = await apiRequest('get', `/api/delivery/tracking/${orderId}`, customerAuth.token);
        expect(trackingResponse.status).toBe(200);
        expect(trackingResponse.body.currentLocation).toBeDefined();
      }
    });
  });

  describe('Error Handling and Recovery Across Users', () => {
    test('Order cancellation affects all involved parties', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const deliveryAuth = await authenticateUser('delivery');

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

      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });

      // Customer cancels order
      const cancelResponse = await apiRequest('put', `/api/orders/${orderId}/cancel`, customerAuth.token)
        .send({ reason: 'Changed my mind' });

      expect(cancelResponse.status).toBe(200);

      // All parties should see cancelled status
      const customerOrderResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(customerOrderResponse.body.status).toBe('cancelled');

      const merchantOrderResponse = await apiRequest('get', `/api/orders/${orderId}`, merchantAuth.token);
      expect(merchantOrderResponse.body.status).toBe('cancelled');

      // Order should not appear in delivery person's available orders
      const availableDeliveriesResponse = await apiRequest('get', '/api/delivery/available', deliveryAuth.token);
      const availableOrderIds = availableDeliveriesResponse.body.map(d => d.orderId);
      expect(availableOrderIds).not.toContain(orderId);
    });

    test('Delivery person unavailability during active delivery', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const delivery1Auth = await authenticateUser('delivery', { email: 'delivery1@test.com' });
      const delivery2Auth = await authenticateUser('delivery', { email: 'delivery2@test.com' });

      // Setup and assign order
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

      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      await apiRequest('post', '/api/delivery/assign', delivery1Auth.token)
        .send({ orderId });

      // Delivery person 1 reports issue and becomes unavailable
      await apiRequest('post', `/api/delivery/${orderId}/issue`, delivery1Auth.token)
        .send({
          issueType: 'vehicle_breakdown',
          description: 'Motorcycle breakdown, cannot continue delivery',
          requiresReassignment: true
        });

      // System should allow reassignment to delivery person 2
      const reassignResponse = await apiRequest('post', '/api/delivery/reassign', delivery2Auth.token)
        .send({ orderId });

      expect(reassignResponse.status).toBe(200);

      // Verify order is now assigned to delivery person 2
      const orderAfterReassignResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(orderAfterReassignResponse.body.deliveryPersonId).toBe(delivery2Auth.user._id);
    });
  });

  describe('Data Consistency Across User Actions', () => {
    test('Inventory management affects customer cart and ordering', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customer1Auth = await authenticateUser('customer', { email: 'customer1@test.com' });
      const customer2Auth = await authenticateUser('customer', { email: 'customer2@test.com' });

      // Merchant creates limited inventory service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Limited Item',
          price: 100,
          availability: true,
          inventory: 1
        }));

      const serviceId = serviceResponse.body._id;

      // Customer 1 adds to cart
      await apiRequest('post', '/api/cart/add', customer1Auth.token)
        .send({
          serviceId,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      // Merchant makes service unavailable
      await apiRequest('put', `/api/services/${serviceId}/availability`, merchantAuth.token)
        .send({ availability: false });

      // Customer 1 should still be able to checkout (item was already in cart)
      const customer1CheckoutResponse = await apiRequest('post', '/api/orders/checkout', customer1Auth.token)
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

      expect(customer1CheckoutResponse.status).toBe(201);

      // Customer 2 should not be able to add unavailable item to cart
      const customer2AddResponse = await apiRequest('post', '/api/cart/add', customer2Auth.token)
        .send({
          serviceId,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      expect(customer2AddResponse.status).toBe(400);
      expect(customer2AddResponse.body.error).toMatch(/not available/i);
    });

    test('Merchant business hours affect service availability for customers', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      // Create service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // Merchant updates operating hours to closed
      const currentDate = new Date();
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()];
      
      const closedHours = {
        [dayOfWeek]: { open: '00:00', close: '00:00' } // Closed today
      };

      await apiRequest('put', '/api/merchant/operating-hours', merchantAuth.token)
        .send(closedHours);

      // Customer search should indicate merchant is closed
      const searchResponse = await apiRequest('get', '/api/search', customerAuth.token)
        .query({ merchantId: merchantAuth.user._id });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body.merchant.isOpen).toBe(false);

      // Customer should not be able to add items when merchant is closed
      const addToCartResponse = await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      expect(addToCartResponse.status).toBe(400);
      expect(addToCartResponse.body.error).toMatch(/merchant is closed/i);
    });
  });

  describe('Performance Under Multi-User Load', () => {
    test('System handles concurrent orders from multiple customers', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const numberOfCustomers = 5;
      
      // Create multiple customers
      const customerAuths = await Promise.all(
        Array.from({ length: numberOfCustomers }, (_, i) => 
          authenticateUser('customer', { email: `customer${i}@test.com` })
        )
      );

      // Merchant creates service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // All customers simultaneously add to cart and checkout
      const checkoutPromises = customerAuths.map(async (customerAuth, index) => {
        await apiRequest('post', '/api/cart/add', customerAuth.token)
          .send({
            serviceId: serviceResponse.body._id,
            merchantId: merchantAuth.user._id,
            quantity: 1,
            price: 100
          });

        return await apiRequest('post', '/api/orders/checkout', customerAuth.token)
          .send({
            deliveryInfo: {
              address: {
                street: `${index}00 Customer St`,
                city: 'City',
                coordinates: [-69.8 - (index * 0.01), 18.4 + (index * 0.01)]
              },
              contactPhone: `+12345${index}7890`
            },
            paymentMethod: 'cash'
          });
      });

      const checkoutResponses = await Promise.all(checkoutPromises);

      // All orders should be successful
      checkoutResponses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body._id).toBeDefined();
      });

      // Merchant should see all orders
      const allOrdersResponse = await apiRequest('get', '/api/merchant/orders/pending', merchantAuth.token);
      expect(allOrdersResponse.status).toBe(200);
      expect(allOrdersResponse.body).toHaveLength(numberOfCustomers);
    });

    test('Multiple delivery persons efficiently distribute workload', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');
      
      const numberOfDeliveryPersons = 3;
      const deliveryAuths = await Promise.all(
        Array.from({ length: numberOfDeliveryPersons }, (_, i) => 
          authenticateUser('delivery', { 
            email: `delivery${i}@test.com`,
            deliveryInfo: {
              vehicleType: 'motorcycle',
              currentLocation: {
                coordinates: [-69.9 + (i * 0.01), 18.5 + (i * 0.01)]
              }
            }
          })
        )
      );

      // Create multiple orders
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      const numberOfOrders = 6;
      const orderIds = [];

      for (let i = 0; i < numberOfOrders; i++) {
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
                street: `${i}00 Order St`,
                city: 'City',
                coordinates: [-69.8 - (i * 0.01), 18.4 + (i * 0.01)]
              },
              contactPhone: `+12345${i}7890`
            },
            paymentMethod: 'cash'
          });

        orderIds.push(checkoutResponse.body._id);

        // Prepare order
        await apiRequest('put', `/api/orders/${checkoutResponse.body._id}/status`, merchantAuth.token)
          .send({ status: 'confirmed' });
        await apiRequest('put', `/api/orders/${checkoutResponse.body._id}/status`, merchantAuth.token)
          .send({ status: 'preparing' });
        await apiRequest('put', `/api/orders/${checkoutResponse.body._id}/status`, merchantAuth.token)
          .send({ status: 'ready' });
      }

      // Delivery persons compete for orders
      const assignmentPromises = deliveryAuths.flatMap(deliveryAuth =>
        orderIds.map(orderId =>
          apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
            .send({ orderId })
            .catch(() => ({ status: 409 })) // Handle expected conflicts
        )
      );

      const assignmentResponses = await Promise.all(assignmentPromises);
      const successfulAssignments = assignmentResponses.filter(r => r.status === 200);
      
      // Should have exactly as many successful assignments as orders
      expect(successfulAssignments).toHaveLength(numberOfOrders);

      // Verify workload distribution
      for (const deliveryAuth of deliveryAuths) {
        const activeDeliveriesResponse = await apiRequest('get', '/api/delivery/active', deliveryAuth.token);
        expect(activeDeliveriesResponse.status).toBe(200);
        expect(activeDeliveriesResponse.body.length).toBeGreaterThan(0);
      }
    });
  });
});