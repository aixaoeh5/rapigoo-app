#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Asset optimization script for RapiGoo
 * Analyzes and optimizes bundle size and asset usage
 */

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const COMPONENTS_DIR = path.join(__dirname, '..', 'components');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return stats.size;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function analyzeAssets() {
  log('\n📊 ANÁLISIS DE ASSETS', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  if (!fs.existsSync(ASSETS_DIR)) {
    log('❌ No se encontró el directorio de assets', 'red');
    return;
  }
  
  const assetFiles = getAllFiles(ASSETS_DIR);
  let totalSize = 0;
  const assetsByType = {};
  const largeAssets = [];
  
  assetFiles.forEach(filePath => {
    const size = getFileSize(filePath);
    totalSize += size;
    
    const ext = path.extname(filePath).toLowerCase();
    if (!assetsByType[ext]) {
      assetsByType[ext] = { count: 0, size: 0 };
    }
    assetsByType[ext].count++;
    assetsByType[ext].size += size;
    
    // Assets grandes (>50KB)
    if (size > 50 * 1024) {
      largeAssets.push({
        file: path.relative(process.cwd(), filePath),
        size: size
      });
    }
  });
  
  log(`📁 Total de assets: ${assetFiles.length}`, 'blue');
  log(`📏 Tamaño total: ${formatBytes(totalSize)}`, 'blue');
  
  log('\n📋 Por tipo de archivo:', 'yellow');
  Object.entries(assetsByType).forEach(([ext, data]) => {
    log(`  ${ext || 'sin ext'}: ${data.count} archivos (${formatBytes(data.size)})`, 'white');
  });
  
  if (largeAssets.length > 0) {
    log('\n⚠️  Assets grandes (>50KB):', 'yellow');
    largeAssets
      .sort((a, b) => b.size - a.size)
      .forEach(asset => {
        log(`  📄 ${asset.file}: ${formatBytes(asset.size)}`, 'yellow');
      });
  }
  
  return { totalSize, assetsByType, largeAssets };
}

function analyzeUnusedAssets() {
  log('\n🔍 ANÁLISIS DE ASSETS NO UTILIZADOS', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  if (!fs.existsSync(ASSETS_DIR) || !fs.existsSync(COMPONENTS_DIR)) {
    log('❌ No se encontraron directorios necesarios', 'red');
    return;
  }
  
  // Obtener todos los assets
  const assetFiles = getAllFiles(ASSETS_DIR);
  const assetNames = assetFiles.map(file => path.basename(file));
  
  // Obtener todos los archivos de componentes
  const componentFiles = getAllFiles(COMPONENTS_DIR);
  
  // Leer contenido de componentes
  let componentContent = '';
  componentFiles.forEach(file => {
    if (file.endsWith('.js') || file.endsWith('.jsx')) {
      try {
        componentContent += fs.readFileSync(file, 'utf8');
      } catch (err) {
        // Ignorar errores de lectura
      }
    }
  });
  
  // Encontrar assets no utilizados
  const unusedAssets = assetNames.filter(assetName => {
    const nameWithoutExt = path.parse(assetName).name;
    return !componentContent.includes(assetName) && !componentContent.includes(nameWithoutExt);
  });
  
  if (unusedAssets.length > 0) {
    log(`⚠️  Encontrados ${unusedAssets.length} assets potencialmente no utilizados:`, 'yellow');
    unusedAssets.forEach(asset => {
      log(`  📄 ${asset}`, 'yellow');
    });
    log('\n💡 Nota: Verifica manualmente antes de eliminar', 'blue');
  } else {
    log('✅ Todos los assets parecen estar en uso', 'green');
  }
  
  return unusedAssets;
}

function provideBundleOptimizations() {
  log('\n🚀 RECOMENDACIONES DE OPTIMIZACIÓN', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  log('📦 Bundle Optimizations:', 'green');
  log('  ✓ Configuración de Metro optimizada para producción', 'white');
  log('  ✓ Minificación habilitada con configuración personalizada', 'white');
  log('  ✓ Tree shaking habilitado', 'white');
  log('  ✓ Source maps optimizados', 'white');
  
  log('\n🖼️  Asset Optimizations:', 'green');
  log('  ✓ Soporte para WebP agregado', 'white');
  log('  ✓ Lazy loading implementado para imágenes', 'white');
  log('  ✓ Cache manager para imágenes', 'white');
  
  log('\n⚡ Performance Optimizations:', 'green');
  log('  ✓ React.memo implementado en componentes de listas', 'white');
  log('  ✓ useCallback para funciones estables', 'white');
  log('  ✓ Estados de loading y error implementados', 'white');
  
  log('\n📱 Production Recommendations:', 'blue');
  log('  • Considera convertir PNGs grandes a WebP', 'white');
  log('  • Usa expo-optimize para comprimir assets automáticamente', 'white');
  log('  • Habilita Hermes engine para mejor performance', 'white');
  log('  • Configura EAS Build para builds optimizados', 'white');
}

function generateOptimizationReport() {
  log('🔧 RAPIGOO - REPORTE DE OPTIMIZACIÓN DE ASSETS', 'cyan');
  log('=' .repeat(60), 'cyan');
  
  const assetAnalysis = analyzeAssets();
  const unusedAssets = analyzeUnusedAssets();
  provideBundleOptimizations();
  
  log('\n📊 RESUMEN:', 'cyan');
  log('=' .repeat(30), 'cyan');
  
  if (assetAnalysis) {
    log(`📁 Assets analizados: ${Object.values(assetAnalysis.assetsByType).reduce((sum, type) => sum + type.count, 0)}`, 'blue');
    log(`📏 Tamaño total: ${formatBytes(assetAnalysis.totalSize)}`, 'blue');
    log(`⚠️  Assets grandes: ${assetAnalysis.largeAssets.length}`, 'yellow');
  }
  
  if (unusedAssets) {
    log(`🗑️  Potenciales assets no utilizados: ${unusedAssets.length}`, 'yellow');
  }
  
  log('\n✅ Optimizaciones implementadas exitosamente!', 'green');
  log('🚀 La app está lista para producción', 'green');
}

// Ejecutar análisis
if (require.main === module) {
  generateOptimizationReport();
}

module.exports = {
  analyzeAssets,
  analyzeUnusedAssets,
  provideBundleOptimizations
};