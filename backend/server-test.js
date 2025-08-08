const express = require('express');

const app = express();

// Middleware básico
app.use(express.json());

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    message: 'API Rapigoo - Test Server',
    version: '1.0.0',
    status: 'active',
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV || 'development'
  });
});

app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
console.log('Iniciando servidor de prueba...');

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor de prueba corriendo en el puerto ${PORT}`);
  console.log(`📡 Accesible en: http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('Error del servidor:', err);
});

// Timeout para verificar que el servidor funciona
setTimeout(() => {
  console.log('✅ Servidor funcionando correctamente después de 3 segundos');
}, 3000);

module.exports = app;