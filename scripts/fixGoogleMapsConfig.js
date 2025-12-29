// scripts/fixGoogleMapsConfig.js
const fs = require('fs');
const path = require('path');

const API_KEY = 'AIzaSyDqE-L2_sObvQVl5gWlJaRVF2rIzH5Ztkg';

function updateAndroidManifest() {
  const manifestPath = path.join(__dirname, '../android/app/src/main/AndroidManifest.xml');
  
  console.log('🔧 Actualizando AndroidManifest.xml...');
  
  try {
    let manifest = fs.readFileSync(manifestPath, 'utf8');
    
    // Verificar si ya existe la configuración de API key
    if (manifest.includes('com.google.android.geo.API_KEY')) {
      console.log('✅ API Key ya configurada en AndroidManifest.xml');
    } else {
      console.log('📝 Agregando API Key a AndroidManifest.xml...');
      
      // Insertar API key antes del closing tag de application
      const apiKeyConfig = `    <meta-data
      android:name="com.google.android.geo.API_KEY"
      android:value="${API_KEY}"/>
    <meta-data
      android:name="com.google.android.gms.maps.v2.API_KEY"
      android:value="${API_KEY}"/>
  </application>`;
      
      manifest = manifest.replace('  </application>', apiKeyConfig);
      fs.writeFileSync(manifestPath, manifest);
      console.log('✅ API Key agregada a AndroidManifest.xml');
    }
  } catch (error) {
    console.error('❌ Error actualizando AndroidManifest.xml:', error.message);
  }
}

function updateAppJson() {
  const appJsonPath = path.join(__dirname, '../app.json');
  
  console.log('🔧 Actualizando app.json...');
  
  try {
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    
    // Configurar para Android
    if (!appJson.expo.android) {
      appJson.expo.android = {};
    }
    if (!appJson.expo.android.config) {
      appJson.expo.android.config = {};
    }
    
    appJson.expo.android.config.googleMaps = {
      apiKey: API_KEY
    };
    
    // Configurar para iOS
    if (!appJson.expo.ios) {
      appJson.expo.ios = {};
    }
    if (!appJson.expo.ios.config) {
      appJson.expo.ios.config = {};
    }
    
    appJson.expo.ios.config.googleMapsApiKey = API_KEY;
    
    // Agregar permisos de ubicación si no existen
    if (!appJson.expo.plugins) {
      appJson.expo.plugins = [];
    }
    
    const locationPlugin = appJson.expo.plugins.find(plugin => 
      Array.isArray(plugin) && plugin[0] === 'expo-location'
    );
    
    if (!locationPlugin) {
      appJson.expo.plugins.push([
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "This app needs access to location for delivery tracking.",
          "locationAlwaysPermission": "This app needs access to location for delivery tracking.",
          "locationWhenInUsePermission": "This app needs access to location for delivery tracking.",
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true
        }
      ]);
      console.log('📍 Permisos de ubicación agregados');
    }
    
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log('✅ app.json actualizado');
    
  } catch (error) {
    console.error('❌ Error actualizando app.json:', error.message);
  }
}

