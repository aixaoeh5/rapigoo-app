const mongoose = require('mongoose');
const DeliveryTracking = require('./models/DeliveryTracking');

async function testValidTransition() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Buscar el delivery tracking
    const trackingId = '689e25f486bbce237e328a5d';
    const tracking = await DeliveryTracking.findById(trackingId);
    
    console.log('📋 Status actual:', tracking.status);
    
    // Determinar next valid transition
    const validTransitions = {
      assigned: ['heading_to_pickup', 'cancelled'],
      heading_to_pickup: ['at_pickup', 'cancelled'],
      at_pickup: ['picked_up', 'cancelled'],
      picked_up: ['heading_to_delivery', 'at_delivery', 'cancelled'],
      heading_to_delivery: ['at_delivery', 'cancelled'],
      at_delivery: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };
    
    const nextValidStatus = validTransitions[tracking.status]?.[0];
    
    if (!nextValidStatus) {
      console.log('❌ No hay transiciones válidas desde el estado actual');
      return;
    }
    
    console.log(`🎯 Probando transición: ${tracking.status} → ${nextValidStatus}`);
    
    // Test the transition that was failing before
    try {
      const result = await tracking.updateStatus(nextValidStatus, 'Test transition', {
        latitude: 18.4576806,
        longitude: -69.967104,
        accuracy: 22.5,
        speed: 0.06490875780582428,
        heading: 0
      });
      
      console.log('✅ Transición exitosa!');
      console.log('Nuevo status:', tracking.status);
      console.log('Save result:', result ? 'Saved' : 'Not saved');
      
    } catch (error) {
      console.log('❌ Error en transición:', error.message);
      
      if (error.message.includes('ParallelSaveError')) {
        console.log('🚨 PARALLEL SAVE ERROR AÚN PRESENTE!');
      } else if (error.message.includes('Can\'t save')) {
        console.log('🚨 SAVE ERROR DETECTADO!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

testValidTransition();