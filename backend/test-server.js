// Ultra-minimal HTTP server for testing WebSocket connection
const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple HTTP server
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/' || req.url === '/api') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Test server for WebSocket fix verification',
      status: 'active',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not found',
      message: 'This is a minimal test server'
    }));
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`🔗 Test URL: http://localhost:${PORT}`);
  console.log('📱 This server will allow testing the app without WebSocket errors');
  console.log('✅ The realTimeService should now gracefully handle no WebSocket connection');
});

module.exports = server;