const mongoose = require('mongoose');
const DeliveryTracking = require('./models/DeliveryTracking');

async function testParallelSaveFix() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    
    console.log('🧪 TESTING PARALLEL SAVE FIX');
    console.log('============================');
    
    // Buscar el delivery tracking específico que causó el error
    const trackingId = '689e25f486bbce237e328a5d';
    const tracking = await DeliveryTracking.findById(trackingId);
    
    if (!tracking) {
      console.log('❌ Delivery tracking no encontrado');
      return;
    }
    
    console.log('\n📋 DELIVERY TRACKING:');
    console.log('ID:', tracking._id);
    console.log('Status actual:', tracking.status);
    
    // Test 1: updateStatus con location (el caso que falló)
    console.log('\n🧪 Test 1: updateStatus con location');
    
    const originalStatus = tracking.status;
    
    try {
      const result = await tracking.updateStatus('heading_to_pickup', 'Test status update', {
        latitude: 18.4576806,
        longitude: -69.967104,
        accuracy: 22.5,
        speed: 0.06490875780582428,
        heading: 0
      });
      
      console.log('✅ updateStatus exitoso');
      console.log('Nuevo status:', tracking.status);
      
      // Restaurar status original
      tracking.status = originalStatus;
      await tracking.save();
      console.log('✅ Status restaurado a:', originalStatus);
      
    } catch (error) {
      console.log('❌ Error en updateStatus:', error.message);
      
      if (error.message.includes('ParallelSaveError')) {
        console.log('🚨 PARALLEL SAVE ERROR AÚN PRESENTE!');
      }
    }
    
    // Test 2: Multiple rapid calls (stress test)
    console.log('\n🧪 Test 2: Multiple rapid status updates');
    
    try {
      const promises = [];
      
      // Hacer 3 updates rápidos simultáneos
      for (let i = 0; i < 3; i++) {
        const promise = (async () => {
          const freshTracking = await DeliveryTracking.findById(trackingId);
          return freshTracking.updateStatus('heading_to_pickup', `Test concurrent ${i}`, {
            latitude: 18.4576806 + (i * 0.001),
            longitude: -69.967104 + (i * 0.001),
            accuracy: 22.5
          });
        })();
        
        promises.push(promise);
      }
      
      const results = await Promise.allSettled(promises);
      
      console.log('Resultados de updates concurrentes:');
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          console.log(`  ${i + 1}. ✅ Exitoso`);
        } else {
          console.log(`  ${i + 1}. ❌ Error: ${result.reason.message}`);
          if (result.reason.message.includes('ParallelSaveError')) {
            console.log('     🚨 PARALLEL SAVE ERROR DETECTADO!');
          }
        }
      });
      
    } catch (error) {
      console.log('❌ Error en test concurrente:', error.message);
    }
    
    // Test 3: Solo updateLocation
    console.log('\n🧪 Test 3: Solo updateLocation');
    
    try {
      const freshTracking = await DeliveryTracking.findById(trackingId);
      const statusChanged = freshTracking.updateLocation({
        latitude: 18.4576806,
        longitude: -69.967104,
        accuracy: 20
      });
      
      await freshTracking.save();
      
      console.log('✅ updateLocation exitoso');
      console.log('Status changed:', statusChanged);
      
    } catch (error) {
      console.log('❌ Error en updateLocation:', error.message);
    }
    
    console.log('\n✅ Tests completados');
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

testParallelSaveFix();