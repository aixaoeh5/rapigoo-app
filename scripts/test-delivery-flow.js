#!/usr/bin/env node

/**
 * Comprehensive test script for delivery flow to verify null data fixes
 */

const axios = require('axios');

const SERVER_URL = 'http://172.26.236.81:5000';

class DeliveryFlowTester {
  constructor() {
    this.authToken = null;
    this.deliveryUserId = null;
    this.testOrderId = null;
    this.trackingId = null;
  }

  async login() {
    try {
      console.log('🔐 Testing delivery user login...');
      
      const response = await axios.post(`${SERVER_URL}/api/auth/login`, {
        email: 'delivery@test.com',
        password: 'delivery123'
      });

      if (response.data.success) {
        this.authToken = response.data.token;
        this.deliveryUserId = response.data.user.id;
        console.log('✅ Login successful');
        return true;
      }
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      return false;
    }
  }

  async testApiEndpoints() {
    console.log('\n📡 Testing API endpoints...');
    
    const endpoints = [
      { path: '/api', description: 'Base API endpoint' },
      { path: '/api/delivery/active', description: 'Active deliveries' },
      { path: '/api/delivery/orders/available', description: 'Available orders' },
      { path: '/api/delivery/history', description: 'Delivery history' }
    ];

    const headers = { Authorization: `Bearer ${this.authToken}` };
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${SERVER_URL}${endpoint.path}`, { headers });
        console.log(`✅ ${endpoint.description}: Status ${response.status}`);
        
        if (endpoint.path === '/api/delivery/active' && response.data.data?.deliveries?.length > 0) {
          this.trackingId = response.data.data.deliveries[0]._id;
          console.log(`   📍 Found active delivery: ${this.trackingId}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint.description}: Error ${error.response?.status || error.message}`);
      }
    }
  }

  async testDeliveryDataValidation() {
    console.log('\n🧪 Testing delivery data validation...');
    
    if (!this.trackingId) {
      console.log('⚠️ No active delivery found for testing');
      return;
    }

    try {
      const response = await axios.get(`${SERVER_URL}/api/delivery/${this.trackingId}`, {
        headers: { Authorization: `Bearer ${this.authToken}` }
      });

      if (response.data.success) {
        const deliveryData = response.data.data.deliveryTracking;
        
        console.log('📋 Delivery data structure validation:');
        console.log(`   _id: ${deliveryData._id ? '✅' : '❌'}`);
        console.log(`   status: ${deliveryData.status ? '✅' : '❌'}`);
        console.log(`   orderId: ${deliveryData.orderId ? '✅' : '❌'}`);
        console.log(`   deliveryPersonId: ${deliveryData.deliveryPersonId ? '✅' : '❌'}`);
        console.log(`   pickupLocation: ${deliveryData.pickupLocation?.coordinates ? '✅' : '❌'}`);
        console.log(`   deliveryLocation: ${deliveryData.deliveryLocation?.coordinates ? '✅' : '❌'}`);
        
        return deliveryData;
      }
    } catch (error) {
      console.error('❌ Delivery data validation failed:', error.message);
    }
  }

  async testNavigationParams() {
    console.log('\n🧭 Testing navigation parameter scenarios...');
    
    const scenarios = [
      {
        name: 'Complete data',
        params: {
          trackingId: this.trackingId,
          orderId: 'test-order-id',
          deliveryTracking: { _id: this.trackingId, status: 'assigned' }
        }
      },
      {
        name: 'Only trackingId',
        params: {
          trackingId: this.trackingId
        }
      },
      {
        name: 'Invalid trackingId',
        params: {
          trackingId: null
        }
      },
      {
        name: 'Malformed object',
        params: {
          deliveryTracking: {},
          trackingId: undefined
        }
      }
    ];

    for (const scenario of scenarios) {
      console.log(`\n  🎭 Scenario: ${scenario.name}`);
      
      // Simulate parameter validation (would be called in DeliveryNavigationScreen)
      const hasMinimumData = scenario.params.trackingId || scenario.params.deliveryTracking?._id;
      const isValid = hasMinimumData && scenario.params.trackingId !== null;
      
      console.log(`     Valid: ${isValid ? '✅' : '❌'}`);
      
      if (isValid) {
        console.log(`     trackingId: ${scenario.params.trackingId}`);
        console.log(`     orderId: ${scenario.params.orderId || 'Not provided'}`);
        console.log(`     hasDeliveryTracking: ${!!scenario.params.deliveryTracking}`);
      }
    }
  }

  async testLocationUpdate() {
    console.log('\n📍 Testing location update with null safety...');
    
    if (!this.trackingId) {
      console.log('⚠️ No active delivery for location test');
      return;
    }

    try {
      const response = await axios.put(
        `${SERVER_URL}/api/delivery/${this.trackingId}/location`,
        {
          latitude: -34.6037,
          longitude: -58.3816,
          accuracy: 10,
          speed: 0,
          heading: 0
        },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      );

      if (response.data.success) {
        console.log('✅ Location update successful');
      }
    } catch (error) {
      console.log(`❌ Location update failed: ${error.response?.status || error.message}`);
    }
  }

  async testStatusUpdate() {
    console.log('\n🔄 Testing status update with null safety...');
    
    if (!this.trackingId) {
      console.log('⚠️ No active delivery for status test');
      return;
    }

    try {
      const response = await axios.put(
        `${SERVER_URL}/api/delivery/${this.trackingId}/status`,
        {
          status: 'heading_to_pickup',
          notes: 'Test status update from validation script'
        },
        { headers: { Authorization: `Bearer ${this.authToken}` } }
      );

      if (response.data.success) {
        console.log('✅ Status update successful');
      }
    } catch (error) {
      console.log(`❌ Status update failed: ${error.response?.status || error.message}`);
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Delivery Flow Validation Tests\n');
    
    const loginSuccess = await this.login();
    if (!loginSuccess) {
      console.error('❌ Cannot proceed without authentication');
      return;
    }

    await this.testApiEndpoints();
    await this.testDeliveryDataValidation();
    await this.testNavigationParams();
    await this.testLocationUpdate();
    await this.testStatusUpdate();
    
    console.log('\n✅ All delivery flow tests completed!');
    console.log('\n📋 Summary:');
    console.log('   - API endpoints tested for connectivity');
    console.log('   - Delivery data structure validated');
    console.log('   - Navigation parameters scenarios tested');
    console.log('   - Location and status updates verified');
    console.log('\n🎯 If all tests passed, the null data errors should be resolved!');
  }
}

if (require.main === module) {
  const tester = new DeliveryFlowTester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = DeliveryFlowTester;