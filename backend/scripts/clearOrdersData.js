#!/usr/bin/env node

/**
 * Script para limpiar data de órdenes actuales
 * Elimina órdenes y datos relacionados de forma segura
 */

const mongoose = require('mongoose');
const Order = require('../models/Order');
const DeliveryTracking = require('../models/DeliveryTracking');
const Cart = require('../models/Cart');

// Cargar variables de entorno
require('dotenv').config();

class OrderDataCleaner {
  constructor() {
    this.results = {
      ordersDeleted: 0,
      deliveryTrackingsDeleted: 0,
      cartsCleared: 0,
      backupCreated: false
    };
  }

  async cleanOrdersData() {
    console.log('🧹 Iniciando limpieza de data de órdenes');
    console.log('='.repeat(50));

    try {
      // Conectar a la base de datos
      await this.connectToDatabase();
      
      // Mostrar estadísticas actuales
      await this.showCurrentStats();
      
      // Confirmar antes de proceder
      await this.confirmDeletion();
      
      // Crear respaldo
      await this.createBackup();
      
      // Limpiar datos
      await this.clearDeliveryTrackings();
      await this.clearOrders();
      await this.clearCarts();
      
      // Mostrar resultados
      this.showResults();
      
      console.log('\n✅ Limpieza completada exitosamente');

    } catch (error) {
      console.error('❌ Error durante la limpieza:', error.message);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
      console.log('🔌 Desconectado de la base de datos');
    }
  }

  async connectToDatabase() {
    console.log('🔌 Conectando a la base de datos...');
    
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rapigoo';
    await mongoose.connect(mongoUri);
    
    console.log('✅ Conectado a la base de datos');
  }

  async showCurrentStats() {
    console.log('\n📊 Estadísticas actuales:');
    
    const orderCount = await Order.countDocuments();
    const deliveryCount = await DeliveryTracking.countDocuments();
    const cartCount = await Cart.countDocuments();
    
    console.log(`  📦 Órdenes: ${orderCount}`);
    console.log(`  🚚 Delivery trackings: ${deliveryCount}`);
    console.log(`  🛒 Carritos: ${cartCount}`);

    if (orderCount === 0 && deliveryCount === 0 && cartCount === 0) {
      console.log('\nℹ️ No hay datos para limpiar');
      process.exit(0);
    }
  }

  async confirmDeletion() {
    console.log('\n⚠️ ADVERTENCIA: Esta operación eliminará TODOS los datos de órdenes');
    console.log('   - Todas las órdenes');
    console.log('   - Todos los delivery trackings');
    console.log('   - Todos los carritos');
    console.log('\n💾 Se creará un respaldo antes de proceder');
    
    // En un entorno de producción, aquí podrías agregar una confirmación interactiva
    // Por ahora, procedemos automáticamente con el respaldo
    console.log('\n✅ Procediendo con la limpieza...');
  }

  async createBackup() {
    console.log('\n💾 Creando respaldo...');
    
    try {
      const db = mongoose.connection.db;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Respaldar órdenes
      const orders = await Order.find({}).lean();
      if (orders.length > 0) {
        const backupCollectionName = `orders_backup_${timestamp}`;
        await db.createCollection(backupCollectionName);
        await db.collection(backupCollectionName).insertMany(orders);
        console.log(`  📦 Órdenes respaldadas en: ${backupCollectionName}`);
      }
      
      // Respaldar delivery trackings
      const deliveryTrackings = await DeliveryTracking.find({}).lean();
      if (deliveryTrackings.length > 0) {
        const backupCollectionName = `deliverytrackings_backup_${timestamp}`;
        await db.createCollection(backupCollectionName);
        await db.collection(backupCollectionName).insertMany(deliveryTrackings);
        console.log(`  🚚 Delivery trackings respaldados en: ${backupCollectionName}`);
      }
      
      // Respaldar carritos
      const carts = await Cart.find({}).lean();
      if (carts.length > 0) {
        const backupCollectionName = `carts_backup_${timestamp}`;
        await db.createCollection(backupCollectionName);
        await db.collection(backupCollectionName).insertMany(carts);
        console.log(`  🛒 Carritos respaldados en: ${backupCollectionName}`);
      }
      
      this.results.backupCreated = true;
      console.log('✅ Respaldo creado exitosamente');
      
    } catch (error) {
      console.error('❌ Error creando respaldo:', error.message);
      throw error;
    }
  }

  async clearDeliveryTrackings() {
    console.log('\n🚚 Eliminando delivery trackings...');
    
    try {
      const result = await DeliveryTracking.deleteMany({});
      this.results.deliveryTrackingsDeleted = result.deletedCount;
      
      console.log(`✅ ${result.deletedCount} delivery trackings eliminados`);
      
    } catch (error) {
      console.error('❌ Error eliminando delivery trackings:', error.message);
      throw error;
    }
  }

