const mongoose = require('mongoose');

module.exports = async () => {
  console.log('🧹 Cleaning up E2E test environment...');
  
  // Close any remaining database connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('✅ MongoDB connections closed');
  }
  
  // Stop MongoDB Memory Server
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
    console.log('✅ MongoDB Test Server stopped');
  }
  
  console.log('🎉 E2E test environment cleanup complete!');
};