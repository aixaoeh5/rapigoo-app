const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const admin = require('../firebaseAdmin');
const emailService = require('../utils/emailService');

// Función de retry para operaciones MongoDB
const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.log(`🔄 Intento ${i + 1}/${maxRetries} falló:`, error.message);
      
      if (i === maxRetries - 1) throw error;
      
      // Backoff exponencial
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};

// LOGIN
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await retryOperation(() => 
      User.findOne({ email }).maxTimeMS(8000)
    );
    
    if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

    if (!user.isVerified) {
      return res.status(401).json({ message: 'Tu cuenta aún no fue verificada por correo.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Construir respuesta del usuario según el rol
    const userResponse = {
      id: user._id,
      name: user.name,
      role: user.role,
    };

    // Agregar campos específicos según el rol
    if (user.role === 'comerciante') {
      userResponse.merchantStatus = user.merchantStatus;
    } else if (user.role === 'delivery') {
      userResponse.deliveryStatus = user.deliveryStatus;
      console.log('🚚 Debug delivery login - deliveryStatus:', user.deliveryStatus);
    }

    res.status(200).json({
      token,
      user: userResponse,
    });
  } catch (err) {
    console.error('❌ Error en login:', err);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
};

// VERIFICAR CONTRASEÑA ACTUAL
exports.verifyPassword = async (req, res) => {
  const { password } = req.body;

  if (!password) return res.status(400).json({ message: 'La contraseña es requerida' });

  try {
    const user = await retryOperation(() => 
      User.findById(req.user.id).maxTimeMS(8000)
    );
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta' });

    res.status(200).json({ message: 'Contraseña verificada correctamente' });
  } catch (err) {
    console.error('❌ Error al verificar contraseña:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
};


// REGISTRO
exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const existingVerifiedUser = await retryOperation(() => 
      User.findOne({ email, isVerified: true }).maxTimeMS(8000)
    );
    if (existingVerifiedUser) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    const existingUser = await retryOperation(() => 
      User.findOne({ email }).maxTimeMS(8000)
    );

    if (existingUser && existingUser.status === 'rechazado') {
      await retryOperation(() => 
        User.deleteOne({ email }).maxTimeMS(8000)
      );
    }

    if (existingUser && !existingUser.isVerified) {
      const isExpired =
        existingUser.verificationCodeExpires &&
        existingUser.verificationCodeExpires < Date.now();

      if (isExpired) {
        await retryOperation(() => 
          User.deleteOne({ _id: existingUser._id }).maxTimeMS(8000)
        );
      } else {
        return res
          .status(400)
          .json({ message: 'Este correo ya está pendiente de verificación' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'cliente',
      verificationCode,
      verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000), 
    });

    await retryOperation(() => user.save());

    await emailService.sendVerificationCode(email, verificationCode, name);

    res
      .status(201)
      .json({ success: true, message: 'Código de verificación enviado al correo' });
  } catch (err) {
    console.error('❌ Error al registrar usuario:', err);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
};


// VERIFICAR REGISTRO (email al registrarse)
exports.verifyEmailRegister = async (req, res) => {
  const { email, code } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (user.verificationCodeExpires && user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ message: 'El código ha expirado' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Código incorrecto' });
    }

    user.verificationCode = null;
    user.verificationCodeExpires = null;
    user.isVerified = true;

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('❌ Error en verifyEmailRegister:', err);
    res.status(500).json({ message: 'Error al verificar código' });
  }
};

// VERIFICAR CAMBIO DE CORREO
exports.verifyEmailChange = async (req, res) => {
  const { newEmail, code } = req.body;

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token faltante' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (!newEmail) {
      return res.status(400).json({ message: 'El nuevo correo es requerido' });
    }

    if (user.verificationCodeExpires && user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ message: 'El código ha expirado' });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Código incorrecto' });
    }

    user.verificationCode = null;
    user.verificationCodeExpires = null;
    user.email = newEmail;

    await user.save();

    return res.status(200).json({ message: 'Correo actualizado con éxito' });
  } catch (err) {
    console.error('❌ Error en verifyEmailChange:', err);
    res.status(500).json({ message: 'Error al verificar código' });
  }
};

// VERIFICAR CÓDIGO PARA RECUPERACIÓN DE CONTRASEÑA
exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Código incorrecto' });
    }

    user.verificationCode = null;
    await user.save();

    return res.status(200).json({ success: true, message: 'Código verificado correctamente' });
  } catch (err) {
    console.error('❌ Error en verifyResetCode:', err);
    res.status(500).json({ message: 'Error al verificar el código' });
  }
};



// REENVIAR CÓDIGO DE VERIFICACIÓN

