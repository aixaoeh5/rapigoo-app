const fs = require('fs');
const path = require('path');

console.log('🔍 Ejecutando verificación de seguridad...\n');

let issues = 0;

// 1. Verificar que .env existe y no está vacío
console.log('1. Verificando archivo .env...');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Verificar credenciales por defecto peligrosas
  if (envContent.includes('midiosesopoderoso')) {
    console.log('   ❌ JWT_SECRET todavía usa el valor por defecto inseguro');
    issues++;
  } else {
    console.log('   ✅ JWT_SECRET ha sido cambiado');
  }
  
  if (envContent.includes('rxzhcunoxixdddnl')) {
    console.log('   ❌ EMAIL_PASS todavía usa el valor expuesto');
    issues++;
  } else {
    console.log('   ✅ EMAIL_PASS ha sido actualizado');
  }
  
  if (!envContent.includes('JWT_SECRET=') || envContent.includes('JWT_SECRET=\n')) {
    console.log('   ❌ JWT_SECRET está vacío');
    issues++;
  }
} else {
  console.log('   ❌ Archivo .env no encontrado');
  issues++;
}

// 2. Verificar que .gitignore incluye archivos sensibles
console.log('\n2. Verificando .gitignore...');
const gitignorePath = path.join(__dirname, '..', '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  const requiredEntries = ['.env', 'firebase-service-account.json', 'node_modules'];
  
  requiredEntries.forEach(entry => {
    if (gitignoreContent.includes(entry)) {
      console.log(`   ✅ ${entry} está en .gitignore`);
    } else {
      console.log(`   ❌ ${entry} NO está en .gitignore`);
      issues++;
    }
  });
} else {
  console.log('   ❌ Archivo .gitignore no encontrado');
  issues++;
}

// 3. Verificar que firebase-service-account.json NO está en el repo
console.log('\n3. Verificando credenciales de Firebase...');
const firebasePath = path.join(__dirname, '..', 'firebase-service-account.json');
if (fs.existsSync(firebasePath)) {
  console.log('   ⚠️  firebase-service-account.json existe - asegúrate de que esté en .gitignore');
  
  // Verificar si está trackeado por git
  const { execSync } = require('child_process');
  try {
    execSync(`git ls-files ${firebasePath}`, { stdio: 'pipe' });
    console.log('   ❌ firebase-service-account.json está siendo trackeado por git!');
    issues++;
  } catch (e) {
    console.log('   ✅ firebase-service-account.json NO está siendo trackeado por git');
  }
} else {
  console.log('   ℹ️  firebase-service-account.json no encontrado (configúralo cuando sea necesario)');
}

// 4. Verificar configuración de seguridad en server.js
console.log('\n4. Verificando configuración del servidor...');
const serverPath = path.join(__dirname, '..', 'server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

if (serverContent.includes('helmet')) {
  console.log('   ✅ Helmet está configurado');
} else {
  console.log('   ❌ Helmet NO está configurado');
  issues++;
}

if (serverContent.includes('express-rate-limit')) {
  console.log('   ✅ Rate limiting está configurado');
} else {
  console.log('   ❌ Rate limiting NO está configurado');
  issues++;
}

if (serverContent.includes('mongoSanitize')) {
  console.log('   ✅ Sanitización de MongoDB está configurada');
} else {
  console.log('   ❌ Sanitización de MongoDB NO está configurada');
  issues++;
}

// 5. Verificar validación en rutas
console.log('\n5. Verificando validación de datos...');
const authRoutesPath = path.join(__dirname, '..', 'routes', 'authRoutes.js');
const authRoutesContent = fs.readFileSync(authRoutesPath, 'utf8');

if (authRoutesContent.includes('validate(')) {
  console.log('   ✅ Validación Joi está implementada en rutas de auth');
} else {
  console.log('   ❌ Validación Joi NO está implementada');
  issues++;
}

// Resumen
console.log('\n' + '='.repeat(50));
if (issues === 0) {
  console.log('✅ ¡Todas las verificaciones de seguridad pasaron!');
} else {
  console.log(`❌ Se encontraron ${issues} problemas de seguridad`);
  console.log('\nAcciones requeridas:');
  console.log('1. Cambia TODAS las credenciales expuestas');
  console.log('2. Genera un App Password para Gmail');
  console.log('3. Asegúrate de que todos los archivos sensibles estén en .gitignore');
  console.log('4. Nunca subas credenciales a git');
}
console.log('='.repeat(50));

process.exit(issues > 0 ? 1 : 0);