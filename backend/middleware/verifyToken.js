const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado: Token faltante' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Función para buscar usuario con retry
    const findUserWithRetry = async (userId, maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const user = await User.findById(userId).select('_id name email role').maxTimeMS(8000);
          return user;
        } catch (error) {
          console.warn(`⚠️  Intento ${attempt}/${maxRetries} fallido para buscar usuario:`, error.message);
          
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Esperar antes del siguiente intento (backoff exponencial)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    };

    // Obtener datos completos del usuario con retry
    const user = await findUserWithRetry(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (err) {
    console.error('❌ Error al verificar token:', err);
    
    // Distinguir entre errores de JWT y errores de DB
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }
    
    // Error de base de datos - devolver 503 Service Unavailable
    return res.status(503).json({ 
      message: 'Servicio temporalmente no disponible',
      error: 'DB_TIMEOUT' 
    });
  }
};

module.exports = verifyToken;