exports.resendVerificationCode = async (req, res) => {
  const { email, context } = req.body;

  try {
    let user;

    if (context === 'update-email') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Token faltante' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.id);

      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    } else if (context === 'reset-password') {
      user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    } else {
      user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

      if (user.isVerified) {
        return res.status(400).json({ message: 'La cuenta ya está verificada' });
      }
    }

    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    user.verificationCode = newCode;
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const subject =
      context === 'update-email'
        ? 'Confirma tu nuevo correo electrónico'
        : context === 'reset-password'
        ? '🔐 Recuperación de contraseña'
        : 'Código de verificación';

    const html =
      context === 'update-email'
        ? `<p>Estás intentando cambiar tu correo. Tu código es:</p><h1>${newCode}</h1>`
        : context === 'reset-password'
        ? `<p>Estás intentando recuperar tu contraseña. Tu código es:</p><h1>${newCode}</h1>`
        : `<p>Tu código de verificación es:</p><h1>${newCode}</h1>`;

    if (context === 'reset') {
      await emailService.sendPasswordResetCode(email, newCode);
    } else {
      await emailService.sendVerificationCode(email, newCode, user.name);
    }

    res.status(200).json({ success: true, message: 'Código enviado al correo' });
  } catch (err) {
    console.error('❌ Error al reenviar código:', err);
    res.status(500).json({ message: 'Error al reenviar código' });
  }
};


// GET USER PROFILE

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password'); 
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.status(200).json(user);
  } catch (err) {
    console.error('❌ Error al obtener perfil:', err);
    res.status(500).json({ message: 'Error al obtener perfil' });
  }
};


// SOCIAL LOGIN

exports.socialLogin = async (req, res) => {
  const { firebaseToken } = req.body;

  try {
    const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    const { email, name, picture } = decodedToken;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name: name || 'Usuario sin nombre',
        email,
        password: '',
        avatar: picture || '',
        isVerified: true,
      });
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('❌ Error en socialLogin:', error);
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

// ENVIAR CÓDIGO PARA RECUPERAR CONTRASEÑA

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const resetCode = Math.floor(1000 + Math.random() * 9000).toString();
    user.verificationCode = resetCode;
    await user.save();

    await emailService.sendPasswordResetCode(email, resetCode);

    res.status(200).json({ success: true, message: 'Código enviado al correo' });
  } catch (err) {
    console.error('❌ Error en forgotPassword:', err);
    res.status(500).json({ message: 'Error al enviar código' });
  }
};

// CAMBIAR CONTRASEÑA
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Se requieren la contraseña actual y la nueva' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Contraseña actual incorrecta' });

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'La nueva contraseña debe ser diferente a la actual' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: 'Contraseña cambiada exitosamente' });
  } catch (error) {
    console.error('❌ Error al cambiar contraseña:', error);
    res.status(500).json({ message: 'Error al cambiar la contraseña' });
  }
};

// UPDATE USER PROFILE
exports.updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id); 

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (req.body.email && req.body.email !== user.email) {
      const emailExists = await User.findOne({ email: req.body.email });
      if (emailExists && emailExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'El correo ya está en uso por otro usuario' });
      }
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    user.avatar = req.body.avatar || user.avatar;

    // Actualizar dirección de entrega si se proporciona
    if (req.body.deliveryAddress) {
      user.deliveryAddress = {
        coordinates: req.body.deliveryAddress.coordinates || user.deliveryAddress?.coordinates,
        street: req.body.deliveryAddress.street || user.deliveryAddress?.street || '',
        city: req.body.deliveryAddress.city || user.deliveryAddress?.city || '',
        state: req.body.deliveryAddress.state || user.deliveryAddress?.state || '',
        zipCode: req.body.deliveryAddress.zipCode || user.deliveryAddress?.zipCode || '',
        landmarks: req.body.deliveryAddress.landmarks || user.deliveryAddress?.landmarks || '',
        instructions: req.body.deliveryAddress.instructions || user.deliveryAddress?.instructions || ''
      };
    }

    const updatedUser = await user.save();

    res.status(200).json({ 
      success: true,
      message: 'Perfil actualizado', 
      user: updatedUser 
    });
  } catch (error) {
    console.error('❌ Error al actualizar perfil:', error);
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
};

// UPDATE DELIVERY ADDRESS (endpoint específico)
exports.updateDeliveryAddress = async (req, res) => {
  try {
    console.log('📍 Actualizando dirección de entrega para usuario:', req.user.id);
    console.log('📍 Datos recibidos:', JSON.stringify(req.body, null, 2));

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuario no encontrado' 
      });
    }

    const { deliveryAddress } = req.body;
    if (!deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: 'Datos de dirección de entrega requeridos'
      });
    }

    // Validar coordenadas
    if (!deliveryAddress.coordinates || deliveryAddress.coordinates.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Coordenadas válidas requeridas'
      });
    }

    // Actualizar dirección de entrega
    user.deliveryAddress = {
      coordinates: deliveryAddress.coordinates,
      street: deliveryAddress.street || '',
      city: deliveryAddress.city || 'Santo Domingo',
      state: deliveryAddress.state || 'Distrito Nacional',
      zipCode: deliveryAddress.zipCode || '10101',
      landmarks: deliveryAddress.landmarks || '',
      instructions: deliveryAddress.instructions || ''
    };

    const updatedUser = await user.save();
    
    console.log('✅ Dirección de entrega actualizada exitosamente');

    res.status(200).json({
      success: true,
      message: 'Dirección de entrega actualizada exitosamente',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        deliveryAddress: updatedUser.deliveryAddress
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando dirección de entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};



// RESTABLECER CONTRASEÑA DESPUÉS DEL OTP

exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Correo y nueva contraseña son requeridos' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('❌ Error en resetPassword:', err);
    res.status(500).json({ message: 'Error al restablecer la contraseña' });
  }
};
