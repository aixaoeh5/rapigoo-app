// scripts/testMapConfiguration.js
const fs = require('fs');
const path = require('path');

function checkConfigurationFiles() {
  const results = [];
  
  // 1. Verificar AndroidManifest.xml
  const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');
  try {
    const manifest = fs.readFileSync(manifestPath, 'utf8');
    const hasApiKey = manifest.includes('com.google.android.geo.API_KEY');
    const hasV2ApiKey = manifest.includes('com.google.android.gms.maps.v2.API_KEY');
    
    results.push({
      file: 'AndroidManifest.xml',
      status: hasApiKey && hasV2ApiKey ? 'success' : 'error',
      message: hasApiKey && hasV2ApiKey ? 'API Keys configuradas correctamente' : 'API Keys faltantes',
      details: { hasApiKey, hasV2ApiKey }
    });
  } catch (error) {
    results.push({
      file: 'AndroidManifest.xml',
      status: 'error',
      message: `Error leyendo archivo: ${error.message}`
    });
  }
  
  // 2. Verificar app.json
  const appJsonPath = path.join(__dirname, '../app.json');
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const hasAndroidConfig = appJson.expo.android?.config?.googleMaps?.apiKey;
    const hasIosConfig = appJson.expo.ios?.config?.googleMapsApiKey;
    const hasLocationPlugin = appJson.expo.plugins?.some(plugin => 
      Array.isArray(plugin) && plugin[0] === 'expo-location'
    );
    
    results.push({
      file: 'app.json',
      status: hasAndroidConfig && hasIosConfig && hasLocationPlugin ? 'success' : 'warning',
      message: `Android: ${hasAndroidConfig ? '✅' : '❌'}, iOS: ${hasIosConfig ? '✅' : '❌'}, Location: ${hasLocationPlugin ? '✅' : '❌'}`,
      details: { hasAndroidConfig, hasIosConfig, hasLocationPlugin }
    });
  } catch (error) {
    results.push({
      file: 'app.json',
      status: 'error',
      message: `Error leyendo archivo: ${error.message}`
    });
  }
  
  // 3. Verificar mapConfig.js
  const mapConfigPath = path.join(__dirname, '../config/mapConfig.js');
  try {
    const mapConfig = fs.readFileSync(mapConfigPath, 'utf8');
    const hasApiKey = mapConfig.includes('apiKey:') && !mapConfig.includes("apiKey: ''");
    const hasDefaultRegion = mapConfig.includes('defaultRegion');
    
    results.push({
      file: 'config/mapConfig.js',
      status: hasApiKey && hasDefaultRegion ? 'success' : 'warning',
      message: `API Key: ${hasApiKey ? '✅' : '❌'}, Region: ${hasDefaultRegion ? '✅' : '❌'}`,
      details: { hasApiKey, hasDefaultRegion }
    });
  } catch (error) {
    results.push({
      file: 'config/mapConfig.js',
      status: 'error',
      message: `Error leyendo archivo: ${error.message}`
    });
  }
  
  // 4. Verificar package.json
  const packageJsonPath = path.join(__dirname, '../package.json');
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const hasReactNativeMaps = packageJson.dependencies?.['react-native-maps'];
    const hasExpoLocation = packageJson.dependencies?.['expo-location'];
    
    results.push({
      file: 'package.json',
      status: hasReactNativeMaps ? 'success' : 'error',
      message: `Maps: ${hasReactNativeMaps || 'No instalado'}, Location: ${hasExpoLocation || 'No instalado'}`,
      details: { hasReactNativeMaps, hasExpoLocation }
    });
  } catch (error) {
    results.push({
      file: 'package.json',
      status: 'error',
      message: `Error leyendo archivo: ${error.message}`
    });
  }
  
  return results;
}

function generateReport(results) {
  console.log('\n' + '='.repeat(70));
  console.log('📋 REPORTE DE CONFIGURACIÓN DE GOOGLE MAPS');
  console.log('='.repeat(70));
  
  results.forEach(result => {
    const statusIcon = result.status === 'success' ? '✅' : 
                      result.status === 'warning' ? '⚠️' : '❌';
    
    console.log(`${statusIcon} ${result.file}:`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Detalles: ${JSON.stringify(result.details, null, 2)}`);
    }
    console.log('');
  });
  
  const successCount = results.filter(r => r.status === 'success').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  
  console.log('📊 RESUMEN:');
  console.log(`   ✅ Exitosos: ${successCount}`);
  console.log(`   ⚠️  Advertencias: ${warningCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
  
  if (errorCount === 0 && warningCount <= 1) {
    console.log('\n🎉 ¡Configuración completa! Los mapas deberían funcionar correctamente.');
    console.log('\n💡 SIGUIENTE PASO:');
    console.log('1. Reinicia completamente la aplicación');
    console.log('2. Ve a Dashboard > Probar Mapa');
    console.log('3. Cambia entre "Expo Map" y "Native Maps"');
    console.log('4. Si ves el logo de Google con fondo crema, la API key necesita más permisos');
  } else {
    console.log('\n⚠️  Hay problemas que necesitan ser resueltos.');
  }
  
  console.log('='.repeat(70));
}

function main() {
  console.log('🔍 Verificando configuración de Google Maps...');
  
  const results = checkConfigurationFiles();
  generateReport(results);
  
  console.log('\n🔧 Si los mapas aún no funcionan:');
  console.log('• Ejecuta: node scripts/fixGoogleMapsConfig.js');
  console.log('• Verifica permisos de API key en Google Cloud Console');
  console.log('• Para desarrollo: quita todas las restricciones de la API key');
  console.log('• Habilita: Maps JavaScript API, Android Maps API');
}

if (require.main === module) {
  main();
}

module.exports = { checkConfigurationFiles, generateReport };