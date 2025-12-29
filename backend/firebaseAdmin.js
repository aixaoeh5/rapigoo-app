const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Inicializar Firebase Admin de forma segura
let serviceAccount;

// Intentar cargar el archivo de credenciales
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

try {
  // Verificar si el archivo existe
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
  } else {
    console.error('⚠️  Archivo de credenciales de Firebase no encontrado');
    console.error('Por favor, coloca tu archivo firebase-service-account.json en la carpeta backend/');
    console.error('y asegúrate de que esté incluido en .gitignore');
    
    // En producción, podrías querer usar variables de entorno individuales
    if (process.env.NODE_ENV === 'production') {
      serviceAccount = {
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
      };
    }
  }
  
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin inicializado correctamente');
  } else {
    console.error('❌ No se pudo inicializar Firebase Admin - credenciales faltantes');
  }
} catch (error) {
  console.error('❌ Error al inicializar Firebase Admin:', error.message);
}

module.exports = admin;