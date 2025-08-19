#!/usr/bin/env node

/**
 * FIX: Script para configurar restricciones de API Keys de Google Maps
 * Ejecutar: node scripts/secure-api-keys.js
 */

const fs = require('fs');
const path = require('path');

// FIX: Configuración de restricciones para API Keys
const API_KEY_CONFIG = {
    android: {
        packageName: 'com.rapigoo.delivery',
        sha1_debug: 'XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX', // Reemplazar con tu SHA-1 debug
        sha1_release: 'YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY:YY', // Reemplazar con tu SHA-1 release
        apis: [
            'Maps SDK for Android',
            'Places API',
            'Directions API',
            'Geocoding API'
        ]
    },
    ios: {
        bundleId: 'com.rapigoo.delivery',
        apis: [
            'Maps SDK for iOS',
            'Places API',
            'Directions API',
            'Geocoding API'
        ]
    }
};

console.log('🔐 Configuración de Restricciones de API Keys para RapiGoo\n');
console.log('📋 INSTRUCCIONES PARA GOOGLE CLOUD CONSOLE:\n');
console.log('1. Ve a https://console.cloud.google.com/apis/credentials\n');
console.log('2. Selecciona tu proyecto de RapiGoo\n');
console.log('3. Para cada API Key, aplica las siguientes restricciones:\n');

console.log('\n📱 ANDROID API KEY:');
console.log('================================');
console.log('Restricciones de aplicación:');
console.log(`  - Tipo: Apps para Android`);
console.log(`  - Package name: ${API_KEY_CONFIG.android.packageName}`);
console.log(`  - SHA-1 fingerprint (debug): ${API_KEY_CONFIG.android.sha1_debug}`);
console.log(`  - SHA-1 fingerprint (release): ${API_KEY_CONFIG.android.sha1_release}`);
console.log('\nRestricciones de API:');
API_KEY_CONFIG.android.apis.forEach(api => {
    console.log(`  ✓ ${api}`);
});

console.log('\n🍎 iOS API KEY:');
console.log('================================');
console.log('Restricciones de aplicación:');
console.log(`  - Tipo: Apps para iOS`);
console.log(`  - Bundle ID: ${API_KEY_CONFIG.ios.bundleId}`);
console.log('\nRestricciones de API:');
API_KEY_CONFIG.ios.apis.forEach(api => {
    console.log(`  ✓ ${api}`);
});

console.log('\n⚠️  OBTENER SHA-1 FINGERPRINTS:');
console.log('================================');
console.log('Debug SHA-1:');
console.log('  cd android && ./gradlew signingReport');
console.log('\nRelease SHA-1:');
console.log('  keytool -list -v -keystore [tu-keystore.jks] -alias [tu-alias]');

console.log('\n🔒 MEJORES PRÁCTICAS:');
console.log('================================');
console.log('1. Nunca commits API keys sin restricciones');
console.log('2. Usa variables de entorno para keys sensibles');
console.log('3. Rota las keys regularmente');
console.log('4. Monitorea el uso en GCP Console');
console.log('5. Configura alertas de cuota');

// FIX: Crear archivo .env.example si no existe
const envExamplePath = path.join(__dirname, '..', '.env.example');
const envContent = `# Google Maps API Keys (con restricciones aplicadas)
GOOGLE_MAPS_API_KEY_ANDROID=your_restricted_android_key_here
GOOGLE_MAPS_API_KEY_IOS=your_restricted_ios_key_here

# Backend API
API_URL=https://api.rapigoo.com
SOCKET_URL=wss://api.rapigoo.com

# Environment
NODE_ENV=production
`;

if (!fs.existsSync(envExamplePath)) {
    fs.writeFileSync(envExamplePath, envContent);
    console.log('\n✅ Archivo .env.example creado');
}

console.log('\n📝 VERIFICACIÓN DE RESTRICCIONES:');
console.log('================================');
console.log('Ejecuta este comando para verificar las restricciones:');
console.log('curl -X GET "https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway&key=YOUR_API_KEY"');
console.log('\nSi las restricciones están bien configuradas, deberías ver:');
console.log('- ✅ Desde la app: Respuesta exitosa');
console.log('- ❌ Desde otro origen: "API key not valid"');

console.log('\n✨ Script completado!');