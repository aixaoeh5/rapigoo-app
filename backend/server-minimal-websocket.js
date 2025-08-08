// Minimal server just for testing WebSocket/Socket.IO connection
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:19006', // Expo web
      'exp://localhost:19000',  // Expo development
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// Simple auth middleware for Socket.IO (no JWT verification for testing)
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      console.log('⚠️ No token provided, allowing connection for testing');
    } else {
      console.log('🔐 Token received:', token.substring(0, 20) + '...');
    }

    // Mock user for testing
    socket.userId = 'test-user-123';
    socket.user = { 
      _id: 'test-user-123',
      name: 'Test Delivery Person', 
      role: 'delivery' 
    };
    
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('✅ Client connected:', {
    socketId: socket.id,
    userId: socket.userId,
    userName: socket.user.name
  });

  // Delivery tracking events
  socket.on('join_delivery_tracking', (data) => {
    const { orderId } = data;
    const roomName = `delivery_${orderId}`;
    socket.join(roomName);
    console.log('🎯 Joined delivery tracking:', { userId: socket.userId, orderId });
  });

  socket.on('leave_delivery_tracking', (data) => {
    const { orderId } = data;
    const roomName = `delivery_${orderId}`;
    socket.leave(roomName);
    console.log('👋 Left delivery tracking:', { userId: socket.userId, orderId });
  });

  socket.on('delivery_location_update', (data) => {
    const { orderId } = data;
    const roomName = `delivery_${orderId}`;
    
    console.log('📍 Location update received:', data);
    
    // Echo back to all clients in the room
    socket.to(roomName).emit('delivery_location_updated', {
      orderId,
      ...data,
      timestamp: new Date()
    });
  });

  socket.on('delivery_status_update', (data) => {
    const { orderId } = data;
    const roomName = `delivery_${orderId}`;
    
    console.log('📊 Status update received:', data);
    
    // Echo back to all clients in the room
    socket.to(roomName).emit('delivery_status_updated', {
      orderId,
      ...data,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('👋 Client disconnected:', socket.id);
  });
});

// Basic HTTP endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'Minimal WebSocket Test Server',
    status: 'active',
    connectedClients: io.engine.clientsCount
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'WebSocket test endpoint',
    connectedClients: io.engine.clientsCount,
    timestamp: new Date()
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Minimal WebSocket server running on port ${PORT}`);
  console.log(`🔗 Test URL: http://localhost:${PORT}`);
  console.log('📡 Socket.IO ready for connections');
});

module.exports = app;