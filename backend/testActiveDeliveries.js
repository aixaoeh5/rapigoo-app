const axios = require('axios');
require('dotenv').config();

async function testActiveDeliveries() {
  try {
    console.log('🔐 Haciendo login como delivery...');
    
    // Login como delivery
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'delivery@test.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login exitoso, token obtenido');
    console.log('👤 Usuario:', loginResponse.data.user);
    
    // Obtener entregas activas
    console.log('\n📡 Obteniendo entregas activas...');
    const activeResponse = await axios.get('http://localhost:3001/api/delivery/active', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\n📦 Respuesta de /api/delivery/active:');
    console.log(JSON.stringify(activeResponse.data, null, 2));
    
    if (activeResponse.data.deliveries && activeResponse.data.deliveries.length > 0) {
      console.log('\n✅ Entregas activas encontradas:', activeResponse.data.deliveries.length);
      
      activeResponse.data.deliveries.forEach((delivery, index) => {
        console.log(`\n🚚 Entrega ${index + 1}:`);
        console.log('  - ID:', delivery._id);
        console.log('  - Order ID:', delivery.orderId?._id || delivery.orderId);
        console.log('  - Order Number:', delivery.orderId?.orderNumber);
        console.log('  - Status:', delivery.status);
        console.log('  - Pickup Location:', delivery.pickupLocation?.address);
        console.log('  - Delivery Location:', delivery.deliveryLocation?.address);
      });
    } else {
      console.log('\n⚠️ No se encontraron entregas activas');
    }
    
    // También verificar órdenes disponibles
    console.log('\n📡 Obteniendo órdenes disponibles...');
    try {
      const availableResponse = await axios.get('http://localhost:3001/api/delivery/orders/available', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('\n📋 Órdenes disponibles:', availableResponse.data.orders?.length || 0);
      if (availableResponse.data.orders && availableResponse.data.orders.length > 0) {
        availableResponse.data.orders.forEach((order, index) => {
          console.log(`\n📦 Orden ${index + 1}:`);
          console.log('  - Order Number:', order.orderNumber);
          console.log('  - Status:', order.status);
          console.log('  - Total:', order.total);
        });
      }
    } catch (error) {
      console.log('❌ Error obteniendo órdenes disponibles:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testActiveDeliveries();