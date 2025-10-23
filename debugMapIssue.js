#!/usr/bin/env node
/**
 * Script de diagnóstico para el problema del mapa en blanco en DeliveryNavigationScreen
 * Analiza los datos típicos que llegan al componente y simula el flujo de renderizado
 */

console.log('🔍 === DIAGNÓSTICO DEL MAPA EN BLANCO ===\n');

// Simulación de datos típicos que llegan al componente
const mockDeliveryData = {
  _id: "60f1b2c4e1d4f21234567890",
  status: "assigned",
  pickupLocation: {
    coordinates: [-69.9312, 18.4861], // [longitude, latitude] - formato MongoDB
    address: "Calle Principal #123, Santo Domingo"
  },
  deliveryLocation: {
    coordinates: [-69.9200, 18.4900], // [longitude, latitude] - formato MongoDB  
    address: "Avenida Central #456, Santo Domingo"
  },
  currentLocation: null // Inicialmente null
};

// Simulación del estado inicial del componente
let currentLocation = null;
let mapLoaded = false;
let mapError = null;
let deliveryStatus = "assigned";

console.log('1️⃣ ESTADO INICIAL DEL COMPONENTE:');
console.log('   - deliveryData:', !!mockDeliveryData);
console.log('   - currentLocation:', currentLocation);
console.log('   - mapLoaded:', mapLoaded);
console.log('   - mapError:', mapError);
console.log('   - deliveryStatus:', deliveryStatus);

// Simulación de getNextWaypoint
const getNextWaypoint = (currentStatus, pickupCoords, deliveryCoords) => {
  console.log('\n2️⃣ EVALUANDO getNextWaypoint:');
  console.log('   - currentStatus:', currentStatus);
  console.log('   - pickupCoords:', pickupCoords);
  console.log('   - deliveryCoords:', deliveryCoords);
  
  switch (currentStatus) {
    case 'assigned':
    case 'heading_to_pickup':
      const pickupWaypoint = {
        coordinates: pickupCoords,
        type: 'pickup',
        address: 'Restaurante'
      };
      console.log('   - Resultado: waypoint pickup');
      return pickupWaypoint;
    
    case 'picked_up':
    case 'heading_to_delivery':
      const deliveryWaypoint = {
        coordinates: deliveryCoords,
        type: 'delivery', 
        address: 'Cliente'
      };
      console.log('   - Resultado: waypoint delivery');
      return deliveryWaypoint;
    
    default:
      console.log('   - Resultado: null (estado no maneja waypoint)');
      return null;
  }
};

