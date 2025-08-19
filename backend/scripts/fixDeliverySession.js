#!/usr/bin/env node

/**
 * Script para arreglar sesiones de delivery inconsistentes
 * Limpia estados huérfanos después de eliminar órdenes
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const DeliveryTracking = require('../models/DeliveryTracking');
const Order = require('../models/Order');

require('dotenv').config();

class DeliverySessionFixer {
  constructor() {
    this.results = {
      usersFixed: 0,
      orphanedDeliveries: 0,
      inconsistentStates: 0
    };
  }

  async fixDeliverySessions() {
    console.log('🔧 Arreglando sesiones de delivery inconsistentes');
    console.log('='.repeat(50));

    try {
      await this.connectToDatabase();
      
      // Verificar estado actual
      await this.analyzeCurrentState();
      
      // Limpiar delivery trackings huérfanos
      await this.cleanOrphanedDeliveryTrackings();
      
      // Resetear estado de usuarios delivery
      await this.resetDeliveryUserStates();
      
      // Limpiar estados del frontend (AsyncStorage simulation)
      await this.generateFrontendCleanupInstructions();
      
      this.showResults();

    } catch (error) {
      console.error('❌ Error arreglando sesiones:', error.message);
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

  async analyzeCurrentState() {
    console.log('\n📊 Analizando estado actual...');
    
    // Contar delivery trackings
    const totalDeliveryTrackings = await DeliveryTracking.countDocuments();
    console.log(`🚚 Total delivery trackings: ${totalDeliveryTrackings}`);
    
    // Contar órdenes
    const totalOrders = await Order.countDocuments();
    console.log(`📦 Total órdenes: ${totalOrders}`);
    
    // Encontrar delivery trackings huérfanos (sin orden correspondiente)
    const orphanedDeliveries = await DeliveryTracking.aggregate([
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order'
        }
      },
      {
        $match: {
          order: { $size: 0 }
        }
      }
    ]);
    
    console.log(`🔍 Delivery trackings huérfanos: ${orphanedDeliveries.length}`);
    
    // Encontrar usuarios delivery con estado inconsistente
    const deliveryUsers = await User.find({ role: 'delivery' });
    console.log(`👥 Usuarios delivery: ${deliveryUsers.length}`);
    
    // Mostrar delivery trackings activos
    const activeDeliveries = await DeliveryTracking.find({
      isLive: true,
      status: { $nin: ['delivered', 'cancelled'] }
    }).populate('deliveryPersonId', 'name email');
    
    console.log(`🔴 Deliveries activos: ${activeDeliveries.length}`);
    
    if (activeDeliveries.length > 0) {
      console.log('\n📋 Deliveries activos encontrados:');
      activeDeliveries.forEach(delivery => {
        console.log(`  - ID: ${delivery._id}`);
        console.log(`    Delivery Person: ${delivery.deliveryPersonId?.name || 'Desconocido'} (${delivery.deliveryPersonId?.email || 'Sin email'})`);
        console.log(`    Status: ${delivery.status}`);
        console.log(`    Orden ID: ${delivery.orderId}`);
        console.log(`    Es Live: ${delivery.isLive}`);
        console.log('');
      });
    }
    
    this.results.inconsistentStates = orphanedDeliveries.length;
  }

  async cleanOrphanedDeliveryTrackings() {
    console.log('\n🧹 Limpiando delivery trackings huérfanos...');
    
    try {
      // Encontrar y eliminar delivery trackings sin orden correspondiente
      const orphanedDeliveries = await DeliveryTracking.aggregate([
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'order'
          }
        },
        {
          $match: {
            order: { $size: 0 }
          }
        },
        {
          $project: {
            _id: 1,
            orderId: 1,
            deliveryPersonId: 1,
            status: 1
          }
        }
      ]);

      if (orphanedDeliveries.length > 0) {
        console.log(`🗑️ Eliminando ${orphanedDeliveries.length} delivery trackings huérfanos...`);
        
        const orphanedIds = orphanedDeliveries.map(d => d._id);
        const deleteResult = await DeliveryTracking.deleteMany({
          _id: { $in: orphanedIds }
        });
        
        this.results.orphanedDeliveries = deleteResult.deletedCount;
        console.log(`✅ ${deleteResult.deletedCount} delivery trackings huérfanos eliminados`);
        
        // Mostrar detalles de los eliminados
        orphanedDeliveries.forEach(delivery => {
          console.log(`  - Delivery ${delivery._id} (Orden inexistente: ${delivery.orderId})`);
        });
      } else {
        console.log('✅ No se encontraron delivery trackings huérfanos');
      }

    } catch (error) {
      console.error('❌ Error limpiando delivery trackings huérfanos:', error.message);
      throw error;
    }
  }

  async resetDeliveryUserStates() {
    console.log('\n👥 Reseteando estados de usuarios delivery...');
    
    try {
      // Encontrar todos los usuarios delivery
      const deliveryUsers = await User.find({ role: 'delivery' });
      
      console.log(`🔍 Verificando ${deliveryUsers.length} usuarios delivery...`);
      
      for (const user of deliveryUsers) {
        // Verificar si el usuario tiene delivery trackings activos válidos
        const activeDelivery = await DeliveryTracking.findOne({
          deliveryPersonId: user._id,
          isLive: true,
          status: { $nin: ['delivered', 'cancelled'] }
        });
        
        if (!activeDelivery) {
          // El usuario no tiene deliveries activos válidos, limpiamos su estado
          console.log(`🔧 Limpiando estado del usuario: ${user.name} (${user.email})`);
          
          // Aquí podrías agregar campos específicos del estado de delivery si los tienes
          // Por ejemplo, si tienes campos como isOnDelivery, currentDeliveryId, etc.
          const updateFields = {};
          
          // Ejemplo de campos que podrías querer limpiar:
          // updateFields.isOnDelivery = false;
          // updateFields.currentDeliveryId = null;
          // updateFields.deliveryStatus = null;
          
          if (Object.keys(updateFields).length > 0) {
            await User.findByIdAndUpdate(user._id, updateFields);
            this.results.usersFixed++;
          }
        } else {
          console.log(`✅ Usuario ${user.name} tiene delivery activo válido`);
        }
      }
      
      console.log(`✅ Estados de usuarios verificados y limpiados`);

    } catch (error) {
      console.error('❌ Error reseteando estados de usuarios:', error.message);
      throw error;
    }
  }

  async generateFrontendCleanupInstructions() {
    console.log('\n📱 Generando instrucciones para limpiar frontend...');
    
    // Crear script para limpiar AsyncStorage del frontend
    const frontendCleanupScript = `
// Script para limpiar el estado del frontend
// Ejecutar en el componente de delivery o en App.js

import AsyncStorage from '@react-native-async-storage/async-storage';

const clearDeliveryState = async () => {
  try {
    const keysToRemove = [
      'currentDelivery',
      'pendingDeliveryOps',
      'deliveryErrorQueue',
      'pendingLocationOps',
      'activeDeliveryId',
      'deliveryStatus',
      'lastDeliveryUpdate'
    ];
    
    await AsyncStorage.multiRemove(keysToRemove);
    console.log('✅ Estado de delivery limpiado del AsyncStorage');
    
    // Opcional: Forzar logout y re-login
    // await logout();
    
  } catch (error) {
    console.error('❌ Error limpiando estado de delivery:', error);
  }
};

// Llamar esta función al abrir la app o en un botón de emergencia
clearDeliveryState();
`;

    // Guardar el script en un archivo
    const fs = require('fs');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, '../temp_frontend_cleanup.js');
    fs.writeFileSync(scriptPath, frontendCleanupScript);
    
    console.log(`📄 Script de limpieza frontend guardado en: ${scriptPath}`);
    
    // También crear una versión para React Native debugging
    const reactNativeCleanup = `
// Para ejecutar en React Native Debugger o consola del navegador
// cuando la app esté corriendo en modo desarrollo

// Método 1: Limpiar AsyncStorage directamente
AsyncStorage.multiRemove([
  'currentDelivery',
  'pendingDeliveryOps', 
  'deliveryErrorQueue',
  'pendingLocationOps'
]).then(() => {
  console.log('Estado de delivery limpiado');
  // Recargar la app
  window.location.reload(); // Solo para web
});

// Método 2: Si tienes acceso a los servicios
// LocationSyncService.clearQueue();
// DeliveryStateManager.clearCurrentDelivery();
// deliveryErrorRecovery.clearErrorQueue();
`;

    const debugScriptPath = path.join(__dirname, '../temp_react_native_debug_cleanup.js');
    fs.writeFileSync(debugScriptPath, reactNativeCleanup);
    
    console.log(`🐛 Script de debug guardado en: ${debugScriptPath}`);
  }

  showResults() {
    console.log('\n📋 RESULTADOS DE LA REPARACIÓN');
    console.log('='.repeat(35));
    console.log(`🗑️ Delivery trackings huérfanos eliminados: ${this.results.orphanedDeliveries}`);
    console.log(`👥 Usuarios delivery limpiados: ${this.results.usersFixed}`);
    console.log(`🔍 Estados inconsistentes encontrados: ${this.results.inconsistentStates}`);
    
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('-'.repeat(20));
    console.log('1. ✅ Base de datos limpiada');
    console.log('2. 📱 Limpiar estado del frontend:');
    console.log('   - Cerrar completamente la app');
    console.log('   - Limpiar caché de la app');
    console.log('   - O ejecutar el script de limpieza frontend');
    console.log('3. 🔄 Reiniciar la app');
    console.log('4. 🔐 Intentar login/logout nuevamente');
    
    console.log('\n💡 Si el problema persiste:');
    console.log('   - Desinstalar y reinstalar la app');
    console.log('   - Verificar que no haya servicios corriendo en background');
    console.log('   - Revisar logs de la consola de desarrollo');
  }

  // Función específica para limpiar el estado de un usuario delivery específico
  async fixSpecificDeliveryUser(userEmail) {
    console.log(`🔧 Arreglando usuario específico: ${userEmail}`);
    
    try {
      const user = await User.findOne({ email: userEmail, role: 'delivery' });
      
      if (!user) {
        console.log('❌ Usuario delivery no encontrado');
        return;
      }
      
      // Eliminar todos los delivery trackings de este usuario
      const deleteResult = await DeliveryTracking.deleteMany({
        deliveryPersonId: user._id
      });
      
      console.log(`🗑️ ${deleteResult.deletedCount} delivery trackings eliminados para ${user.name}`);
      
      // Limpiar estado del usuario si tienes campos específicos
      // await User.findByIdAndUpdate(user._id, { isOnDelivery: false, currentDeliveryId: null });
      
      console.log(`✅ Usuario ${user.name} limpiado exitosamente`);
      
    } catch (error) {
      console.error('❌ Error arreglando usuario específico:', error.message);
      throw error;
    }
  }
}

// Interfaz de línea de comandos
if (require.main === module) {
  const command = process.argv[2];
  const param = process.argv[3];
  
  const fixer = new DeliverySessionFixer();
  
  switch (command) {
    case 'user':
      if (!param) {
        console.error('❌ Especifica el email del usuario: node fixDeliverySession.js user email@example.com');
        process.exit(1);
      }
      fixer.connectToDatabase()
        .then(() => fixer.fixSpecificDeliveryUser(param))
        .finally(() => mongoose.disconnect());
      break;
      
    case 'all':
    default:
      fixer.fixDeliverySessions();
      break;
  }
}

module.exports = { DeliverySessionFixer };