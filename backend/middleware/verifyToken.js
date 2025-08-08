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

    // Obtener datos completos del usuario de la base de datos
    const user = await User.findById(decoded.id).select('_id name email role');
    
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
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

module.exports = verifyToken;
