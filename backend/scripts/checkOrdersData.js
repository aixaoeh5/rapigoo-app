#!/usr/bin/env node

/**
 * Script para verificar la data de órdenes antes de limpiar
 * Muestra estadísticas detalladas de las órdenes existentes
 */

const mongoose = require('mongoose');
const Order = require('../models/Order');
const DeliveryTracking = require('../models/DeliveryTracking');
const Cart = require('../models/Cart');

require('dotenv').config();

async function checkOrdersData() {
  console.log('📊 Verificando data de órdenes');
  console.log('='.repeat(40));

  try {
    // Conectar a la base de datos
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado a la base de datos');

    // Estadísticas generales
    console.log('\n📋 ESTADÍSTICAS GENERALES');
    console.log('-'.repeat(30));
    
    const totalOrders = await Order.countDocuments();
    const totalDeliveries = await DeliveryTracking.countDocuments();
    const totalCarts = await Cart.countDocuments();
    
    console.log(`📦 Total de órdenes: ${totalOrders}`);
    console.log(`🚚 Total de delivery trackings: ${totalDeliveries}`);
    console.log(`🛒 Total de carritos: ${totalCarts}`);

    if (totalOrders === 0) {
      console.log('\nℹ️ No hay órdenes en la base de datos');
      return;
    }

    // Estadísticas por estado
    console.log('\n📊 ÓRDENES POR ESTADO');
    console.log('-'.repeat(25));
    
    const ordersByStatus = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    ordersByStatus.forEach(status => {
      console.log(`  ${status._id || 'Sin estado'}: ${status.count} órdenes (₡${status.totalAmount?.toFixed(2) || '0.00'})`);
    });

    // Órdenes recientes
    console.log('\n🕐 ÓRDENES RECIENTES (últimas 10)');
    console.log('-'.repeat(35));
    
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderNumber status total createdAt customerInfo')
      .lean();

    recentOrders.forEach(order => {
      const date = new Date(order.createdAt).toLocaleString();
      const customer = order.customerInfo?.name || 'Sin nombre';
      console.log(`  📦 ${order.orderNumber} - ${order.status} - ₡${order.total} - ${customer} - ${date}`);
    });

    // Delivery trackings
    console.log('\n🚚 DELIVERY TRACKINGS POR ESTADO');
    console.log('-'.repeat(35));
    
    const deliveriesByStatus = await DeliveryTracking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    deliveriesByStatus.forEach(status => {
      console.log(`  ${status._id || 'Sin estado'}: ${status.count} deliveries`);
    });

    // Deliveries activos
    const activeDeliveries = await DeliveryTracking.find({
      isLive: true,
      status: { $in: ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'heading_to_delivery', 'at_delivery'] }
    }).countDocuments();

    console.log(`\n🔴 Deliveries activos: ${activeDeliveries}`);

    // Órdenes por fecha
    console.log('\n📅 ÓRDENES POR FECHA (últimos 7 días)');
    console.log('-'.repeat(40));
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const ordersByDate = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$total' }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    ordersByDate.forEach(day => {
      console.log(`  ${day._id}: ${day.count} órdenes (₡${day.totalAmount?.toFixed(2) || '0.00'})`);
    });

    // Carritos
    if (totalCarts > 0) {
      console.log('\n🛒 INFORMACIÓN DE CARRITOS');
      console.log('-'.repeat(25));
      
      const cartStats = await Cart.aggregate([
        {
          $group: {
            _id: null,
            totalItems: { $sum: { $size: '$items' } },
            averageItems: { $avg: { $size: '$items' } }
          }
        }
      ]);

      if (cartStats.length > 0) {
        console.log(`  Total de items en carritos: ${cartStats[0].totalItems}`);
        console.log(`  Promedio de items por carrito: ${cartStats[0].averageItems?.toFixed(1)}`);
      }
    }

    // Resumen de limpieza recomendada
    console.log('\n💡 RECOMENDACIONES DE LIMPIEZA');
    console.log('-'.repeat(35));
    
    const oldOrders = await Order.countDocuments({
      createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
    
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
    const completedOrders = await Order.countDocuments({ status: 'delivered' });
    
    console.log(`  📦 Órdenes antiguas (>30 días): ${oldOrders}`);
    console.log(`  ❌ Órdenes canceladas: ${cancelledOrders}`);
    console.log(`  ✅ Órdenes completadas: ${completedOrders}`);
    
    if (activeDeliveries > 0) {
      console.log(`  ⚠️ CUIDADO: Hay ${activeDeliveries} deliveries activos`);
    }

    console.log('\n📋 COMANDOS SUGERIDOS:');
    console.log('-'.repeat(25));
    console.log('  # Limpiar TODAS las órdenes (¡CUIDADO!)');
    console.log('  node scripts/clearOrdersData.js all');
    console.log('');
    console.log('  # Limpiar solo órdenes canceladas');
    console.log('  node scripts/clearOrdersData.js status cancelled');
    console.log('');
    console.log('  # Limpiar órdenes antiguas (>30 días)');
    console.log('  node scripts/clearOrdersData.js old 30');
    console.log('');
    console.log('  # Limpiar órdenes de prueba');
    console.log('  node scripts/clearOrdersData.js test');

  } catch (error) {
    console.error('❌ Error verificando datos:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado de la base de datos');
  }
}

if (require.main === module) {
  checkOrdersData();
}

module.exports = { checkOrdersData };