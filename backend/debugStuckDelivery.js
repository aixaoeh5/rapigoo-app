/**
 * Script de diagnóstico para analizar entregas bloqueadas
 * Identifica ordenes assigned con delivery pero que no aparecen en el panel del comerciante
 */

const mongoose = require('mongoose');
const Order = require('./models/Order');
const DeliveryTracking = require('./models/DeliveryTracking');
const User = require('./models/User');

// Configurar variables de entorno
require('dotenv').config();

// Configuración de MongoDB
const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

async function diagnosisStuckDeliveries() {
  console.log('\n🔍 === DIAGNÓSTICO DE ENTREGAS BLOQUEADAS ===\n');
  
  try {
    // 1. Buscar todas las órdenes con delivery asignado
    console.log('📦 1. Buscando órdenes con delivery asignado...');
    const ordersWithDelivery = await Order.find({
      deliveryPersonId: { $exists: true, $ne: null }
    }).populate('deliveryPersonId', 'name phone role')
      .populate('merchantId', 'name business.businessName')
      .sort({ createdAt: -1 });
    
    console.log(`   Encontradas: ${ordersWithDelivery.length} órdenes con delivery asignado`);
    
    // 2. Buscar delivery tracking correspondientes
    console.log('\n🚚 2. Verificando delivery tracking para cada orden...');
    const problemCases = [];
    
    for (const order of ordersWithDelivery) {
      const deliveryTracking = await DeliveryTracking.findOne({
        orderId: order._id
      });
      
      console.log(`\n   Orden ${order.orderNumber}:`);
      console.log(`   - Estado orden: ${order.status}`);
      console.log(`   - Delivery person: ${order.deliveryPersonId?.name || 'N/A'}`);
      console.log(`   - Comerciante: ${order.merchantId?.business?.businessName || order.merchantId?.name || 'N/A'}`);
      console.log(`   - Tiene delivery tracking: ${!!deliveryTracking}`);
      
      if (deliveryTracking) {
        console.log(`   - Estado tracking: ${deliveryTracking.status}`);
        console.log(`   - Pickup arrived: ${deliveryTracking.pickupLocation?.arrived || false}`);
        console.log(`   - Delivery arrived: ${deliveryTracking.deliveryLocation?.arrived || false}`);
        
        // Identificar casos problemáticos
        const isStuck = (
          // Caso 1: Orden assigned pero delivery en estado más avanzado
          (order.status === 'assigned' && !['assigned', 'heading_to_pickup'].includes(deliveryTracking.status)) ||
          
          // Caso 2: Delivery en at_pickup pero orden no está ready/preparing
          (deliveryTracking.status === 'at_pickup' && !['ready', 'preparing', 'assigned'].includes(order.status)) ||
          
          // Caso 3: Estados inconsistentes
          (order.status === 'ready' && deliveryTracking.status === 'assigned') ||
          (order.status === 'assigned' && deliveryTracking.status === 'at_pickup')
        );
        
        if (isStuck) {
          problemCases.push({
            order,
            deliveryTracking,
            issue: 'Estado inconsistente entre orden y delivery'
          });
        }
      } else {
        // Caso 4: Orden con delivery asignado pero sin tracking
        problemCases.push({
          order,
          deliveryTracking: null,
          issue: 'Orden con delivery asignado pero sin delivery tracking'
        });
      }
    }
    
    // 3. Buscar delivery trackings huérfanos
    console.log('\n🔍 3. Buscando delivery trackings huérfanos...');
    const orphanedTrackings = await DeliveryTracking.find({
      orderId: { $exists: true }
    }).populate('orderId')
      .populate('deliveryPersonId', 'name phone');
    
    for (const tracking of orphanedTrackings) {
      if (!tracking.orderId) {
        problemCases.push({
          order: null,
          deliveryTracking: tracking,
          issue: 'Delivery tracking sin orden válida'
        });
      }
    }
    
    // 4. Analizar casos específicos del problema reportado
    console.log('\n🚨 4. Analizando casos específicos del problema reportado...');
    
    const assignedDeliveries = await DeliveryTracking.find({
      status: { $in: ['assigned', 'heading_to_pickup', 'at_pickup'] }
    }).populate('orderId')
      .populate('deliveryPersonId', 'name phone');
    
    console.log(`   Deliveries en estados tempranos: ${assignedDeliveries.length}`);
    
    for (const delivery of assignedDeliveries) {
      if (delivery.orderId) {
        console.log(`\n   🔍 Delivery ${delivery._id}:`);
        console.log(`     - Estado delivery: ${delivery.status}`);
        console.log(`     - Estado orden: ${delivery.orderId.status}`);
        console.log(`     - Orden #: ${delivery.orderId.orderNumber}`);
        console.log(`     - Delivery person: ${delivery.deliveryPersonId?.name || 'N/A'}`);
        
        // Verificar si esta orden aparecería en el endpoint del comerciante
        const merchantId = delivery.orderId.merchantId;
        
        // Simular query del endpoint pending-pickup
        const wouldAppearInPendingPickup = delivery.status === 'at_pickup';
        
        // Simular query del panel de comerciante para órdenes "ready"
        const wouldAppearInReady = delivery.orderId.status === 'ready' && !delivery.orderId.deliveryPersonId;
        
        console.log(`     - Aparecería en "pending-pickup": ${wouldAppearInPendingPickup}`);
        console.log(`     - Aparecería en "ready": ${wouldAppearInReady}`);
        
        // Este es el caso problemático reportado
        if (delivery.orderId.deliveryPersonId && delivery.orderId.status !== 'ready' && delivery.status !== 'at_pickup') {
          problemCases.push({
            order: delivery.orderId,
            deliveryTracking: delivery,
            issue: 'Orden assigned con delivery pero no visible en panel comerciante ni en pending-pickup'
          });
        }
      }
    }
    
    // 5. Reportar problemas encontrados
    console.log('\n📊 === RESUMEN DE PROBLEMAS ENCONTRADOS ===\n');
    
    if (problemCases.length === 0) {
      console.log('✅ No se encontraron problemas en las entregas');
    } else {
      console.log(`❌ Se encontraron ${problemCases.length} casos problemáticos:\n`);
      
      problemCases.forEach((case_, index) => {
        console.log(`${index + 1}. ${case_.issue}`);
        
        if (case_.order) {
          console.log(`   - Orden: ${case_.order.orderNumber} (${case_.order.status})`);
          console.log(`   - Delivery person: ${case_.order.deliveryPersonId?.name || 'N/A'}`);
        }
        
        if (case_.deliveryTracking) {
          console.log(`   - Tracking: ${case_.deliveryTracking._id} (${case_.deliveryTracking.status})`);
          console.log(`   - Delivery person: ${case_.deliveryTracking.deliveryPersonId?.name || 'N/A'}`);
        }
        
        console.log('');
      });
      
      // 6. Generar hipótesis y soluciones
      console.log('🔬 === HIPÓTESIS Y POSIBLES CAUSAS ===\n');
      
      console.log('H1. DESINCRONIZACIÓN DE ESTADOS:');
      console.log('   - La orden se marcó como "assigned" pero el status del delivery tracking no coincide');
      console.log('   - Posible causa: Race condition en la asignación del delivery');
      console.log('   - Solución: Sincronizar estados orden-delivery tracking\n');
      
      console.log('H2. PROBLEMA EN QUERY DEL COMERCIANTE:');
      console.log('   - El endpoint del comerciante filtra órdenes incorrectamente');
      console.log('   - Solo muestra órdenes "ready" sin delivery asignado');
      console.log('   - Solución: Mostrar órdenes "assigned" también\n');
      
      console.log('H3. FALTA DE NOTIFICACIÓN AL COMERCIANTE:');
      console.log('   - El comerciante no recibe notificación cuando se asigna delivery');
      console.log('   - No sabe que debe confirmar la entrega al delivery');
      console.log('   - Solución: Implementar notificaciones push\n');
      
      console.log('H4. TRANSICIÓN DE ESTADO INCOMPLETA:');
      console.log('   - La asignación del delivery no actualizó correctamente el estado de la orden');
      console.log('   - Orden queda en estado intermedio');
      console.log('   - Solución: Usar transacciones atómicas\n');
      
      console.log('H5. PROBLEMA EN EL FLUJO DEL DELIVERY:');
      console.log('   - El delivery puede cambiar a "at_pickup" automáticamente');
      console.log('   - Pero el comerciante no ve la notificación');
      console.log('   - Solución: Mejorar UI del comerciante\n');
    }
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error);
  }
}

