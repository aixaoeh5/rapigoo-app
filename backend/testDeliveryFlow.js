const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Importar modelos
const Order = require('./models/Order');
const User = require('./models/User');
const DeliveryTracking = require('./models/DeliveryTracking');

async function testDeliveryFlow() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Conectado a MongoDB');
    
    // Buscar pedido de prueba
    const testOrder = await Order.findOne().populate('customerId merchantId');
    if (!testOrder) {
      console.log('❌ No hay pedidos para probar');
      process.exit(1);
    }
    
    // Buscar delivery person
    const deliveryPerson = await User.findOne({ role: 'delivery' });
    if (!deliveryPerson) {
      console.log('❌ No hay delivery persons disponibles');
      process.exit(1);
    }
    
    console.log(`📦 Pedido de prueba: ${testOrder.orderNumber}`);
    console.log(`🚚 Delivery person: ${deliveryPerson.name}`);
    
    // Buscar o crear delivery tracking
    let deliveryTracking = await DeliveryTracking.findOne({ orderId: testOrder._id });
    
    if (deliveryTracking) {
      console.log('📋 Usando delivery tracking existente');
      // NOTA: Resetear para la prueba con coordenadas de TEST (Lima, Peru)
      // ESTAS SON COORDENADAS DE PRUEBA - NO USAR EN PRODUCCIÓN
      deliveryTracking.status = 'assigned';
      deliveryTracking.pickupLocation = {
        coordinates: [-77.0428, -12.0464], // TEST COORDS: Lima, Peru - Restaurante
        address: 'Restaurante Test',
        arrived: false,
        arrivedAt: null
      };
      deliveryTracking.deliveryLocation = {
        coordinates: [-77.0328, -12.0364], // TEST COORDS: Lima, Peru - Cliente (1km al noreste)
        address: 'Cliente Test',
        arrived: false,
        arrivedAt: null
      };
      deliveryTracking.statusHistory = [{
        status: 'assigned',
        timestamp: new Date(),
        notes: 'Delivery asignado al pedido (reseteo para prueba)'
      }];
      deliveryTracking.isLive = true;
      await deliveryTracking.save();
      
      console.log(`   Pickup: ${deliveryTracking.pickupLocation.coordinates}`);
      console.log(`   Delivery: ${deliveryTracking.deliveryLocation.coordinates}`);
    } else {
      // Crear nuevo delivery tracking
      deliveryTracking = new DeliveryTracking({
        orderId: testOrder._id,
        deliveryPersonId: deliveryPerson._id,
        status: 'assigned',
        pickupLocation: {
          coordinates: [-77.0428, -12.0464], // TEST COORDS: Lima, Peru - Restaurante
          address: 'Restaurante Test'
        },
        deliveryLocation: {
          coordinates: [-77.0328, -12.0364], // TEST COORDS: Lima, Peru - Cliente (1km al noreste)
          address: 'Cliente Test'
        },
        isLive: true
      });
      
      await deliveryTracking.save();
      console.log('✅ Delivery tracking creado');
    }
    
    // Simular flujo completo con coordenadas cercanas a Lima
    const locations = [
      // Camino al pickup (acercándose gradualmente)
      { lat: -12.0500, lng: -77.0500, status: 'heading_to_pickup' }, // 4km del pickup
      { lat: -12.0480, lng: -77.0450, status: 'heading_to_pickup' }, // 2.5km del pickup
      { lat: -12.0465, lng: -77.0429, status: 'at_pickup' }, // ~50m del pickup - DEBERÍA DETECTAR LLEGADA
    ];
    
    // Simular más posiciones después de recoger el pedido (se agregará dinámicamente)
    const deliveryLocations = [
      // Salir del pickup y ir hacia delivery - estas se ejecutarán después de 'picked_up'
      { lat: -12.0460, lng: -77.0420, status: 'picked_up' }, // Saliendo del pickup
      { lat: -12.0400, lng: -77.0380, status: 'heading_to_delivery' }, // Camino al cliente
      { lat: -12.0365, lng: -77.0329, status: 'at_delivery' }, // ~50m del delivery - DEBERÍA DETECTAR LLEGADA
    ];
    
    console.log('\n🗺️ Simulando recorrido completo...\n');
    
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      
      console.log(`📍 Posición ${i + 1}: (${loc.lat}, ${loc.lng}) - Estado esperado: ${loc.status}`);
      
      // Actualizar ubicación
      const locationData = {
        longitude: loc.lng,
        latitude: loc.lat,
        accuracy: 10,
        speed: 15, // km/h
        heading: 90 // Este
      };
      
      const previousStatus = deliveryTracking.status;
      const statusChanged = deliveryTracking.updateLocation(locationData);
      await deliveryTracking.save();
      
      console.log(`   Estado anterior: ${previousStatus}`);
      console.log(`   Estado actual: ${deliveryTracking.status}`);
      
      if (deliveryTracking.status !== previousStatus) {
        console.log(`   ✅ Estado cambió automáticamente a: ${deliveryTracking.status}`);
        
        if (deliveryTracking.pickupLocation.arrived) {
          console.log(`   🎯 Llegada al pickup detectada: ${deliveryTracking.pickupLocation.arrivedAt}`);
        }
        
        if (deliveryTracking.deliveryLocation.arrived) {
          console.log(`   🏠 Llegada al delivery detectada: ${deliveryTracking.deliveryLocation.arrivedAt}`);
        }
      } else {
        console.log(`   ⚪ Estado sin cambios`);
      }
      
      // Pausa entre actualizaciones
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('');
    }
    
    // Mostrar historial de estados
    console.log('\n📋 Historial de estados:');
    deliveryTracking.statusHistory.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.status} - ${entry.timestamp} - ${entry.notes || 'Sin notas'}`);
    });
    
    // Completar delivery manualmente siguiendo el flujo correcto
    console.log('\n🏁 Completando delivery manualmente...');
    
    // Asegurar flujo correcto: at_pickup -> picked_up -> heading_to_delivery -> at_delivery -> delivered
    if (deliveryTracking.status === 'at_pickup') {
      console.log(`   Recogiendo pedido...`);
      await deliveryTracking.updateStatus('picked_up', 'Pedido recogido manualmente');
    }
    
    if (deliveryTracking.status === 'picked_up') {
      console.log(`   Iniciando viaje al cliente...`);
      await deliveryTracking.updateStatus('heading_to_delivery', 'Saliendo hacia el cliente');
    }
    
    if (deliveryTracking.status === 'heading_to_delivery') {
      console.log(`   Llegando al cliente...`);
      await deliveryTracking.updateStatus('at_delivery', 'Llegada manual al destino');
    }
    
    // Completar la entrega
    console.log(`   Completando entrega...`);
    await deliveryTracking.updateStatus('delivered', 'Entrega completada en prueba');
    
    console.log(`✅ Delivery completado. Estado final: ${deliveryTracking.status}`);
    console.log(`📊 Distancia total recorrida: ${deliveryTracking.totalDistance}km`);
    console.log(`⏱️ Tiempo total: ${deliveryTracking.actualTotalTime || 'No calculado'} minutos`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    process.exit(1);
  }
}

// Ejecutar la función
testDeliveryFlow();