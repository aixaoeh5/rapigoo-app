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

const mongoose = require('mongoose');

describe('E2E: Data Integrity and Consistency Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('Transaction Atomicity and Consistency', () => {
    test('Order creation with cart clearing is fully atomic', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Create service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // Add multiple items to cart
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 2,
          price: 100
        });

      const initialCartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(initialCartResponse.body.items).toHaveLength(1);

      // Test successful transaction
      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Transaction St',
              city: 'Atomic City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      expect(checkoutResponse.status).toBe(201);

      // Verify order was created
      const orderResponse = await apiRequest('get', `/api/orders/${checkoutResponse.body._id}`, customerAuth.token);
      expect(orderResponse.status).toBe(200);
      expect(orderResponse.body.items).toHaveLength(1);
      expect(orderResponse.body.items[0].quantity).toBe(2);

      // Verify cart was cleared
      const finalCartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(finalCartResponse.body.items).toHaveLength(0);

      // Verify no orphaned data exists
      const Cart = require('../../backend/models/Cart');
      const Order = require('../../backend/models/Order');

      const cartInDb = await Cart.findOne({ userId: customerAuth.user._id });
      expect(cartInDb.items).toHaveLength(0);

      const orderInDb = await Order.findById(checkoutResponse.body._id);
      expect(orderInDb).toBeTruthy();
      expect(orderInDb.status).toBe('pending');
    });

    test('Failed order creation leaves cart unchanged', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // Add items to cart
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 3,
          price: 150
        });

      const beforeFailureCart = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(beforeFailureCart.body.items).toHaveLength(1);

      // Attempt checkout with invalid data
      const failedCheckoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '', // Invalid empty street
              city: '',
              coordinates: [] // Invalid coordinates
            },
            contactPhone: 'invalid-phone'
          },
          paymentMethod: 'invalid_payment'
        });

      expect(failedCheckoutResponse.status).toBe(400);

      // Verify cart remains unchanged
      const afterFailureCart = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(afterFailureCart.body.items).toHaveLength(1);
      expect(afterFailureCart.body.items[0].quantity).toBe(3);

      // Verify no order was created
      const ordersResponse = await apiRequest('get', '/api/orders/history', customerAuth.token);
      expect(ordersResponse.body).toHaveLength(0);

      // Verify database consistency
      const Cart = require('../../backend/models/Cart');
      const Order = require('../../backend/models/Order');

      const cartInDb = await Cart.findOne({ userId: customerAuth.user._id });
      expect(cartInDb.items).toHaveLength(1);

      const ordersInDb = await Order.find({ customerId: customerAuth.user._id });
      expect(ordersInDb).toHaveLength(0);
    });

    test('Delivery assignment is atomic and prevents double assignment', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const delivery1Auth = await authenticateUser('delivery', { email: 'delivery1@test.com' });
      const delivery2Auth = await authenticateUser('delivery', { email: 'delivery2@test.com' });

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
              street: '123 Delivery St',
              city: 'Assignment City',
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
      const assignmentPromises = [
        apiRequest('post', '/api/delivery/assign', delivery1Auth.token).send({ orderId }),
        apiRequest('post', '/api/delivery/assign', delivery2Auth.token).send({ orderId })
      ];

      const [result1, result2] = await Promise.allSettled(assignmentPromises);

      // One should succeed, one should fail
      const successfulAssignments = [result1, result2].filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      const failedAssignments = [result1, result2].filter(r => 
        r.status === 'fulfilled' && r.value.status === 409
      );

      expect(successfulAssignments).toHaveLength(1);
      expect(failedAssignments).toHaveLength(1);

      // Verify database consistency
      const Order = require('../../backend/models/Order');
      const DeliveryTracking = require('../../backend/models/DeliveryTracking');

      const orderInDb = await Order.findById(orderId);
      expect(orderInDb.deliveryPersonId).toBeTruthy();
      expect(orderInDb.status).toBe('assigned');

      const deliveryTrackings = await DeliveryTracking.find({ orderId });
      expect(deliveryTrackings).toHaveLength(1);
      expect(deliveryTrackings[0].deliveryPersonId.toString()).toBe(orderInDb.deliveryPersonId.toString());
    });
  });

  describe('Data Relationship Consistency', () => {
    test('Order and DeliveryTracking records remain synchronized', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');
      const deliveryAuth = await authenticateUser('delivery');

      // Create complete order flow
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
              street: '123 Sync Test St',
              city: 'Consistency City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Update order through merchant
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      // Assign delivery
      await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId });

      // Update delivery status
      await apiRequest('put', `/api/delivery/${orderId}/pickup`, deliveryAuth.token)
        .send({
          pickupLocation: [-69.9, 18.5],
          pickupTime: new Date().toISOString()
        });

      await apiRequest('put', `/api/delivery/${orderId}/status`, deliveryAuth.token)
        .send({
          status: 'in_transit',
          currentLocation: [-69.85, 18.45]
        });

      await apiRequest('put', `/api/delivery/${orderId}/complete`, deliveryAuth.token)
        .send({
          deliveryLocation: [-69.8, 18.4],
          completionTime: new Date().toISOString()
        });

      // Verify consistency between Order and DeliveryTracking
      const Order = require('../../backend/models/Order');
      const DeliveryTracking = require('../../backend/models/DeliveryTracking');

      const orderInDb = await Order.findById(orderId);
      const deliveryInDb = await DeliveryTracking.findOne({ orderId });

      expect(orderInDb.status).toBe('delivered');
      expect(deliveryInDb.status).toBe('delivered');
      expect(orderInDb.deliveryPersonId.toString()).toBe(deliveryInDb.deliveryPersonId.toString());
      expect(orderInDb.deliveryPersonId.toString()).toBe(deliveryAuth.user._id);
    });

    test('Service availability affects cart items correctly', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Create service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          availability: true
        }));

      const serviceId = serviceResponse.body._id;

      // Customer adds to cart while available
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId,
          merchantId: merchantAuth.user._id,
          quantity: 2,
          price: 100
        });

      // Merchant makes service unavailable
      await apiRequest('put', `/api/services/${serviceId}/availability`, merchantAuth.token)
        .send({ availability: false });

      // Verify service is unavailable
      const serviceAfterUpdate = await apiRequest('get', `/api/services/${serviceId}`);
      expect(serviceAfterUpdate.body.availability).toBe(false);

      // Customer should still be able to checkout existing cart items
      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Availability St',
              city: 'Consistency City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      expect(checkoutResponse.status).toBe(201);

      // But new customers should not be able to add unavailable items
      const customer2Auth = await authenticateUser('customer', { email: 'customer2@test.com' });
      const addUnavailableResponse = await apiRequest('post', '/api/cart/add', customer2Auth.token)
        .send({
          serviceId,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      expect(addUnavailableResponse.status).toBe(400);
    });

    test('User deletion maintains referential integrity', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Create service and order
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
              street: '123 Integrity St',
              city: 'Reference City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Verify order exists
      const orderBeforeDeletion = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(orderBeforeDeletion.status).toBe(200);

      // Simulate user account deletion (soft delete)
      const User = require('../../backend/models/User');
      await User.findByIdAndUpdate(customerAuth.user._id, { 
        isActive: false,
        deletedAt: new Date()
      });

      // Order should still exist but with anonymized customer reference
      const Order = require('../../backend/models/Order');
      const orderAfterDeletion = await Order.findById(orderId);
      expect(orderAfterDeletion).toBeTruthy();
      expect(orderAfterDeletion.customerId).toBeTruthy(); // Still references customer for historical purposes

      // But customer should not be able to access orders
      const orderAccessResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(orderAccessResponse.status).toBe(401); // Unauthorized due to inactive account
    });
  });

  describe('Optimistic Locking and Version Control', () => {
    test('Concurrent order status updates are handled correctly', async () => {
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

      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Concurrency St',
              city: 'Lock City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Test optimistic locking by directly manipulating database
      const Order = require('../../backend/models/Order');
      
      // Get two instances of the same order (simulating concurrent access)
      const order1 = await Order.findById(orderId);
      const order2 = await Order.findById(orderId);

      expect(order1.__v).toBe(order2.__v); // Same version initially

      // Update first instance
      await order1.updateStatus('confirmed');
      
      // Second instance should now fail due to version mismatch
      try {
        await order2.updateStatus('cancelled');
        fail('Expected concurrent modification error');
      } catch (error) {
        expect(error.message).toMatch(/Concurrent modification detected/);
      }

      // Verify final state
      const finalOrder = await Order.findById(orderId);
      expect(finalOrder.status).toBe('confirmed');
      expect(finalOrder.__v).toBe(1); // Version incremented
    });

    test('Version control works across order lifecycle', async () => {
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
              street: '123 Version St',
              city: 'Control City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;
      const Order = require('../../backend/models/Order');

      // Track version through lifecycle
      let order = await Order.findById(orderId);
      expect(order.__v).toBe(0); // Initial version

      // Merchant updates
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });
      
      order = await Order.findById(orderId);
      expect(order.__v).toBe(1);

      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });
      
      order = await Order.findById(orderId);
      expect(order.__v).toBe(2);

      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });
      
      order = await Order.findById(orderId);
      expect(order.__v).toBe(3);

      // Delivery assignment
      await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId });
      
      order = await Order.findById(orderId);
      expect(order.__v).toBe(4);

      // Completion
      await apiRequest('put', `/api/delivery/${orderId}/pickup`, deliveryAuth.token)
        .send({
          pickupLocation: [-69.9, 18.5],
          pickupTime: new Date().toISOString()
        });

      await apiRequest('put', `/api/delivery/${orderId}/complete`, deliveryAuth.token)
        .send({
          deliveryLocation: [-69.8, 18.4],
          completionTime: new Date().toISOString()
        });

      order = await Order.findById(orderId);
      expect(order.__v).toBeGreaterThan(4); // Multiple delivery updates
    });
  });

  describe('Data Validation and Constraints', () => {
    test('Database constraints prevent invalid data insertion', async () => {
      const Order = require('../../backend/models/Order');
      const Cart = require('../../backend/models/Cart');
      const User = require('../../backend/models/User');

      // Test required field constraints
      try {
        const invalidOrder = new Order({
          // Missing required customerId
          items: [],
          total: 100
        });
        await invalidOrder.save();
        fail('Expected validation error for missing customerId');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
      }

      // Test data type constraints
      try {
        const invalidUser = new User({
          name: 'Test User',
          email: 'invalid-email', // Invalid email format
          password: 'password123',
          userType: 'customer'
        });
        await invalidUser.save();
        fail('Expected validation error for invalid email');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
      }

      // Test enum constraints
      try {
        const invalidOrder = new Order({
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
          status: 'invalid_status', // Invalid status
          deliveryInfo: {
            address: {
              street: 'Test St',
              city: 'Test City',
              coordinates: [-69.8, 18.4]
            }
          }
        });
        await invalidOrder.save();
        fail('Expected validation error for invalid status');
      } catch (error) {
        expect(error.name).toBe('ValidationError');
      }
    });

    test('Coordinate validation prevents invalid locations', async () => {
      const customerAuth = await authenticateUser('customer');
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

      // Test various invalid coordinate scenarios
      const invalidCoordinates = [
        [181, 91],      // Longitude > 180
        [-181, -91],    // Longitude < -180, Latitude < -90
        [0, 91],        // Latitude > 90
        [0, -91],       // Latitude < -90
        ['invalid', 0], // Non-numeric longitude
        [0, 'invalid'], // Non-numeric latitude
        [null, null],   // Null values
        [],             // Empty array
        [0],            // Incomplete coordinates
        [0, 0, 0]       // Too many values
      ];

      for (const coords of invalidCoordinates) {
        const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
          .send({
            deliveryInfo: {
              address: {
                street: 'Test Street',
                city: 'Test City',
                coordinates: coords
              },
              contactPhone: '+1234567890'
            },
            paymentMethod: 'cash'
          });

        expect(checkoutResponse.status).toBe(400);
        expect(checkoutResponse.body.error).toBeDefined();
      }
    });

    test('Price and quantity validations work correctly', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, { price: 100 }));

      // Test invalid quantities
      const invalidQuantities = [-1, 0, 1000, 'invalid', null, undefined];

      for (const qty of invalidQuantities) {
        const addToCartResponse = await apiRequest('post', '/api/cart/add', customerAuth.token)
          .send({
            serviceId: serviceResponse.body._id,
            merchantId: merchantAuth.user._id,
            quantity: qty,
            price: 100
          });

        expect(addToCartResponse.status).toBe(400);
      }

      // Test invalid prices
      const invalidPrices = [-1, 'invalid', null, undefined, 0];

      for (const price of invalidPrices) {
        const addToCartResponse = await apiRequest('post', '/api/cart/add', customerAuth.token)
          .send({
            serviceId: serviceResponse.body._id,
            merchantId: merchantAuth.user._id,
            quantity: 1,
            price: price
          });

        expect(addToCartResponse.status).toBe(400);
      }
    });
  });

  describe('Cleanup and Orphaned Data Prevention', () => {
    test('No orphaned DeliveryTracking records after order cancellation', async () => {
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
              street: '123 Cleanup St',
              city: 'Orphan City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Prepare and assign
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'confirmed' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'preparing' });
      await apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
        .send({ status: 'ready' });

      await apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
        .send({ orderId });

      // Verify delivery tracking was created
      const DeliveryTracking = require('../../backend/models/DeliveryTracking');
      let deliveryTracking = await DeliveryTracking.findOne({ orderId });
      expect(deliveryTracking).toBeTruthy();

      // Cancel order
      await apiRequest('put', `/api/orders/${orderId}/cancel`, customerAuth.token)
        .send({ reason: 'Changed mind' });

      // Verify order is cancelled
      const Order = require('../../backend/models/Order');
      const cancelledOrder = await Order.findById(orderId);
      expect(cancelledOrder.status).toBe('cancelled');

      // Verify delivery tracking is also updated/cleaned up
      deliveryTracking = await DeliveryTracking.findOne({ orderId });
      expect(deliveryTracking.status).toBe('cancelled');
    });

    test('Cart cleanup after successful order prevents data accumulation', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Create multiple services
      const services = [];
      for (let i = 0; i < 5; i++) {
        const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
          .send(createTestService(merchantAuth.user._id, { name: `Service ${i}` }));
        services.push(serviceResponse.body);
      }

      // Add all services to cart
      for (const service of services) {
        await apiRequest('post', '/api/cart/add', customerAuth.token)
          .send({
            serviceId: service._id,
            merchantId: merchantAuth.user._id,
            quantity: Math.floor(Math.random() * 3) + 1,
            price: service.price
          });
      }

      // Verify cart has items
      const cartBeforeCheckout = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(cartBeforeCheckout.body.items).toHaveLength(5);

      // Checkout
      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Cleanup Test St',
              city: 'Clean City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      expect(checkoutResponse.status).toBe(201);

      // Verify cart is completely empty
      const cartAfterCheckout = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(cartAfterCheckout.body.items).toHaveLength(0);

      // Verify in database
      const Cart = require('../../backend/models/Cart');
      const cartInDb = await Cart.findOne({ userId: customerAuth.user._id });
      expect(cartInDb.items).toHaveLength(0);
    });

    test('Session cleanup prevents memory leaks', async () => {
      const numberOfSessions = 100;
      const initialMemory = process.memoryUsage();

      // Create many authentication sessions
      const sessionPromises = Array.from({ length: numberOfSessions }, (_, i) =>
        authenticateUser('customer', { 
          email: `session${i}@test.com`,
          name: `Session User ${i}`
        })
      );

      const sessions = await Promise.all(sessionPromises);

      // Each session makes some requests
      const requestPromises = sessions.map(async (auth, index) => {
        // Make a few API calls per session
        await apiRequest('get', '/api/search', auth.token).query({ query: 'test' });
        await apiRequest('get', '/api/cart', auth.token);
        
        if (index % 10 === 0) {
          console.log(`Processed ${index + 1}/${numberOfSessions} sessions`);
        }
      });

      await Promise.all(requestPromises);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseInMB = memoryIncrease / (1024 * 1024);

      console.log(`Memory increase after ${numberOfSessions} sessions: ${memoryIncreaseInMB.toFixed(2)}MB`);

      // Memory increase should be reasonable (less than 50MB for 100 sessions)
      expect(memoryIncreaseInMB).toBeLessThan(50);
    });
  });
});