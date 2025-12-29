const mongoose = require('mongoose');
const DeliveryTracking = require('./models/DeliveryTracking');
const Order = require('./models/Order');
const User = require('./models/User');

async function fixDeliveryCoordinates() {
  try {
    require('dotenv').config();
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');
    
    console.log('🔧 CORRIGIENDO COORDENADAS DE DELIVERY TRACKING');
    console.log('===============================================');
    
    // 1. Buscar todos los delivery trackings con coordenadas de Lima (test)
    const trackingsWithTestCoords = await DeliveryTracking.find({
      $or: [
        { 'pickupLocation.coordinates': [-77.0428, -12.0464] },
        { 'deliveryLocation.coordinates': [-77.0328, -12.0364] }
      ]
    }).populate({
      path: 'orderId',
      populate: {
        path: 'merchantId',
        select: 'business.location business.address business.pickupAddress'
      }
    });
    
    console.log(`\n📋 Encontrados ${trackingsWithTestCoords.length} trackings con coordenadas de test`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const tracking of trackingsWithTestCoords) {
      console.log(`\n🔍 Procesando tracking: ${tracking._id}`);
      console.log(`   Order: ${tracking.orderId?.orderNumber || 'N/A'}`);
      
      let needsUpdate = false;
      const updates = {};
      
      // Verificar y corregir pickup coordinates
      if (JSON.stringify(tracking.pickupLocation.coordinates) === JSON.stringify([-77.0428, -12.0464])) {
        const merchant = tracking.orderId?.merchantId;
        if (merchant?.business?.location?.coordinates) {
          const realCoords = merchant.business.location.coordinates;
          console.log(`   📍 Corrigiendo pickup: ${JSON.stringify(tracking.pickupLocation.coordinates)} → ${JSON.stringify(realCoords)}`);
          updates['pickupLocation.coordinates'] = realCoords;
          
          // También actualizar la dirección si es necesaria
          if (tracking.pickupLocation.address === 'Restaurante Test') {
            const realAddress = merchant.business.pickupAddress?.street || 
                               merchant.business.address || 
                               'Dirección del comerciante';
            updates['pickupLocation.address'] = realAddress;
            console.log(`   📝 Corrigiendo pickup address: "Restaurante Test" → "${realAddress}"`);
          }
          
          needsUpdate = true;
        } else {
          console.log(`   ⚠️ Warning: No se encontraron coordenadas reales del comerciante`);
        }
      }
      
      // Verificar y corregir delivery coordinates
      if (JSON.stringify(tracking.deliveryLocation.coordinates) === JSON.stringify([-77.0328, -12.0364])) {
        const order = tracking.orderId;
        // Buscar coordenadas en diferentes ubicaciones posibles
        const realCoords = order?.deliveryInfo?.coordinates || 
                          order?.deliveryInfo?.address?.coordinates ||
                          order?.deliveryAddress?.coordinates;
        
        if (realCoords) {
          console.log(`   🏠 Corrigiendo delivery: ${JSON.stringify(tracking.deliveryLocation.coordinates)} → ${JSON.stringify(realCoords)}`);
          updates['deliveryLocation.coordinates'] = realCoords;
          
          // También actualizar la dirección si es necesaria
          if (tracking.deliveryLocation.address === 'Cliente Test') {
            const realAddress = order.deliveryInfo?.address?.street ? 
              `${order.deliveryInfo.address.street}, ${order.deliveryInfo.address.city}` : 
              order.deliveryAddress?.address ||
              'Dirección del cliente';
            updates['deliveryLocation.address'] = realAddress;
            console.log(`   📝 Corrigiendo delivery address: "Cliente Test" → "${realAddress}"`);
          }
          
          needsUpdate = true;
        } else {
          console.log(`   ⚠️ Warning: No se encontraron coordenadas reales del cliente`);
        }
      }
      
      // Aplicar actualizaciones
      if (needsUpdate) {
        await DeliveryTracking.findByIdAndUpdate(tracking._id, updates);
        console.log(`   ✅ Tracking actualizado`);
        updatedCount++;
      } else {
        console.log(`   ⏭️ Sin cambios necesarios`);
        skippedCount++;
      }
    }
    
    console.log('\n📊 RESUMEN DE CORRECCIONES:');
    console.log(`Trackings encontrados: ${trackingsWithTestCoords.length}`);
    console.log(`Trackings actualizados: ${updatedCount}`);
    console.log(`Trackings sin cambios: ${skippedCount}`);
    
    // 2. Verificar resultados
    console.log('\n🔍 VERIFICACIÓN POST-CORRECCIÓN:');
    const remainingTestCoords = await DeliveryTracking.find({
      $or: [
        { 'pickupLocation.coordinates': [-77.0428, -12.0464] },
        { 'deliveryLocation.coordinates': [-77.0328, -12.0364] }
      ]
    });
    
    console.log(`Trackings con coordenadas de test restantes: ${remainingTestCoords.length}`);
    
    if (remainingTestCoords.length > 0) {
      console.log('\n⚠️ Trackings que aún tienen coordenadas de test:');
      remainingTestCoords.forEach((tracking, i) => {
        console.log(`  ${i + 1}. ID: ${tracking._id}`);
        console.log(`     Pickup: ${JSON.stringify(tracking.pickupLocation.coordinates)}`);
        console.log(`     Delivery: ${JSON.stringify(tracking.deliveryLocation.coordinates)}`);
      });
    }
    
    console.log('\n✅ Proceso de corrección completado');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  fixDeliveryCoordinates();
}

module.exports = { fixDeliveryCoordinates };