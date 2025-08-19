const axios = require('axios');

async function testActiveDeliveriesAPI() {
  try {
    console.log('🧪 Testing /api/delivery/active endpoint...');
    
    // Token de Carlos Delivery (puedes usar el que tengas guardado)
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OWQxMmE4ZmUwMTUxMWZhOTA5MmUyZCIsImlhdCI6MTc1NTM5NTc1NiwiZXhwIjoxNzU2MDAwNTU2fQ.lzzbX2FCmq9H-1HfI_GO6UhAGrFKtSHS0PJvJLho43E';
    
    const response = await axios.get('http://localhost:5000/api/delivery/active', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Respuesta exitosa:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    // Verificar la estructura
    if (response.data.success) {
      const deliveries = response.data.data?.deliveries || [];
      console.log(`\n📊 Entregas activas encontradas: ${deliveries.length}`);
      
      deliveries.forEach((delivery, i) => {
        console.log(`  ${i + 1}. Order: ${delivery.orderId?.orderNumber || 'N/A'}`);
        console.log(`      Status: ${delivery.status}`);
        console.log(`      ID: ${delivery._id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testActiveDeliveriesAPI();