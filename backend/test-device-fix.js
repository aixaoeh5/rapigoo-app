#!/usr/bin/env node

/**
 * Script para probar el fix del error E11000 en registro de dispositivos
 * Ejecutar: node test-device-fix.js
 */

const mongoose = require('mongoose');
const DeviceToken = require('./models/DeviceToken');

// Configuración de la base de datos
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rapigoo_db';

// Token problemático del error
const PROBLEMATIC_TOKEN = 'expo_go_1755143319164_t78j30z1f';

async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Conectado a MongoDB');
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error);
        process.exit(1);
    }
}

async function testDuplicateScenario() {
    console.log('\n🧪 === PRUEBA DE ESCENARIO DUPLICADO ===');
    
    const userId1 = new mongoose.Types.ObjectId();
    const userId2 = new mongoose.Types.ObjectId();
    
    console.log('📱 Token problemático:', PROBLEMATIC_TOKEN);
    console.log('👤 Usuario 1:', userId1);
    console.log('👤 Usuario 2:', userId2);
    
    try {
        // Limpiar token problemático si existe
        await DeviceToken.deleteMany({ deviceToken: PROBLEMATIC_TOKEN });
        console.log('🧹 Token problemático limpiado');
        
        // Escenario 1: Primer usuario registra el token
        console.log('\n📝 Escenario 1: Primer usuario registra token...');
        const device1 = await DeviceToken.upsertToken(
            userId1,
            PROBLEMATIC_TOKEN,
            'android',
            { model: 'Test Device 1', version: '1.0', appVersion: '1.0.0' }
        );
        console.log('✅ Primera inserción exitosa:', device1._id);
        
        // Escenario 2: Mismo usuario registra el mismo token (debería actualizar)
        console.log('\n📝 Escenario 2: Mismo usuario registra mismo token...');
        const device2 = await DeviceToken.upsertToken(
            userId1,
            PROBLEMATIC_TOKEN,
            'android',
            { model: 'Test Device 1 Updated', version: '1.1', appVersion: '1.0.1' }
        );
        console.log('✅ Actualización exitosa:', device2._id);
        console.log('🔍 Mismo ID?', device1._id.toString() === device2._id.toString() ? 'SÍ' : 'NO');
        
        // Escenario 3: Otro usuario intenta registrar el mismo token (debería transferir)
        console.log('\n📝 Escenario 3: Otro usuario intenta mismo token...');
        const device3 = await DeviceToken.upsertToken(
            userId2,
            PROBLEMATIC_TOKEN,
            'android',
            { model: 'Test Device 2', version: '2.0', appVersion: '1.0.2' }
        );
        console.log('✅ Transferencia exitosa:', device3._id);
        console.log('🔍 Nuevo usuario?', device3.userId.toString() === userId2.toString() ? 'SÍ' : 'NO');
        
        // Verificar estado final
        const finalTokens = await DeviceToken.find({ deviceToken: PROBLEMATIC_TOKEN });
        console.log('\n📊 Estado final:');
        console.log('🔢 Total de tokens con este deviceToken:', finalTokens.length);
        finalTokens.forEach((token, index) => {
            console.log(`   Token ${index + 1}:`, {
                userId: token.userId.toString(),
                isActive: token.isActive,
                lastUpdated: token.lastUpdated
            });
        });
        
        // Escenario 4: Múltiples registros simultáneos (race condition test)
        console.log('\n📝 Escenario 4: Múltiples registros simultáneos...');
        const promises = [];
        for (let i = 0; i < 5; i++) {
            const userId = new mongoose.Types.ObjectId();
            promises.push(
                DeviceToken.upsertToken(
                    userId,
                    PROBLEMATIC_TOKEN,
                    'android',
                    { model: `Concurrent Device ${i}`, version: '1.0', appVersion: '1.0.0' }
                )
            );
        }
        
        const results = await Promise.all(promises);
        console.log('✅ Registros simultáneos completados:', results.length);
        
        // Verificar que no hay duplicados después de concurrent access
        const finalCheck = await DeviceToken.find({ deviceToken: PROBLEMATIC_TOKEN });
        console.log('🔢 Tokens después de concurrent access:', finalCheck.length);
        
        if (finalCheck.length === 1) {
            console.log('✅ SUCCESS: No hay duplicados después de múltiples accesos simultáneos');
        } else {
            console.log('❌ FAIL: Hay duplicados después de accesos simultáneos');
        }
        
    } catch (error) {
        console.error('❌ Error en prueba:', error);
        if (error.code === 11000) {
            console.error('💥 ERROR E11000 TODAVÍA OCURRE - Fix no funciona completamente');
        }
    }
}

async function testStats() {
    console.log('\n📈 === ESTADÍSTICAS DE TOKENS ===');
    
    try {
        const stats = await DeviceToken.getStats();
        console.log('📊 Estadísticas por plataforma:');
        stats.forEach(stat => {
            console.log(`   ${stat._id}: ${stat.active} activos, ${stat.inactive} inactivos, ${stat.total} total`);
        });
        
        const totalActive = await DeviceToken.countDocuments({ isActive: true });
        const totalInactive = await DeviceToken.countDocuments({ isActive: false });
        const totalTokens = await DeviceToken.countDocuments();
        
        console.log('\n📋 Resumen general:');
        console.log(`   Total tokens: ${totalTokens}`);
        console.log(`   Activos: ${totalActive}`);
        console.log(`   Inactivos: ${totalInactive}`);
        
    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
    }
}

async function main() {
    console.log('🔧 === PRUEBA DEL FIX E11000 DEVICE TOKEN ===\n');
    
    await connectDB();
    await testDuplicateScenario();
    await testStats();
    
    console.log('\n✨ Prueba completada!');
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { testDuplicateScenario, testStats };