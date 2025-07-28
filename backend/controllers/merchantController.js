const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

//  NODEMAILER
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// REGISTRO COMERCIANTES
exports.registerMerchant = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const existingUser = await User.findOne({ email, role: 'comerciante' });

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ message: 'El correo ya está registrado como comerciante' });
      }

      if (existingUser.merchantStatus === 'rechazado') {
        await User.deleteOne({ _id: existingUser._id });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    let user = await User.findOne({ email, role: 'comerciante' });

    if (user) {
      user.name = name;
      user.password = hashedPassword;
      user.verificationCode = verificationCode;
      user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
    } else {
      user = new User({
        name,
        email,
        password: hashedPassword,
        role: 'comerciante',
        verificationCode,
        verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
      });
    }

    await user.save();

    await transporter.sendMail({
      from: `"Rapigoo 🚀" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verifica tu cuenta de comerciante 🛍️',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>¡Hola ${name || 'comerciante'}!</h2>
          <p>Tu código de verificación es:</p>
          <h1>${verificationCode}</h1>
          <p>Ingresalo en la app para activar tu cuenta.</p>
        </div>
      `,
    });

    return res.status(201).json({ success: true, message: 'Código de verificación enviado al correo' });

  } catch (err) {
    console.error('❌ Error en registerMerchant:', err);
    return res.status(500).json({ message: 'Error al registrar comerciante' });
  }
};


// VERIFICACION DE CODIGO
exports.verifyMerchantEmail = async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ email, role: 'comerciante' });
    if (!user) return res.status(404).json({ message: 'Comerciante no encontrado' });

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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('❌ Error en verifyMerchantEmail:', err);
    res.status(500).json({ message: 'Error al verificar código del comerciante' });
  }
};

// LOGIN COMERCIANTE
exports.loginMerchant = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, role: 'comerciante' });
    if (!user) return res.status(400).json({ message: 'Comerciante no encontrado' });

    if (!user.isVerified) {
      return res.status(401).json({ message: 'Cuenta no verificada por correo.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

res.status(200).json({
  token,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    merchantStatus: user.merchantStatus || 'pendiente',
  },
});
  } catch (err) {
    console.error('❌ Error en loginMerchant:', err);
    res.status(500).json({ message: 'Error al iniciar sesión del comerciante' });
  }
};

// GUARDAR DATOS DEL NEGOCIO
exports.createMerchantProfile = async (req, res) => {
  try {
    const userId = req.user.id; 
    const {
      businessName,
      rnc,
      category,
      address,
      openHour,
      closeHour,
      description,
    } = req.body;

    if (!businessName || !rnc || !category || !address || !openHour || !closeHour || !description) {
      return res.status(400).json({ message: 'Todos los campos del negocio son obligatorios' });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'comerciante') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    user.business = {
      businessName,
      rnc,
      category,
      address,
      openHour,
      closeHour,
      description,
    };
    user.merchantStatus = 'pendiente';

    await user.save();

    res.status(200).json({ success: true, message: 'Perfil del negocio guardado' });
  } catch (err) {
    console.error('❌ Error al guardar el negocio:', err);
    res.status(500).json({ message: 'Error interno al guardar el perfil del negocio' });
  }
};

exports.getAllMerchants = async (req, res) => {
  try {
    const merchants = await User.find({ role: 'comerciante' }).sort({ createdAt: -1 });
    res.status(200).json(merchants);
  } catch (err) {
    console.error('❌ Error al obtener comerciantes:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
};


//APROBACION DEL ADMIN
exports.updateMerchantStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['aprobado', 'rechazado'].includes(status)) {
    return res.status(400).json({ message: 'Estado inválido' });
  }

  try {
    const user = await User.findById(id);
    if (!user || user.role !== 'comerciante') {
      return res.status(404).json({ message: 'Comerciante no encontrado' });
    }

    user.merchantStatus = status;
    await user.save();

    res.status(200).json({ message: `Comerciante ${status} con éxito` });
  } catch (err) {
    console.error('❌ Error al actualizar estado del comerciante:', err);
    res.status(500).json({ message: 'Error al actualizar estado del comerciante' });
  }
};
