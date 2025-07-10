const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const admin = require('../firebaseAdmin');

// LOGIN

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Usuario no encontrado' });

    if (!user.isVerified) {
      return res.status(401).json({ message: 'Tu cuenta aún no fue verificada por correo.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('❌ Error en login:', err);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
};

// VERIFICAR CONTRASEÑA ACTUAL

exports.verifyPassword = async (req, res) => {
  const userId = req.userId;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: 'La contraseña es requerida' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta' });

    return res.status(200).json({ message: 'Contraseña verificada correctamente' });
  } catch (err) {
    console.error('❌ Error al verificar contraseña:', err);
    return res.status(500).json({ message: 'Error del servidor' });
  }
};


// REGISTRO SOLO SI EL CORREO NO ESTÁ VERIFICADO

exports.registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  try {
    const existingVerifiedUser = await User.findOne({ email, isVerified: true });
    if (existingVerifiedUser) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    let user = await User.findOne({ email });

    if (user) {
      user.name = name;
      user.password = hashedPassword;
      user.verificationCode = verificationCode;
      user.role = role || 'cliente';
    } else {
      user = new User({
        name,
        email,
        password: hashedPassword,
        role: role || 'cliente',
        verificationCode,
      });
    }

    await user.save();

    // Envío de correo
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Rapigoo 🚀" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verifica tu cuenta en Rapigoo 🛵',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>¡Hola ${name || 'usuario'}!</h2>
          <p>Tu código de verificación es:</p>
          <h1>${verificationCode}</h1>
          <p>Ingresalo en la app para activar tu cuenta.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      success: true,
      message: 'Código de verificación enviado al correo',
    });
  } catch (err) {
    console.error('❌ Error al registrar usuario:', err);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
};

// VERIFICAR CÓDIGO DE EMAIL

exports.verifyEmail = async (req, res) => {
  const { email, code, context } = req.body;

  try {
    let user;

    if (context === 'update-email') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Token faltante' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.id);
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

      if (user.verificationCode !== code) {
        return res.status(400).json({ message: 'Código incorrecto' });
      }

      user.verificationCode = null;
      await user.save();

      return res.status(200).json({ message: 'Código verificado con éxito' });
    }

    user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: 'Código de verificación incorrecto' });
    }

    if (!user.isVerified) {
      user.isVerified = true;
      user.verificationCode = null;
      await user.save();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

      return res.status(200).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    }

    user.verificationCode = null;
    await user.save();

    return res.status(204).send();
  } catch (err) {
    console.error('❌ Error al verificar código:', err);
    res.status(500).json({ message: 'Error al verificar código' });
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

    const mailOptions = {
      from: `"Rapigoo 🚀" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;">${html}</div>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: 'Código enviado al correo' });
  } catch (err) {
    console.error('❌ Error al reenviar código:', err);
    res.status(500).json({ message: 'Error al reenviar código' });
  }
};


// GET USER PROFILE

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
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
      expiresIn: '1d',
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

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Rapigoo 🚀" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 Recuperación de contraseña',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hola 👋</h2>
          <p>Tu código de recuperación es:</p>
          <h1>${resetCode}</h1>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: 'Código enviado al correo' });
  } catch (err) {
    console.error('❌ Error en forgotPassword:', err);
    res.status(500).json({ message: 'Error al enviar código' });
  }
};

// UPDATE USER PROFILE

exports.updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
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

    const updatedUser = await user.save();

    res.status(200).json({ message: 'Perfil actualizado', user: updatedUser });
  } catch (error) {
    console.error('❌ Error al actualizar perfil:', error);
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
};

//RECUPERACION DE CONTRASEÑA

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



//REENVIAR CODIGO DE VERIFICACION

exports.resendVerificationCode = async (req, res) => {
  const { email, context } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (context === 'register' && user.isVerified) {
      return res.status(400).json({ message: 'La cuenta ya está verificada' });
    }

    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    user.verificationCode = newCode;
    user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000); 
    await user.save();

    const transporter = require('nodemailer').createTransport({
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
        ? 'Recuperación de contraseña'
        : 'Verificación de cuenta';

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <p>${subject}</p>
        <h1>${newCode}</h1>
      </div>
    `;

    await transporter.sendMail({
      from: `"Rapigoo 🚀" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html,
    });

    res.status(200).json({ success: true, message: 'Código enviado correctamente' });
  } catch (err) {
    console.error('❌ Error al reenviar código:', err);
    res.status(500).json({ message: 'Error del servidor al reenviar el código' });
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
