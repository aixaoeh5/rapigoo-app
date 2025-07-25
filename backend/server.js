const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

// Rutas de autenticación (usuarios normales)
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

//  Rutas de comerciantes
const merchantRoutes = require('./routes/merchantRoutes');
app.use('/api/merchant', merchantRoutes);

//  Ruta base
app.get('/', (req, res) => {
  res.send('Backend funcionando correctamente 🔥');
});

//  Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Conectado a MongoDB'))
.catch((err) => console.error('❌ Error al conectar a MongoDB:', err));

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
