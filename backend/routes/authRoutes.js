const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validation');

const {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  resendVerificationCode,
  socialLogin,
  forgotPassword,
  verifyPassword,
  verifyResetCode,
  resetPassword,
  verifyEmailRegister,
  verifyEmailChange,
  changePassword,
} = require('../controllers/authController');

const verifyToken = require('../middleware/verifyToken');

// RUTAS PÚBLICAS
router.post('/login', validate('login'), loginUser);
router.post('/register', validate('register'), registerUser);
router.post('/verify-email-register', validate('verifyCode'), verifyEmailRegister);     
router.post('/verify-email-change', verifyToken, validate('verifyCode'), verifyEmailChange); 
router.post('/verify-reset-code', validate('verifyCode'), verifyResetCode);             
router.post('/resend-code', resendVerificationCode);
router.post('/social-login', socialLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', validate('resetPassword'), resetPassword);

// RUTAS PROTEGIDAS
router.get('/user', verifyToken, getUserProfile);
router.put('/update-profile', verifyToken, updateUserProfile);
router.post('/verify-password', verifyToken, verifyPassword);
router.put('/change-password', verifyToken, changePassword);

module.exports = router;
