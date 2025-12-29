const mongoose = require('mongoose');
const Order = require('./models/Order');
const DeliveryTracking = require('./models/DeliveryTracking');
const User = require('./models/User');
const Cart = require('./models/Cart');

async function findAllDesynchronizations() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔍 ANÁLISIS SISTEMÁTICO DE DESINCRONIZACIONES');
    console.log('===============================================');
    
    const issues = [];

    // 1. DESINCRONIZACIÓN ORDER ↔ DELIVERY TRACKING
    console.log('\n1️⃣ VERIFICANDO SINCRONIZACIÓN ORDER ↔ DELIVERY TRACKING...');
    const orders = await Order.find({}).populate('customerId merchantId');
    
    for (const order of orders) {
      const delivery = await DeliveryTracking.findOne({ orderId: order._id });
      
      if (order.status === 'assigned' || order.status === 'picked_up' || order.status === 'in_transit') {
        if (delivery) {
          // Verificar consistencia de estados
          const orderState = order.status;
          const deliveryState = delivery.status;
          
          const expectedMappings = {
            'assigned': ['assigned', 'heading_to_pickup', 'at_pickup'],
            'picked_up': ['picked_up', 'heading_to_delivery'],
            'in_transit': ['heading_to_delivery', 'at_delivery']
          };
          
          const expected = expectedMappings[orderState] || [];
          if (!expected.includes(deliveryState)) {
            issues.push({
              type: 'ORDER_DELIVERY_MISMATCH',
              severity: 'HIGH',
              orderId: order._id,
              orderStatus: orderState,
              deliveryStatus: deliveryState,
              expected: expected,
              description: `Orden en ${orderState} pero delivery en ${deliveryState}`
            });
          }
        } else {
          // Orden con estado de delivery pero sin delivery tracking
          issues.push({
            type: 'MISSING_DELIVERY_TRACKING',
            severity: 'HIGH',
            orderId: order._id,
            orderStatus: order.status,
            description: `Orden en estado ${order.status} pero sin delivery tracking`
          });
        }
      }
      
      // Verificar órdenes delivered sin delivery tracking delivered
      if (order.status === 'delivered' && delivery && delivery.status !== 'delivered') {
        issues.push({
          type: 'DELIVERED_ORDER_INCOMPLETE_DELIVERY',
          severity: 'MEDIUM',
          orderId: order._id,
          orderStatus: order.status,
          deliveryStatus: delivery.status,
          description: `Orden delivered pero delivery tracking en ${delivery.status}`
        });
      }
    }

    // 2. DELIVERY TRACKING HUÉRFANOS
    console.log('\n2️⃣ VERIFICANDO DELIVERY TRACKING HUÉRFANOS...');
    const allDeliveries = await DeliveryTracking.find({});
    
    for (const delivery of allDeliveries) {
      const order = await Order.findById(delivery.orderId);
      if (!order) {
        issues.push({
          type: 'ORPHANED_DELIVERY_TRACKING',
          severity: 'MEDIUM',
          deliveryId: delivery._id,
          orderId: delivery.orderId,
          deliveryStatus: delivery.status,
          description: `Delivery tracking sin orden válida`
        });
      }
    }

    // 3. USUARIOS CON DATOS INCONSISTENTES
    console.log('\n3️⃣ VERIFICANDO CONSISTENCIA DE USUARIOS...');
    const users = await User.find({});
    
    for (const user of users) {
      // Verificar comerciantes sin business data
      if (user.role === 'merchant' && (!user.business || !user.business.businessName)) {
        issues.push({
          type: 'MERCHANT_WITHOUT_BUSINESS',
          severity: 'MEDIUM',
          userId: user._id,
          email: user.email,
          description: `Usuario merchant sin datos de negocio`
        });
      }
      
      // Verificar delivery persons sin datos esenciales
      if (user.role === 'delivery' && (!user.phone || !user.deliveryStatus)) {
        issues.push({
          type: 'INCOMPLETE_DELIVERY_USER',
          severity: 'MEDIUM',
          userId: user._id,
          email: user.email,
          description: `Usuario delivery sin datos esenciales`
        });
      }
      
      // Verificar usuarios sin verificar con pedidos
      if (!user.isVerified) {
        const userOrders = await Order.find({ customerId: user._id });
        if (userOrders.length > 0) {
          issues.push({
            type: 'UNVERIFIED_USER_WITH_ORDERS',
            severity: 'LOW',
            userId: user._id,
            email: user.email,
            orderCount: userOrders.length,
            description: `Usuario sin verificar con ${userOrders.length} pedidos`
          });
        }
      }
    }

    // 4. CARRITOS INCONSISTENTES
    console.log('\n4️⃣ VERIFICANDO CONSISTENCIA DE CARRITOS...');
    const carts = await Cart.find({}).populate('userId');
    
    for (const cart of carts) {
      // Verificar carritos con items pero items sin merchant
      if (cart.items && cart.items.length > 0) {
        const itemsWithoutMerchant = cart.items.filter(item => !item.merchantId);
        if (itemsWithoutMerchant.length > 0) {
          issues.push({
            type: 'CART_ITEMS_WITHOUT_MERCHANT',
            severity: 'MEDIUM',
            cartId: cart._id,
            userId: cart.userId?._id,
            itemCount: itemsWithoutMerchant.length,
            description: `Carrito con ${itemsWithoutMerchant.length} items sin merchant`
          });
        }
      }
      
      // Verificar carritos con total incorrecto
      if (cart.items && cart.items.length > 0) {
        const calculatedTotal = cart.items.reduce((sum, item) => 
          sum + (item.price * item.quantity), 0);
        
        if (Math.abs(cart.total - calculatedTotal) > 0.01) {
          issues.push({
            type: 'CART_TOTAL_MISMATCH',
            severity: 'LOW',
            cartId: cart._id,
            storedTotal: cart.total,
            calculatedTotal: calculatedTotal,
            description: `Total del carrito incorrecto: ${cart.total} vs ${calculatedTotal}`
          });
        }
      }
    }

    // 5. ÓRDENES CON DATOS INCONSISTENTES
    console.log('\n5️⃣ VERIFICANDO CONSISTENCIA INTERNA DE ÓRDENES...');
    
    for (const order of orders) {
      // Verificar órdenes sin customer o merchant
      if (!order.customerId) {
        issues.push({
          type: 'ORDER_WITHOUT_CUSTOMER',
          severity: 'HIGH',
          orderId: order._id,
          description: `Orden sin cliente asignado`
        });
      }
      
      if (!order.merchantId) {
        issues.push({
          type: 'ORDER_WITHOUT_MERCHANT',
          severity: 'HIGH',
          orderId: order._id,
          description: `Orden sin merchant asignado`
        });
      }
      
      // Verificar órdenes con total 0 o negativo
      if (order.total <= 0) {
        issues.push({
          type: 'ORDER_INVALID_TOTAL',
          severity: 'MEDIUM',
          orderId: order._id,
          total: order.total,
          description: `Orden con total inválido: ${order.total}`
        });
      }
      
      // Verificar órdenes sin items
      if (!order.items || order.items.length === 0) {
        issues.push({
          type: 'ORDER_WITHOUT_ITEMS',
          severity: 'HIGH',
          orderId: order._id,
          description: `Orden sin items`
        });
      }
    }

    // 6. REPORTAR RESULTADOS
    console.log('\n📊 RESUMEN DE DESINCRONIZACIONES ENCONTRADAS:');
    console.log('=============================================');
    
    const severityCount = {
      HIGH: issues.filter(i => i.severity === 'HIGH').length,
      MEDIUM: issues.filter(i => i.severity === 'MEDIUM').length,
      LOW: issues.filter(i => i.severity === 'LOW').length
    };
    
    console.log(`🔴 Críticas (HIGH): ${severityCount.HIGH}`);
    console.log(`🟡 Moderadas (MEDIUM): ${severityCount.MEDIUM}`);
    console.log(`🟢 Menores (LOW): ${severityCount.LOW}`);
    console.log(`📋 Total: ${issues.length} problemas detectados\n`);
    
    // Agrupar por tipo
    const byType = {};
    issues.forEach(issue => {
      if (!byType[issue.type]) {
        byType[issue.type] = [];
      }
      byType[issue.type].push(issue);
    });
    
    // Mostrar detalles por tipo
    Object.keys(byType).forEach(type => {
      const typeIssues = byType[type];
      const severity = typeIssues[0].severity;
      const emoji = severity === 'HIGH' ? '🔴' : severity === 'MEDIUM' ? '🟡' : '🟢';
      
      console.log(`${emoji} ${type} (${typeIssues.length}):`);
      typeIssues.slice(0, 5).forEach(issue => {
        console.log(`   • ${issue.description}`);
        if (issue.orderId) console.log(`     Orden: ${issue.orderId}`);
        if (issue.userId) console.log(`     Usuario: ${issue.userId}`);
      });
      
      if (typeIssues.length > 5) {
        console.log(`   ... y ${typeIssues.length - 5} más`);
      }
      console.log();
    });
    
    // Retornar para uso programático
    return {
      totalIssues: issues.length,
      severityBreakdown: severityCount,
      issuesByType: byType,
      allIssues: issues
    };
    
  } catch (error) {
    console.error('❌ Error en análisis:', error);
    throw error;
  } finally {
    mongoose.disconnect();
  }
}

if (require.main === module) {
  findAllDesynchronizations()
    .then(result => {
      console.log('✅ Análisis completado');
      process.exit(result.totalIssues > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { findAllDesynchronizations };