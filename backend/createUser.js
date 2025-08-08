const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
useNewUrlParser: true,
useUnifiedTopology: true,
})
.then(async () => {
const hashedPassword = await bcrypt.hash('123456', 10);

const newUser = new User({
    name: 'Carlos Delivery',
    email: 'carlos.delivery@rapigoo.com',
    password: hashedPassword,
    role: 'delivery',
    phone: '+1-809-555-0123',
    isVerified: true
});

await newUser.save();
console.log('✅ Usuario creado con éxito');
mongoose.disconnect();
})
.catch((err) => {
console.error('❌ Error al conectar o crear usuario:', err);
});
