const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
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
  isVerified: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);

