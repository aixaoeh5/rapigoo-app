#!/usr/bin/env node

/**
 * Network connectivity test for Rapigoo app
 * Tests API endpoints and network configuration
 */

const axios = require('axios');

const SERVER_IP = '172.26.236.81';
const PORT = 5000;

async function testEndpoint(url, description) {
  try {
    console.log(`🔍 Testing ${description}: ${url}`);
    const response = await axios.get(url, { 
      timeout: 5000,
      headers: { 'Accept': 'application/json' }
    });
    console.log(`✅ ${description} - Status: ${response.status}`);
    if (response.data) {
      console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 200));
    }
    return true;
  } catch (error) {
    console.log(`❌ ${description} - Error: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
    }
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting network connectivity tests for Rapigoo\n');
  
  const tests = [
    [`http://${SERVER_IP}:${PORT}`, 'Root endpoint'],
    [`http://${SERVER_IP}:${PORT}/api`, 'API base endpoint'],
    [`http://${SERVER_IP}:${PORT}/api/health`, 'Health check'],
    [`http://${SERVER_IP}:${PORT}/api/auth`, 'Auth endpoint'],
    [`http://${SERVER_IP}:${PORT}/api/orders`, 'Orders endpoint'],
  ];
  
  let passed = 0;
  let total = tests.length;
  
  for (const [url, description] of tests) {
    const success = await testEndpoint(url, description);
    if (success) passed++;
    console.log(''); // blank line
  }
  
  console.log(`📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Network connectivity is working.');
  } else {
    console.log('⚠️  Some tests failed. Check server configuration.');
  }
  
  return passed === total;
}

if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runTests, testEndpoint };