const User = require('../models/User');
const Service = require('../models/Service');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// NODEMAILER CONFIG
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// REGISTRO COMERCIANTE
const registerMerchant = async (req, res) => {
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

// VERIFICAR CODIGO
const verifyMerchantEmail = async (req, res) => {
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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

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

// LOGIN
const loginMerchant = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email, role: 'comerciante' });
    if (!user) return res.status(400).json({ message: 'Comerciante no encontrado' });

    if (!user.isVerified) {
      return res.status(401).json({ message: 'Cuenta no verificada por correo.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

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

// CREAR PERFIL DEL NEGOCIO
const createMerchantProfile = async (req, res) => {
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

// ACTUALIZAR PERFIL
const updateMerchantProfile = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token faltante' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'comerciante') {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const { name, email, phone, avatar, business } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar;

    if (!user.business) user.business = {};
    if (!user.business.schedule) user.business.schedule = {};

    if (business?.address) user.business.address = business.address;
    if (business?.socials) user.business.socials = business.socials;
    if (business?.schedule?.opening) user.business.schedule.opening = business.schedule.opening;
    if (business?.schedule?.closing) user.business.schedule.closing = business.schedule.closing;

    await user.save();

    return res.status(200).json({ message: 'Perfil actualizado correctamente' });
  } catch (error) {
    console.error('❌ Error en updateMerchantProfile:', error);
    return res.status(500).json({ message: 'Error interno al actualizar perfil' });
  }
};

// OBTENER COMERCIANTES POR CATEGORÍA
const getAllMerchants = async (req, res) => {
  try {
    const { category } = req.query;

    let filter = { role: 'comerciante', merchantStatus: 'aprobado' };

    if (category) {
      filter['business.category'] = category;
    }

    const merchants = await User.find(filter);

    res.json(merchants);
  } catch (error) {
    console.error('Error al obtener comerciantes:', error);
    res.status(500).json({ message: 'Error al obtener comerciantes' });
  }
};

const getMerchantsByCategory = async (req, res) => {
  try {
    const { category } = req.query;

    if (!category) {
      return res.status(400).json({ success: false, message: 'Categoría no especificada' });
    }

    const merchants = await User.find({
      role: 'comerciante',
      'business.category': category,
      isVerified: true,
      merchantStatus: 'aprobado',
    });

    res.json({ success: true, data: merchants });
  } catch (error) {
    console.error('Error al filtrar comerciantes por categoría:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};


// ACTUALIZAR ESTADO DE APROBACIÓN
const updateMerchantStatus = async (req, res) => {
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

// Obtener todos los comerciantes 
const getAllMerchantsForAdmin = async (req, res) => {
  try {
    const merchants = await User.find({ role: 'comerciante' });
    res.status(200).json(merchants);
  } catch (err) {
    console.error('Error al obtener comerciantes para admin:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};


//Perfil publico comerciante
const getPublicMerchantProfile = async (req, res) => {
  try {
    const { merchantId } = req.params;

    const user = await User.findById(merchantId);
    if (
      !user ||
      user.role !== 'comerciante' ||
      !user.isVerified ||
      user.merchantStatus !== 'aprobado'
    ) {
      return res.status(404).json({ success: false, message: 'Comerciante no encontrado o no aprobado' });
    }

    const services = await Service.find({ merchantId }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        merchant: {
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          phone: user.phone,
          business: user.business,
        },
        services
      }
    });
  } catch (error) {
    console.error('Error al obtener perfil público:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// ACTUALIZAR UBICACIÓN DEL NEGOCIO
const updateBusinessLocation = async (req, res) => {
  try {
    const { latitude, longitude, pickupAddress } = req.body;

    // Validar coordenadas
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Las coordenadas de latitud y longitud son requeridas'
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        message: 'Las coordenadas no son válidas'
      });
    }

    // Actualizar la ubicación del negocio
    const updateData = {
      'business.location.coordinates': [longitude, latitude],
      'business.location.type': 'Point'
    };

    // Si se proporciona información de dirección de pickup, actualizarla también
    if (pickupAddress) {
      if (pickupAddress.street) updateData['business.pickupAddress.street'] = pickupAddress.street;
      if (pickupAddress.city) updateData['business.pickupAddress.city'] = pickupAddress.city;
      if (pickupAddress.state) updateData['business.pickupAddress.state'] = pickupAddress.state;
      if (pickupAddress.zipCode) updateData['business.pickupAddress.zipCode'] = pickupAddress.zipCode;
      if (pickupAddress.landmarks) updateData['business.pickupAddress.landmarks'] = pickupAddress.landmarks;
      if (pickupAddress.instructions) updateData['business.pickupAddress.instructions'] = pickupAddress.instructions;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('business.location business.pickupAddress');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Ubicación del negocio actualizada exitosamente',
      data: {
        location: updatedUser.business.location,
        pickupAddress: updatedUser.business.pickupAddress
      }
    });

  } catch (error) {
    console.error('Error updating business location:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  registerMerchant,
  loginMerchant,
  verifyMerchantEmail,
  createMerchantProfile,
  updateMerchantProfile,
  getAllMerchants,
  updateMerchantStatus,
  getMerchantsByCategory, 
  getAllMerchantsForAdmin,
  getPublicMerchantProfile,
  updateBusinessLocation,
};
