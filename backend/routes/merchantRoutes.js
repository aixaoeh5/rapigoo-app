const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const merchantController = require('../controllers/merchantController');

const {
  registerMerchant,
  loginMerchant,
  verifyMerchantEmail,
  createMerchantProfile,
  updateMerchantProfile,
  getAllMerchants,
  updateMerchantStatus,
  getMerchantsByCategory,
  getAllMerchantsForAdmin, 
} = merchantController;

// ✅ Registro y autenticación
router.post('/register', registerMerchant);                    
router.post('/login', loginMerchant);                         
router.post('/verify-email-register', verifyMerchantEmail);    

// ✅ Perfil del comerciante
router.post('/profile', verifyToken, createMerchantProfile);   
router.put('/profile', verifyToken, updateMerchantProfile);    

// ✅ Categorías y filtrado
router.get('/category', getMerchantsByCategory);              
router.get('/', getAllMerchants);                              

// ✅ Admin
router.get('/all', getAllMerchantsForAdmin);                 
router.put('/status/:id', updateMerchantStatus);              

module.exports = router;