  async clearOrders() {
    console.log('\n📦 Eliminando órdenes...');
    
    try {
      const result = await Order.deleteMany({});
      this.results.ordersDeleted = result.deletedCount;
      
      console.log(`✅ ${result.deletedCount} órdenes eliminadas`);
      
    } catch (error) {
      console.error('❌ Error eliminando órdenes:', error.message);
      throw error;
    }
  }

  async clearCarts() {
    console.log('\n🛒 Eliminando carritos...');
    
    try {
      const result = await Cart.deleteMany({});
      this.results.cartsCleared = result.deletedCount;
      
      console.log(`✅ ${result.deletedCount} carritos eliminados`);
      
    } catch (error) {
      console.error('❌ Error eliminando carritos:', error.message);
      throw error;
    }
  }

  showResults() {
    console.log('\n📋 RESUMEN DE LIMPIEZA');
    console.log('='.repeat(30));
    console.log(`📦 Órdenes eliminadas: ${this.results.ordersDeleted}`);
    console.log(`🚚 Delivery trackings eliminados: ${this.results.deliveryTrackingsDeleted}`);
    console.log(`🛒 Carritos eliminados: ${this.results.cartsCleared}`);
    console.log(`💾 Respaldo creado: ${this.results.backupCreated ? 'Sí' : 'No'}`);
    
    const totalDeleted = this.results.ordersDeleted + 
                        this.results.deliveryTrackingsDeleted + 
                        this.results.cartsCleared;
    
    console.log(`📊 Total de registros eliminados: ${totalDeleted}`);
  }

  async clearSpecificOrders(filterCriteria = {}) {
    console.log('\n🎯 Eliminando órdenes específicas...');
    console.log('Criterios:', JSON.stringify(filterCriteria, null, 2));
    
    try {
      // Encontrar órdenes que coincidan con el criterio
      const ordersToDelete = await Order.find(filterCriteria);
      console.log(`📋 Encontradas ${ordersToDelete.length} órdenes para eliminar`);
      
      if (ordersToDelete.length === 0) {
        console.log('ℹ️ No hay órdenes que coincidan con los criterios');
        return;
      }
      
      // Obtener IDs de las órdenes
      const orderIds = ordersToDelete.map(order => order._id);
      
      // Eliminar delivery trackings relacionados
      const deliveryResult = await DeliveryTracking.deleteMany({
        orderId: { $in: orderIds }
      });
      console.log(`🚚 ${deliveryResult.deletedCount} delivery trackings eliminados`);
      
      // Eliminar las órdenes
      const orderResult = await Order.deleteMany(filterCriteria);
      console.log(`📦 ${orderResult.deletedCount} órdenes eliminadas`);
      
    } catch (error) {
      console.error('❌ Error eliminando órdenes específicas:', error.message);
      throw error;
    }
  }
}

// Función para limpiar órdenes por estado
async function clearOrdersByStatus(statuses) {
  const cleaner = new OrderDataCleaner();
  await cleaner.connectToDatabase();
  
  try {
    await cleaner.clearSpecificOrders({
      status: { $in: statuses }
    });
    console.log(`✅ Órdenes con estados [${statuses.join(', ')}] eliminadas`);
  } finally {
    await mongoose.disconnect();
  }
}

// Función para limpiar órdenes antiguas
async function clearOldOrders(daysOld = 30) {
  const cleaner = new OrderDataCleaner();
  await cleaner.connectToDatabase();
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    await cleaner.clearSpecificOrders({
      createdAt: { $lt: cutoffDate }
    });
    console.log(`✅ Órdenes anteriores a ${cutoffDate.toDateString()} eliminadas`);
  } finally {
    await mongoose.disconnect();
  }
}

// Interfaz de línea de comandos
if (require.main === module) {
  const command = process.argv[2];
  const param = process.argv[3];
  
  switch (command) {
    case 'all':
      const cleaner = new OrderDataCleaner();
      cleaner.cleanOrdersData();
      break;
      
    case 'status':
      if (!param) {
        console.error('❌ Especifica el estado: node clearOrdersData.js status pending');
        process.exit(1);
      }
      clearOrdersByStatus([param]);
      break;
      
    case 'old':
      const days = parseInt(param) || 30;
      clearOldOrders(days);
      break;
      
    case 'test':
      clearOrdersByStatus(['pending', 'cancelled']);
      break;
      
    default:
      console.log('📋 Uso del script:');
      console.log('  node clearOrdersData.js all          - Eliminar TODAS las órdenes');
      console.log('  node clearOrdersData.js status STATE - Eliminar órdenes por estado');
      console.log('  node clearOrdersData.js old DAYS     - Eliminar órdenes antiguas');
      console.log('  node clearOrdersData.js test         - Eliminar órdenes de prueba');
      console.log('');
      console.log('Ejemplos:');
      console.log('  node clearOrdersData.js status pending');
      console.log('  node clearOrdersData.js old 7');
      break;
  }
}

module.exports = {
  OrderDataCleaner,
  clearOrdersByStatus,
  clearOldOrders
};