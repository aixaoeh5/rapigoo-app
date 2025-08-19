const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

console.log('🔬 Testing delivery address endpoint...');

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// Import User model
const User = require('./models/User');

// Simple auth middleware for testing
const verifyToken = require('./middleware/verifyToken');

// Import the specific auth controller function
const { updateDeliveryAddress, updateUserProfile } = require('./controllers/authController');

// Test routes
app.put('/auth/delivery-address', verifyToken, (req, res, next) => {
  console.log('📍 Endpoint /auth/delivery-address called');
  console.log('📍 Request body:', JSON.stringify(req.body, null, 2));
  console.log('📍 User ID:', req.user?.id);
  updateDeliveryAddress(req, res, next);
});

app.put('/auth/update-profile', verifyToken, (req, res, next) => {
  console.log('📍 Endpoint /auth/update-profile called');
  console.log('📍 Request body:', JSON.stringify(req.body, null, 2));
  console.log('📍 User ID:', req.user?.id);
  updateUserProfile(req, res, next);
});

app.get('/auth/user', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    console.log('📍 User data retrieved:', user ? 'Found' : 'Not found');
    if (user) {
      console.log('📍 Has delivery address:', !!user.deliveryAddress);
    }
    res.json(user);
  } catch (error) {
    console.error('❌ Error getting user:', error);
    res.status(500).json({ message: 'Error getting user' });
  }
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Test server working',
    endpoints: [
      'PUT /auth/delivery-address',
      'PUT /auth/update-profile', 
      'GET /auth/user'
    ]
  });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log('📍 Ready to test delivery address endpoints');
});