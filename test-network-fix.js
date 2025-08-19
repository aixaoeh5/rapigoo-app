#!/usr/bin/env node
/**
 * Network Fix Verification Script
 * Tests all API endpoints and connectivity scenarios
 */

const axios = require('axios');

// Server configuration
const SERVER_IP = '172.26.236.81';
const SERVER_PORT = 5000;
const BASE_URL = `http://${SERVER_IP}:${SERVER_PORT}`;

// Test scenarios
const ENDPOINTS_TO_TEST = [
  { name: 'Health Check', url: '/api/health', method: 'GET' },
  { name: 'Orders Endpoint', url: '/api/orders', method: 'GET', needsAuth: true },
  { name: 'Delivery Active', url: '/api/delivery/active', method: 'GET', needsAuth: true },
  { name: 'Auth Login', url: '/api/auth/login', method: 'POST', data: { email: 'carlos.delivery@rapigoo.com', password: '123456' } }
];

// Different IP scenarios to test
const IP_SCENARIOS = [
  { name: 'PC Network IP', ip: '10.0.0.198' },
  { name: 'WSL IP', ip: '172.26.236.81' },
  { name: 'Localhost', ip: 'localhost' },
  { name: 'Android Emulator', ip: '10.0.2.2' },
  { name: '127.0.0.1', ip: '127.0.0.1' }
];

console.log('🔍 RAPIGOO NETWORK FIX VERIFICATION');
console.log('=====================================');

async function testEndpoint(baseUrl, endpoint) {
  try {
    const url = `${baseUrl}${endpoint.url}`;
    console.log(`📡 Testing: ${endpoint.name} - ${endpoint.method} ${url}`);
    
    const config = {
      method: endpoint.method,
      url: url,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (endpoint.data) {
      config.data = endpoint.data;
    }
    
    if (endpoint.needsAuth) {
      // For auth-required endpoints, we expect 401 without token
      config.validateStatus = (status) => status === 401 || status === 200;
    }
    
    const response = await axios(config);
    
    if (endpoint.needsAuth && response.status === 401) {
      console.log(`   ✅ PASS: ${endpoint.name} (401 Unauthorized - Expected without token)`);
      return { success: true, status: response.status, message: 'Auth required (expected)' };
    } else if (response.status === 200) {
      console.log(`   ✅ PASS: ${endpoint.name} (${response.status})`);
      return { success: true, status: response.status, data: response.data };
    } else {
      console.log(`   ⚠️  WARN: ${endpoint.name} (${response.status})`);
      return { success: false, status: response.status, message: 'Unexpected status' };
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`   ❌ FAIL: ${endpoint.name} - Connection refused`);
      return { success: false, error: 'Connection refused', code: error.code };
    } else if (error.code === 'ECONNABORTED') {
      console.log(`   ❌ FAIL: ${endpoint.name} - Timeout`);
      return { success: false, error: 'Timeout', code: error.code };
    } else if (error.response?.status === 401 && endpoint.needsAuth) {
      console.log(`   ✅ PASS: ${endpoint.name} (401 Unauthorized - Expected)`);
      return { success: true, status: 401, message: 'Auth required (expected)' };
    } else {
      console.log(`   ❌ FAIL: ${endpoint.name} - ${error.message}`);
      return { success: false, error: error.message, status: error.response?.status };
    }
  }
}

async function testIPScenario(scenario) {
  console.log(`\n🌐 Testing IP Scenario: ${scenario.name} (${scenario.ip})`);
  console.log('─'.repeat(50));
  
  const baseUrl = `http://${scenario.ip}:${SERVER_PORT}`;
  const results = [];
  
  for (const endpoint of ENDPOINTS_TO_TEST) {
    const result = await testEndpoint(baseUrl, endpoint);
    results.push({ endpoint: endpoint.name, ...result });
  }
  
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n📊 Scenario Results: ${successCount}/${totalCount} passed`);
  
  return {
    scenario: scenario.name,
    ip: scenario.ip,
    results,
    successRate: (successCount / totalCount) * 100
  };
}

async function runNetworkDiagnostics() {
  console.log(`\n🔍 NETWORK DIAGNOSTICS`);
  console.log('─'.repeat(50));
  
  // Check if server is running
  try {
    const healthCheck = await axios.get(`${BASE_URL}/api/health`, { timeout: 3000 });
    console.log(`✅ Server is running: ${healthCheck.data.status}`);
    console.log(`   Environment: ${healthCheck.data.environment}`);
    console.log(`   Version: ${healthCheck.data.version}`);
  } catch (error) {
    console.log(`❌ Server not responding: ${error.message}`);
    return false;
  }
  
  return true;
}

async function main() {
  // Run diagnostics first
  const serverRunning = await runNetworkDiagnostics();
  
  if (!serverRunning) {
    console.log('\n🚨 CRITICAL: Server is not running or not accessible');
    console.log('💡 Solutions:');
    console.log('   1. Start the server: cd backend && node server-production.js');
    console.log('   2. Check if WSL IP has changed');
    console.log('   3. Verify firewall settings');
    return;
  }
  
  // Test all IP scenarios
  const allResults = [];
  
  for (const scenario of IP_SCENARIOS) {
    const result = await testIPScenario(scenario);
    allResults.push(result);
  }
  
  // Summary
  console.log(`\n📋 FINAL SUMMARY`);
  console.log('─'.repeat(50));
  
  allResults.forEach(result => {
    const status = result.successRate === 100 ? '✅' : 
                   result.successRate >= 75 ? '⚠️' : '❌';
    console.log(`${status} ${result.scenario} (${result.ip}): ${result.successRate.toFixed(0)}% success`);
  });
  
  // Recommendations
  console.log(`\n💡 RECOMMENDATIONS`);
  console.log('─'.repeat(50));
  
  const bestScenario = allResults.reduce((best, current) => 
    current.successRate > best.successRate ? current : best
  );
  
  if (bestScenario.successRate === 100) {
    console.log(`✅ Use IP: ${bestScenario.ip} (${bestScenario.scenario})`);
    console.log(`   Update your React Native app to use: http://${bestScenario.ip}:${SERVER_PORT}/api`);
  } else {
    console.log(`⚠️ No IP scenario achieved 100% success`);
    console.log(`   Best option: ${bestScenario.ip} (${bestScenario.successRate.toFixed(0)}% success)`);
    console.log(`   Check server configuration and network settings`);
  }
  
  console.log(`\n📱 FOR MOBILE TESTING:`);
  console.log(`   - Physical device: Use ${SERVER_IP}:${SERVER_PORT}`);
  console.log(`   - Android emulator: Use 10.0.2.2:${SERVER_PORT}`);
  console.log(`   - iOS simulator: Use localhost:${SERVER_PORT}`);
  console.log(`   - Web browser: Use localhost:${SERVER_PORT}`);
}

main().catch(console.error);