const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const merchantController = require('../controllers/merchantController');

const {
  registerMerchant,
  verifyMerchantEmail,
  loginMerchant,
  createMerchantProfile,
  getAllMerchants, 
} = merchantController;

// Registro y autenticación
router.post('/register', registerMerchant);
router.post('/login', loginMerchant);
router.post('/verify-email-register', verifyMerchantEmail);

// Guardar perfil del negocio (protegido)
router.post('/profile', verifyToken, createMerchantProfile);

// Obtener todos los comerciantes (para el backoffice)
router.get('/', getAllMerchants); 

// Aprobar o rechazar comerciantes
router.put('/status/:id', merchantController.updateMerchantStatus);

module.exports = router;
