const mongoose = require('mongoose');
require('dotenv').config();

async function createSearchIndexes() {
    try {
        console.log('🔄 Conectando a MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        // Crear índices de texto para búsqueda
        console.log('🔄 Creando índices de búsqueda...');

        // Índice para usuarios/comerciantes
        try {
            await mongoose.connection.db.collection('users').createIndex({
                'business.businessName': 'text',
                'business.description': 'text',
                'business.category': 'text',
                'name': 'text'
            }, {
                name: 'search_users_text',
                default_language: 'spanish'
            });
            console.log('✅ Índice de texto creado para usuarios/comerciantes');
        } catch (error) {
            if (error.codeName === 'IndexOptionsConflict') {
                console.log('⚠️ Índice de usuarios ya existe, actualizando...');
                await mongoose.connection.db.collection('users').dropIndex('search_users_text');
                await mongoose.connection.db.collection('users').createIndex({
                    'business.businessName': 'text',
                    'business.description': 'text',
                    'business.category': 'text',
                    'name': 'text'
                }, {
                    name: 'search_users_text',
                    default_language: 'spanish'
                });
                console.log('✅ Índice de usuarios actualizado');
            } else {
                throw error;
            }
        }

        // Índice para servicios
        try {
            await mongoose.connection.db.collection('services').createIndex({
                'name': 'text',
                'description': 'text',
                'category': 'text',
                'tags': 'text'
            }, {
                name: 'search_services_text',
                default_language: 'spanish'
            });
            console.log('✅ Índice de texto creado para servicios');
        } catch (error) {
            if (error.codeName === 'IndexOptionsConflict') {
                console.log('⚠️ Índice de servicios ya existe, actualizando...');
                await mongoose.connection.db.collection('services').dropIndex('search_services_text');
                await mongoose.connection.db.collection('services').createIndex({
                    'name': 'text',
                    'description': 'text',
                    'category': 'text',
                    'tags': 'text'
                }, {
                    name: 'search_services_text',
                    default_language: 'spanish'
                });
                console.log('✅ Índice de servicios actualizado');
            } else {
                throw error;
            }
        }

        // Índices geoespaciales para ubicaciones
        try {
            await mongoose.connection.db.collection('users').createIndex({
                'business.location': '2dsphere'
            }, {
                name: 'geo_users_location'
            });
            console.log('✅ Índice geoespacial creado para comerciantes');
        } catch (error) {
            if (error.codeName === 'IndexOptionsConflict') {
                console.log('⚠️ Índice geoespacial de usuarios ya existe');
            } else {
                throw error;
            }
        }

        // Índices para optimizar consultas frecuentes
        await mongoose.connection.db.collection('users').createIndex({ role: 1, merchantStatus: 1 });
        await mongoose.connection.db.collection('services').createIndex({ merchantId: 1, available: 1 });
        await mongoose.connection.db.collection('services').createIndex({ category: 1, available: 1 });
        await mongoose.connection.db.collection('orders').createIndex({ customerId: 1, status: 1 });
        await mongoose.connection.db.collection('orders').createIndex({ merchantId: 1, status: 1 });
        
        console.log('✅ Índices de optimización creados');

        console.log('🎉 Todos los índices de búsqueda fueron creados exitosamente');
        
        // Mostrar estadísticas de los índices
        const usersIndexes = await mongoose.connection.db.collection('users').indexes();
        const servicesIndexes = await mongoose.connection.db.collection('services').indexes();
        
        console.log('\n📊 Índices creados:');
        console.log('Users:', usersIndexes.map(idx => idx.name).join(', '));
        console.log('Services:', servicesIndexes.map(idx => idx.name).join(', '));

    } catch (error) {
        console.error('❌ Error creando índices:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Conexión a MongoDB cerrada');
    }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
    createSearchIndexes();
}

module.exports = createSearchIndexes;