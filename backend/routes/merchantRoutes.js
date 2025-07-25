const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

const {
  registerMerchant,
  verifyMerchantEmail,
  loginMerchant,
  createMerchantProfile,
} = require('../controllers/merchantController');

// Autenticación de comerciantes
router.post('/register', registerMerchant);
router.post('/login', loginMerchant);
router.post('/verify-email-register', verifyMerchantEmail);

// Guardar perfil del negocio
router.post('/profile', verifyToken, createMerchantProfile);

module.exports = router;
