const mongoose = require('mongoose');
const User = require('./models/User');
const Order = require('./models/Order');
const DeliveryTracking = require('./models/DeliveryTracking');

async function debugMerchantLocation() {
  try {
    require('dotenv').config();
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a MongoDB');
    
    console.log('🔍 DEBUGGING MERCHANT LOCATION DATA');
    console.log('=====================================');
    
    // 1. Buscar una orden activa con delivery asignado
    const activeOrder = await Order.findOne({
      status: 'assigned',
      deliveryPersonId: { $exists: true }
    }).populate('merchantId');
    
    if (!activeOrder) {
      console.log('❌ No se encontró orden activa con delivery asignado');
      return;
    }
    
    console.log('\n📦 ORDEN ACTIVA ENCONTRADA:');
    console.log(`Order ID: ${activeOrder._id}`);
    console.log(`Order Number: ${activeOrder.orderNumber}`);
    console.log(`Merchant ID: ${activeOrder.merchantId._id}`);
    
    // 2. Analizar datos del comerciante
    console.log('\n🏪 DATOS DEL COMERCIANTE:');
    const merchant = activeOrder.merchantId;
    
    console.log('Merchant Name:', merchant.name);
    console.log('Business Name:', merchant.business?.businessName);
    
    console.log('\n📍 UBICACIÓN DEL NEGOCIO:');
    console.log('business.address:', merchant.business?.address);
    console.log('business.location:', merchant.business?.location);
    console.log('business.location.coordinates:', merchant.business?.location?.coordinates);
    console.log('business.coordinates:', merchant.business?.coordinates);
    console.log('business.pickupAddress:', merchant.business?.pickupAddress);
    
    // 3. Ver qué coordenadas se están usando actualmente
    const pickupCoordinates = merchant.business?.location?.coordinates || [0, 0];
    console.log('\n🎯 COORDENADAS USADAS PARA PICKUP:');
    console.log('pickupCoordinates:', pickupCoordinates);
    console.log('Are default [0,0]?:', JSON.stringify(pickupCoordinates) === JSON.stringify([0, 0]));
    
    // 4. Analizar delivery tracking relacionado
    const deliveryTracking = await DeliveryTracking.findOne({
      orderId: activeOrder._id
    });
    
    if (deliveryTracking) {
      console.log('\n🚚 DELIVERY TRACKING DATA:');
      console.log('Pickup Location:', deliveryTracking.pickupLocation);
      console.log('Delivery Location:', deliveryTracking.deliveryLocation);
      
      // Verificar si las coordenadas son válidas
      const invalidPickup = deliveryTracking.pickupLocation.coordinates[0] === 0 && 
                           deliveryTracking.pickupLocation.coordinates[1] === 0;
      const invalidDelivery = deliveryTracking.deliveryLocation.coordinates[0] === 0 && 
                             deliveryTracking.deliveryLocation.coordinates[1] === 0;
      
      console.log('\n⚠️ COORDENADAS VÁLIDAS?');
      console.log('Pickup valid:', !invalidPickup);
      console.log('Delivery valid:', !invalidDelivery);
    }
    
    // 5. Buscar todos los comerciantes para ver estructura general
    console.log('\n📊 ANÁLISIS GENERAL DE COMERCIANTES:');
    const allMerchants = await User.find({ role: 'merchant' }).limit(5);
    
    let withValidCoordinates = 0;
    let withInvalidCoordinates = 0;
    
    allMerchants.forEach((merchant, i) => {
      const coords = merchant.business?.location?.coordinates;
      const isValid = coords && coords.length === 2 && (coords[0] !== 0 || coords[1] !== 0);
      
      console.log(`Merchant ${i + 1}:`);
      console.log(`  Name: ${merchant.business?.businessName || merchant.name}`);
      console.log(`  Coordinates: ${JSON.stringify(coords)}`);
      console.log(`  Valid: ${isValid}`);
      console.log(`  Address: ${merchant.business?.address}`);
      
      if (isValid) withValidCoordinates++;
      else withInvalidCoordinates++;
    });
    
    console.log(`\n📈 ESTADÍSTICAS (muestra de ${allMerchants.length}):`);
    console.log(`Con coordenadas válidas: ${withValidCoordinates}`);
    console.log(`Con coordenadas inválidas: ${withInvalidCoordinates}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
}

debugMerchantLocation();