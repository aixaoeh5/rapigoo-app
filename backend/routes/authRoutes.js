const express = require('express');
const router = express.Router();

const {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  verifyEmail,
  resendVerificationCode,
  socialLogin,
  forgotPassword,
  verifyPassword,
  verifyResetCode,       
  resetPassword,         
} = require('../controllers/authController');

const verifyToken = require('../middleware/verifyToken');

// RUTAS PÚBLICAS
router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendVerificationCode); 
router.post('/social-login', socialLogin);
router.post('/forgot-password', forgotPassword); 
router.post('/verify-reset-code', verifyResetCode); 
router.post('/reset-password', resetPassword);       

// RUTAS PROTEGIDAS
router.get('/user', verifyToken, getUserProfile);
router.put('/update-profile', verifyToken, updateUserProfile);
router.post('/verify-password', verifyToken, verifyPassword);

module.exports = router;
