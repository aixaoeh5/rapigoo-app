#!/usr/bin/env node

/**
 * Script de configuración inicial para desarrolladores
 * Ejecutar con: node scripts/setup-dev.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log('🚀 Configuración inicial de Rapigoo App\n');
console.log('Este script configurará automáticamente el proyecto.');
console.log('La detección de IP es automática con Expo.\n');

async function setup() {
  try {
    // 1. Verificar que estamos en el directorio correcto
    if (!fs.existsSync('package.json')) {
      console.error('❌ Error: Ejecuta este script desde la raíz del proyecto');
      process.exit(1);
    }

    // 2. Verificar .env del backend
    const backendEnvPath = path.join('backend', '.env');
    if (!fs.existsSync(backendEnvPath)) {
      console.log('📋 Creando archivo backend/.env...');
      
      const envContent = `PORT=5000
MONGO_URI=mongodb+srv://christ1913:pinguino27@cluster0.gvxd2gm.mongodb.net/rapigoo_db?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=dev_jwt_secret_${Math.random().toString(36).substring(7)}

# Configuración de Email (ver SETUP_PHASES.md - Fase 2)
EMAIL_USER=
EMAIL_PASS=

# Modo desarrollo
NODE_ENV=development
SHOW_VERIFICATION_CODES=true
`;
      fs.writeFileSync(backendEnvPath, envContent);
      console.log('✅ Archivo backend/.env creado');
    } else {
      console.log('✅ Archivo backend/.env ya existe');
    }

    // 3. Verificar si config/api.js existe
    if (fs.existsSync('config/api.js')) {
      console.log('✅ Configuración de API ya existe (detección automática habilitada)');
    }

    // 4. Instalar dependencias
    console.log('\n📦 Verificando dependencias...');
    const installDeps = await question('¿Instalar/actualizar dependencias? (s/n): ');
    
    if (installDeps.toLowerCase() === 's') {
      console.log('\nInstalando dependencias del frontend...');
      execSync('npm install', { stdio: 'inherit' });
      
      console.log('\nInstalando dependencias del backend...');
      execSync('cd backend && npm install', { stdio: 'inherit' });
      
      console.log('✅ Dependencias instaladas');
    }

    // 5. Mostrar resumen de configuración
    console.log('\n' + '='.repeat(50));
    console.log('✨ CONFIGURACIÓN COMPLETADA');
    console.log('='.repeat(50));
    console.log('\n📱 La app detectará automáticamente tu IP cuando uses Expo');
    console.log('🔧 No necesitas configurar IPs manualmente\n');
    
    console.log('Para iniciar el proyecto:\n');
    console.log('  Opción 1 (recomendado):');
    console.log('  npm run dev              # Inicia todo automáticamente\n');
    
    console.log('  Opción 2 (manual):');
    console.log('  Terminal 1: cd backend && npm start');
    console.log('  Terminal 2: npm start\n');
    
    console.log('📖 Para configuración avanzada, lee SETUP_PHASES.md');
    console.log('💡 Para inicio rápido, lee README_QUICKSTART.md\n');

  } catch (error) {
    console.error('❌ Error durante la configuración:', error.message);
  } finally {
    rl.close();
  }
}

setup();