// Simulación de getMapRegion
const getMapRegion = () => {
  console.log('\n3️⃣ EVALUANDO getMapRegion:');
  console.log('   - currentLocation:', currentLocation);
  
  if (!currentLocation) {
    console.log('   - Sin currentLocation, usando coordenadas por defecto de Santo Domingo');
    return {
      latitude: 18.4861,
      longitude: -69.9312,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }

  console.log('   - Usando currentLocation para mapa:', currentLocation);
  
  const waypoint = getNextWaypoint(
    deliveryStatus,
    mockDeliveryData.pickupLocation?.coordinates,
    mockDeliveryData.deliveryLocation?.coordinates
  );

  if (waypoint) {
    const lat1 = currentLocation.latitude;
    const lon1 = currentLocation.longitude;
    const lat2 = waypoint.coordinates[1]; // PROBLEMA POTENCIAL: indices
    const lon2 = waypoint.coordinates[0]; // PROBLEMA POTENCIAL: indices
    
    console.log('   - Calculando región con waypoint:', {
      currentLat: lat1,
      currentLon: lon1,
      waypointLat: lat2,
      waypointLon: lon2
    });

    return {
      latitude: (lat1 + lat2) / 2,
      longitude: (lon1 + lon2) / 2,
      latitudeDelta: Math.abs(lat1 - lat2) * 1.5 || 0.05,
      longitudeDelta: Math.abs(lon1 - lon2) * 1.5 || 0.05,
    };
  }

  return {
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
};

// Simulación del currentWaypoint para marcadores
const getCurrentWaypoint = () => {
  console.log('\n4️⃣ EVALUANDO currentWaypoint para marcadores:');
  return getNextWaypoint(
    deliveryStatus,
    mockDeliveryData.pickupLocation?.coordinates,
    mockDeliveryData.deliveryLocation?.coordinates
  );
};

// Diagnóstico paso a paso
console.log('\n🔬 === ANÁLISIS PASO A PASO ===');

// Paso 1: Verificar condiciones de renderizado
const shouldRenderMap = !mapError;
console.log('\n📍 CONDICIÓN DE RENDERIZADO:');
console.log('   - !mapError =', shouldRenderMap);
console.log('   - Se renderiza MapView:', shouldRenderMap);

if (shouldRenderMap) {
  // Paso 2: Evaluar región del mapa
  const region = getMapRegion();
  console.log('\n📍 REGIÓN DEL MAPA:');
  console.log('   - Región calculada:', JSON.stringify(region, null, 6));
  
  // Paso 3: Validar coordenadas
  const isValidRegion = 
    region.latitude >= -90 && region.latitude <= 90 &&
    region.longitude >= -180 && region.longitude <= 180 &&
    region.latitudeDelta > 0 && region.longitudeDelta > 0;
  
  console.log('   - Región válida:', isValidRegion);
  
  // Paso 4: Verificar marcadores
  const waypoint = getCurrentWaypoint();
  console.log('\n📍 MARCADORES:');
  console.log('   - waypoint existe:', !!waypoint);
  console.log('   - mapLoaded:', mapLoaded);
  console.log('   - Marcadores se renderizan:', mapLoaded && waypoint);
  
  if (waypoint) {
    const markerCoordinates = {
      latitude: waypoint.coordinates[1],  // PROBLEMA: acceso directo a índices
      longitude: waypoint.coordinates[0]  // PROBLEMA: acceso directo a índices
    };
    console.log('   - Coordenadas del marcador:', markerCoordinates);
    
    // Verificar si las coordenadas del marcador son válidas
    const validMarkerCoords = 
      waypoint.coordinates && 
      Array.isArray(waypoint.coordinates) &&
      waypoint.coordinates.length === 2 &&
      typeof waypoint.coordinates[0] === 'number' &&
      typeof waypoint.coordinates[1] === 'number';
      
    console.log('   - Coordenadas marcador válidas:', validMarkerCoords);
  }
}

// Simulación de ubicación llegando después
console.log('\n🔄 === SIMULACIÓN: UBICACIÓN LLEGA DESPUÉS ===');
setTimeout(() => {
  currentLocation = {
    latitude: 18.4850,
    longitude: -69.9300,
    accuracy: 10
  };
  
  console.log('\n📍 ESTADO DESPUÉS DE OBTENER UBICACIÓN:');
  console.log('   - currentLocation:', currentLocation);
  
  const newRegion = getMapRegion();
  console.log('   - Nueva región:', JSON.stringify(newRegion, null, 6));
  
  // Simular mapa cargado
  mapLoaded = true;
  console.log('   - mapLoaded:', mapLoaded);
  
  const waypoint = getCurrentWaypoint();
  console.log('   - Marcadores ahora se renderizan:', mapLoaded && waypoint);
  
  console.log('\n🎯 === PROBLEMAS IDENTIFICADOS ===');
  
  // Problema 1: Mapeo de coordenadas
  if (waypoint) {
    console.log('\n❌ PROBLEMA 1: Formato de coordenadas');
    console.log('   - MongoDB almacena: [longitude, latitude]');
    console.log('   - Datos recibidos:', waypoint.coordinates);
    console.log('   - Acceso actual: coordinates[1] para lat, coordinates[0] para lng');
    console.log('   - ¿Coincide el formato?', 
      typeof waypoint.coordinates[0] === 'number' && 
      typeof waypoint.coordinates[1] === 'number');
  }
  
  console.log('\n❌ PROBLEMA 2: Condiciones de renderizado');
  console.log('   - MapView se renderiza incluso si currentLocation es null');
  console.log('   - Marcadores solo aparecen si mapLoaded && waypoint');
  console.log('   - ¿Puede el mapa aparecer vacío? SÍ');
  
  console.log('\n❌ PROBLEMA 3: Timing de inicialización');
  console.log('   - MapView puede renderizarse antes que:');
  console.log('     - currentLocation esté disponible');
  console.log('     - mapLoaded sea true');
  console.log('     - deliveryData esté completo');
  
  console.log('\n✅ === SOLUCIONES RECOMENDADAS ===');
  console.log('\n1. Validación de coordenadas:');
  console.log('   - Verificar formato antes de usar waypoint.coordinates');
  console.log('   - Agregar fallback si coordenadas son inválidas');
  
  console.log('\n2. Condiciones de renderizado:');
  console.log('   - Solo renderizar MapView cuando datos esenciales estén listos');
  console.log('   - Agregar loading state hasta que todo esté preparado');
  
  console.log('\n3. Mejor manejo de estados:');
  console.log('   - Combinar currentLocation, deliveryData y mapLoaded');
  console.log('   - Mostrar loading hasta que componente esté completamente listo');
  
  console.log('\n🔧 === DIAGNÓSTICO COMPLETADO ===');
  
}, 100);