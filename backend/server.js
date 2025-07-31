const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

// Rutas de autenticación para usuarios normales
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Rutas para comerciantes (registro, login, perfil, obtener lista)
const merchantRoutes = require('./routes/merchantRoutes');
app.use('/api/merchant', merchantRoutes);

// Rutas para servicios de comerciantes
const serviceRoutes = require('./routes/services');
app.use('/api/services', serviceRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Backend funcionando correctamente ');
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
