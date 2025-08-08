/**
 * Test rápido para verificar que el login funcione
 * Ejecutar con: node testLogin.js
 */

const axios = require('axios');

async function testBackendConnection() {
  console.log('🔄 Probando conexión con el backend...\n');

  try {
    // 1. Test básico del servidor
    console.log('1. ✅ Verificando que el servidor esté corriendo...');
    const healthResponse = await axios.get('http://localhost:5000/');
    console.log('   ✅ Servidor respondiendo:', healthResponse.data?.message || 'OK');

    // 2. Test status desarrollo
    console.log('\n2. ✅ Verificando endpoints de desarrollo...');
    const statusResponse = await axios.get('http://localhost:5000/api/test/email-status');
    console.log('   ✅ Email service status:', statusResponse.data.emailService.mode);

    // 3. Test login con usuario de prueba
    console.log('\n3. ✅ Probando login con usuario de prueba...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'cliente@test.com',
      password: 'test123'
    });
    console.log('   ✅ Login exitoso!');
    console.log('   👤 Usuario:', loginResponse.data.user.name);
    console.log('   🎭 Rol:', loginResponse.data.user.role);
    console.log('   🔑 Token recibido:', loginResponse.data.token ? 'SÍ' : 'NO');

    console.log('\n🎉 ¡Todo funciona correctamente!');
    console.log('\n💡 Ahora prueba en la app:');
    console.log('   📧 Email: cliente@test.com');
    console.log('   🔒 Password: test123');

  } catch (error) {
    console.error('\n❌ Error durante las pruebas:');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   🚫 No se puede conectar al backend');
      console.error('   💡 Solución: Ejecuta "npm run dev" o "cd backend && npm start"');
    } else if (error.response) {
      console.error('   📄 Status:', error.response.status);
      console.error('   📄 Error:', error.response.data?.message || error.response.data);
    } else {
      console.error('   📄 Error:', error.message);
    }

    console.log('\n🔍 Debugging checklist:');
    console.log('   □ ¿Está el backend corriendo en puerto 5000?');
    console.log('   □ ¿MongoDB está conectado?');
    console.log('   □ ¿Los usuarios de prueba están creados?');
    console.log('   □ ¿Las variables de entorno están configuradas?');
  }
}

// Ejecutar test
testBackendConnection();