async function generateFixScript() {
  console.log('\n🛠️  === GENERANDO SCRIPT DE REPARACIÓN ===\n');
  
  // Buscar casos específicos que necesitan reparación
  const stuckOrders = await Order.find({
    deliveryPersonId: { $exists: true, $ne: null },
    status: 'assigned'
  });
  
  const stuckDeliveries = await DeliveryTracking.find({
    status: { $in: ['assigned', 'heading_to_pickup'] }
  }).populate('orderId');
  
  console.log('Script de reparación sugerido:\n');
  console.log('```javascript');
  console.log('// 1. Sincronizar estados orden-delivery');
  console.log('for (const delivery of stuckDeliveries) {');
  console.log('  if (delivery.orderId && delivery.orderId.status !== delivery.status) {');
  console.log('    // Actualizar orden al estado correcto');
  console.log('    await Order.findByIdAndUpdate(delivery.orderId._id, {');
  console.log('      status: getOrderStatusFromDeliveryStatus(delivery.status)');
  console.log('    });');
  console.log('  }');
  console.log('}');
  console.log('```\n');
}

async function main() {
  await connectToDatabase();
  await diagnosisStuckDeliveries();
  await generateFixScript();
  
  console.log('\n✅ Diagnóstico completado. Revisa los resultados arriba.');
  process.exit(0);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error ejecutando diagnóstico:', error);
    process.exit(1);
  });
}

module.exports = { diagnosisStuckDeliveries };