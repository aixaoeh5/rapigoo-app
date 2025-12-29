const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../backend/server');

// Test database setup
let replSet;

const setupTestDatabase = async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 3 },
    instanceOpts: [
      { port: 27017 },
      { port: 27018 },
      { port: 27019 }
    ]
  });
  
  const uri = replSet.getUri();
  await mongoose.connect(uri);
};

const cleanupTestDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
};

const clearCollections = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

// Test data factories
const createTestUser = (type = 'customer', overrides = {}) => {
  const baseUser = {
    name: `Test ${type}`,
    email: `test${type}@example.com`,
    password: 'testPassword123',
    phone: '+1234567890',
    userType: type,
    isVerified: true
  };

  if (type === 'merchant') {
    baseUser.businessInfo = {
      businessName: 'Test Business',
      businessType: 'restaurant',
      address: {
        street: '123 Test St',
        city: 'Test City',
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
    };
    baseUser.isApproved = true;
  }

  if (type === 'delivery') {
    baseUser.deliveryInfo = {
      vehicleType: 'motorcycle',
      licensePlate: 'TEST123',
      availability: true,
      currentLocation: {
        coordinates: [-69.9, 18.5]
      }
    };
    baseUser.isApproved = true;
  }

  return { ...baseUser, ...overrides };
};

const createTestService = (merchantId, overrides = {}) => ({
  name: 'Test Service',
  description: 'Test service description',
  price: 100,
  merchantId,
  category: 'food',
  availability: true,
  estimatedTime: 30,
  ...overrides
});

const createTestOrder = (customerId, merchantId, items = [], overrides = {}) => ({
  customerId,
  merchantId,
  items: items.length > 0 ? items : [{
    serviceId: new mongoose.Types.ObjectId(),
    name: 'Test Service',
    price: 100,
    quantity: 1,
    subtotal: 100
  }],
  subtotal: 100,
  deliveryFee: 20,
  total: 120,
  deliveryInfo: {
    address: {
      street: '456 Delivery St',
      city: 'Test City',
      coordinates: [-69.8, 18.4]
    },
    contactPhone: '+1234567890'
  },
  paymentMethod: 'cash',
  status: 'pending',
  ...overrides
});

// Authentication helpers
const authenticateUser = async (userType = 'customer', userData = {}) => {
  const user = createTestUser(userType, userData);
  
  // Register user
  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send(user);
    
  expect(registerResponse.status).toBe(201);
  
  // Login user
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: user.email,
      password: user.password
    });
    
  expect(loginResponse.status).toBe(200);
  expect(loginResponse.body.token).toBeDefined();
  
  return {
    user: loginResponse.body.user,
    token: loginResponse.body.token,
    authHeader: `Bearer ${loginResponse.body.token}`
  };
};

// API request helpers
const apiRequest = (method, endpoint, token = null) => {
  const req = request(app)[method.toLowerCase()](endpoint);
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
};

// Timing helpers
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const waitForCondition = async (conditionFn, timeout = 5000, interval = 100) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return true;
    }
    await sleep(interval);
  }
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Error simulation helpers
const simulateNetworkError = () => {
  // Mock network failures for testing error handling
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
  
  return () => {
    global.fetch = originalFetch;
  };
};

const simulateDatabaseError = () => {
  // Mock database connection issues
  const originalConnect = mongoose.connection.db;
  jest.spyOn(mongoose.connection, 'db', 'get').mockImplementation(() => {
    throw new Error('Database connection error');
  });
  
  return () => {
    jest.restoreAllMocks();
  };
};

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase,
  clearCollections,
  createTestUser,
  createTestService,
  createTestOrder,
  authenticateUser,
  apiRequest,
  sleep,
  waitForCondition,
  simulateNetworkError,
  simulateDatabaseError,
  app
};