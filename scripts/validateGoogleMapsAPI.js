// scripts/validateGoogleMapsAPI.js
const https = require('https');

const API_KEY = 'AIzaSyDqE-L2_sObvQVl5gWlJaRVF2rIzH5Ztkg';

function validateGoogleMapsAPI(apiKey) {
  return new Promise((resolve, reject) => {
    const testUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    
    https.get(testUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('🔍 Validando Google Maps API Key...');
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
        
        if (res.statusCode === 200) {
          if (data.includes('Google Maps JavaScript API') && !data.includes('MissingKeyMapError')) {
            console.log('✅ API Key válida y funcional');
            resolve({ valid: true, data });
          } else if (data.includes('RefererNotAllowedMapError')) {
            console.log('⚠️  API Key válida pero restringida por dominio');
            resolve({ valid: false, error: 'Restricción de dominio', data });
          } else if (data.includes('RequestDenied')) {
            console.log('❌ API Key inválida o sin permisos');
            resolve({ valid: false, error: 'Sin permisos', data });
          } else {
            console.log('⚠️  Respuesta inesperada:', data.substring(0, 200));
            resolve({ valid: false, error: 'Respuesta inesperada', data });
          }
        } else {
          console.log('❌ Error HTTP:', res.statusCode);
          resolve({ valid: false, error: `HTTP ${res.statusCode}`, data });
        }
      });
    }).on('error', (err) => {
      console.error('❌ Error de conexión:', err.message);
      reject(err);
    });
  });
}

async function checkGoogleMapsServices(apiKey) {
  const services = [
    {
      name: 'Maps JavaScript API',
      url: `https://maps.googleapis.com/maps/api/js?key=${apiKey}`
    },
    {
      name: 'Geocoding API',
      url: `https://maps.googleapis.com/maps/api/geocode/json?address=Santo+Domingo&key=${apiKey}`
    },
    {
      name: 'Places API',
      url: `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurants&key=${apiKey}`
    }
  ];

  console.log('\n🔍 Verificando servicios de Google Maps...\n');

  for (const service of services) {
    try {
      const response = await new Promise((resolve, reject) => {
        https.get(service.url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
      });

      console.log(`📋 ${service.name}:`);
      console.log(`   Status: ${response.status}`);
      
      if (service.name === 'Geocoding API' || service.name === 'Places API') {
        try {
          const jsonData = JSON.parse(response.data);
          console.log(`   Status: ${jsonData.status}`);
          if (jsonData.error_message) {
            console.log(`   Error: ${jsonData.error_message}`);
          }
        } catch (e) {
          console.log(`   Data: ${response.data.substring(0, 100)}...`);
        }
      }
      console.log('');
    } catch (error) {
      console.log(`❌ ${service.name}: Error - ${error.message}\n`);
    }
  }
}

async function main() {
  console.log('🚀 Iniciando validación de Google Maps API\n');
  console.log(`🔑 API Key: ${API_KEY}\n`);

  try {
    const result = await validateGoogleMapsAPI(API_KEY);
    
    if (result.valid) {
      console.log('\n✅ Google Maps API Key configurada correctamente');
    } else {
      console.log(`\n❌ Problema con API Key: ${result.error}`);
      console.log('\n📋 Pasos para solucionar:');
      console.log('1. Ir a Google Cloud Console');
      console.log('2. Habilitar APIs necesarias: Maps JavaScript API, Geocoding API');
      console.log('3. Verificar restricciones de API key');
      console.log('4. Para desarrollo, remover restricciones temporalmente');
    }

    await checkGoogleMapsServices(API_KEY);

  } catch (error) {
    console.error('❌ Error durante validación:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateGoogleMapsAPI, checkGoogleMapsServices };