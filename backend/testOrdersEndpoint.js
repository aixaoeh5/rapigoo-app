const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Cargar variables de entorno
dotenv.config();

// Importar modelos
const User = require('./models/User');
const http = require('http');

async function testOrdersEndpoint() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Conectado a MongoDB');
    
    // Buscar un cliente (consumidor)
    const customer = await User.findOne({ role: 'cliente' });
    if (!customer) {
      console.log('❌ No se encontró ningún cliente en la base de datos');
      process.exit(1);
    }
    
    // Generar un token JWT válido para el cliente
    const token = jwt.sign(
      { 
        id: customer._id, 
        email: customer.email, 
        role: customer.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log(`👤 Cliente: ${customer.name} (${customer.email})`);
    console.log(`🔑 Token generado`);
    
    // Hacer la petición al endpoint
    console.log('📡 Probando endpoint /api/orders...');
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/orders?limit=50',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          console.log('✅ Respuesta del servidor:');
          console.log('   Status:', res.statusCode);
          console.log('   Success:', response.success);
          console.log('   Orders found:', response.data?.orders?.length || 0);
          
          if (response.data?.orders?.length > 0) {
            const order = response.data.orders[0];
            console.log('   First order:');
            console.log('     - ID:', order._id);
            console.log('     - Number:', order.orderNumber);
            console.log('     - Status:', order.status);
            console.log('     - Total:', order.total);
            console.log('     - Items:', order.items?.length || 0);
          }
          
          process.exit(0);
        } catch (parseError) {
          console.error('❌ Error parsing response:', parseError);
          console.log('Raw response:', data);
          process.exit(1);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Error en la petición:', error);
      process.exit(1);
    });
    
    req.end();
    
  } catch (error) {
    console.error('❌ Error general:', error);
    process.exit(1);
  }
}

// Ejecutar la función
testOrdersEndpoint();