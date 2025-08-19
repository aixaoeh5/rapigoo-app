const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');

module.exports = async () => {
  console.log('🔧 Setting up E2E test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';
  process.env.MONGO_URI_TEST = 'mongodb://localhost:27017/rapigoo_e2e_test';
  
  // Start MongoDB Memory Server for testing
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 3 },
    instanceOpts: [
      { port: 27017 },
      { port: 27018 }, 
      { port: 27019 }
    ]
  });
  
  const uri = replSet.getUri();
  global.__MONGOD__ = replSet;
  process.env.MONGO_URI_TEST = uri;
  
  console.log(`✅ MongoDB Test Server started at: ${uri}`);
  console.log('🚀 E2E test environment ready!');
};