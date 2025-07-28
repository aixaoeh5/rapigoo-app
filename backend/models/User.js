const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  businessName: String,
  rnc: String,
  category: String,
  address: String,
  openHour: String,
  closeHour: String,
  description: String,
  phone: String,
  socialMedia: String,
});

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['cliente', 'comerciante', 'admin'],
      default: 'cliente',
    },
    phone: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    },
    verificationCode: String,
    verificationCodeExpires: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },

    // SOLO PARA COMERCIANTES
    merchantStatus: {
      type: String,
      enum: ['pendiente', 'aprobado', 'rechazado'],
      default: 'pendiente',
    },
    business: businessSchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