function createMapConfig() {
  const configPath = path.join(__dirname, '../config/mapConfig.js');
  
  console.log('🗺️ Verificando configuración de mapa...');
  
  if (fs.existsSync(configPath)) {
    console.log('✅ config/mapConfig.js ya existe');
    return;
  }
  
  const mapConfig = `// config/mapConfig.js
import { Platform } from 'react-native';

export const MAP_CONFIG = {
  // Configuración de Google Maps
  apiKey: '${API_KEY}',
  
  // Configuración por defecto para República Dominicana
  defaultRegion: {
    latitude: 18.4861,   // Santo Domingo
    longitude: -69.9312,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  },
  
  // Configuración del mapa
  mapOptions: {
    showsUserLocation: true,
    showsMyLocationButton: true,
    showsCompass: true,
    showsScale: true,
    showsBuildings: true,
    showsTraffic: false,
    showsIndoors: true,
    rotateEnabled: true,
    scrollEnabled: true,
    zoomEnabled: true,
    pitchEnabled: true,
    mapType: 'standard', // 'standard', 'satellite', 'hybrid', 'terrain'
  },
  
  // Configuración de marcadores
  markerConfig: {
    pickup: {
      pinColor: '#FF9800',
      title: 'Punto de Recogida',
      icon: '🏪'
    },
    delivery: {
      pinColor: '#4CAF50', 
      title: 'Punto de Entrega',
      icon: '🏠'
    },
    current: {
      pinColor: '#2196F3',
      title: 'Tu ubicación',
      icon: '📍'
    }
  },
  
  // Configuración de permisos
  locationPermissions: {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000,
    distanceFilter: 10,
  },
  
  // Configuración específica por plataforma
  platform: {
    android: {
      provider: 'google',
      showsMyLocationButton: true,
    },
    ios: {
      provider: 'google',
      showsPointsOfInterest: true,
    }
  }
};

// Función helper para obtener configuración del mapa
export const getMapConfig = () => {
  const baseConfig = {
    ...MAP_CONFIG.mapOptions,
    initialRegion: MAP_CONFIG.defaultRegion,
  };

  // Agregar configuración específica de plataforma
  if (Platform.OS === 'android') {
    return {
      ...baseConfig,
      ...MAP_CONFIG.platform.android,
    };
  } else if (Platform.OS === 'ios') {
    return {
      ...baseConfig,
      ...MAP_CONFIG.platform.ios,
    };
  }

  return baseConfig;
};

// Función helper para obtener estilos de marcador
export const getMarkerStyle = (type) => {
  return MAP_CONFIG.markerConfig[type] || MAP_CONFIG.markerConfig.current;
};

// Función helper para validar API key
export const isMapConfigured = () => {
  return !!MAP_CONFIG.apiKey && MAP_CONFIG.apiKey !== '';
};

export default MAP_CONFIG;
`;

  // Crear directorio config si no existe
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log('📁 Directorio config creado');
  }
  
  fs.writeFileSync(configPath, mapConfig);
  console.log('✅ config/mapConfig.js creado');
}

function checkReactNativeMapsInstallation() {
  const packageJsonPath = path.join(__dirname, '../package.json');
  
  console.log('📦 Verificando instalación de react-native-maps...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (packageJson.dependencies && packageJson.dependencies['react-native-maps']) {
      console.log(`✅ react-native-maps está instalado: ${packageJson.dependencies['react-native-maps']}`);
    } else {
      console.log('⚠️  react-native-maps no encontrado en dependencies');
      console.log('💡 Ejecuta: npm install react-native-maps');
    }
  } catch (error) {
    console.error('❌ Error verificando package.json:', error.message);
  }
}

function generateFixSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMEN DE CONFIGURACIÓN DE GOOGLE MAPS');
  console.log('='.repeat(60));
  console.log(`🔑 API Key: ${API_KEY}`);
  console.log('📱 Plataformas configuradas: Android, iOS');
  console.log('🗺️ Proveedor: Google Maps');
  console.log('📍 Región por defecto: Santo Domingo, República Dominicana');
  console.log('\n💡 PASOS SIGUIENTES:');
  console.log('1. Reiniciar completamente la aplicación (cerrar y reabrir)');
  console.log('2. Si estás usando Expo Go, cambiar a desarrollo con npx expo run:android');
  console.log('3. Verificar que la API key tenga permisos para Maps JavaScript API');
  console.log('4. Usar el TestMapScreen para verificar que funciona correctamente');
  console.log('\n🔧 Para desarrollo local (sin restricciones):');
  console.log('• Ir a Google Cloud Console');
  console.log('• Encontrar la API key');
  console.log('• Quitar todas las restricciones temporalmente');
  console.log('• Habilitar: Maps JavaScript API, Android Maps API, iOS Maps API');
  console.log('='.repeat(60));
}

async function main() {
  console.log('🚀 Iniciando configuración de Google Maps...\n');
  
  checkReactNativeMapsInstallation();
  updateAndroidManifest();
  updateAppJson();
  createMapConfig();
  generateFixSummary();
  
  console.log('\n✅ Configuración completada!');
  console.log('🔄 Reinicia la aplicación para aplicar los cambios.');
}

if (require.main === module) {
  main();
}

module.exports = {
  updateAndroidManifest,
  updateAppJson, 
  createMapConfig,
  checkReactNativeMapsInstallation
};