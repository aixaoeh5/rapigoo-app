const mongoose = require('mongoose');
const SystemCategory = require('../models/SystemCategory');
require('dotenv').config();

const categories = [
  { name: 'Colmado', icon: '🏪', order: 1, description: 'Tiendas de conveniencia y abarrotes' },
  { name: 'Farmacia', icon: '💊', order: 2, description: 'Medicamentos y productos de salud' },
  { name: 'Belleza', icon: '💄', order: 3, description: 'Productos de belleza y cuidado personal' },
  { name: 'Restaurantes', icon: '🍽️', order: 4, description: 'Comida preparada y platos especiales' },
  { name: 'Pizzería', icon: '🍕', order: 5, description: 'Pizza y comida italiana' },
  { name: 'Comedores', icon: '🍱', order: 6, description: 'Comida casera y económica' },
  { name: 'Comida rápida', icon: '🍔', order: 7, description: 'Hamburguesas, hot dogs y más' },
  { name: 'Postres', icon: '🍰', order: 8, description: 'Dulces, pasteles y golosinas' },
  { name: 'Panadería', icon: '🥖', order: 9, description: 'Pan fresco y productos horneados' },
  { name: 'Heladería', icon: '🍦', order: 10, description: 'Helados y bebidas frías' },
  { name: 'Ferretería', icon: '🔧', order: 11, description: 'Herramientas y materiales de construcción' },
  { name: 'Supermercado', icon: '🛒', order: 12, description: 'Compras completas del hogar' },
  { name: 'Licorería', icon: '🍺', order: 13, description: 'Bebidas alcohólicas' },
  { name: 'Carnicería', icon: '🥩', order: 14, description: 'Carnes frescas y embutidos' },
  { name: 'Verduras', icon: '🥬', order: 15, description: 'Frutas y vegetales frescos' }
];

async function initializeCategories() {
  try {
    // Leer configuración desde .env
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/rapigoo';
    console.log('🔗 Intentando conectar a MongoDB...');
    
    // Conectar con configuración optimizada
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // 10 segundos timeout
      socketTimeoutMS: 45000, // 45 segundos socket timeout
      bufferCommands: false,
      maxPoolSize: 10
    });
    console.log('✅ Conectado a MongoDB Atlas exitosamente');

    // Verificar si ya existen categorías
    const existingCount = await SystemCategory.countDocuments();
    
    if (existingCount > 0) {
      console.log(`ℹ️  Ya existen ${existingCount} categorías en el sistema`);
      const updateExisting = process.argv.includes('--update');
      
      if (!updateExisting) {
        console.log('Use --update para actualizar las categorías existentes');
        process.exit(0);
      }
    }

    // Crear o actualizar categorías
    for (const categoryData of categories) {
      const existingCategory = await SystemCategory.findOne({ name: categoryData.name });
      
      if (existingCategory) {
        // Actualizar categoría existente
        existingCategory.icon = categoryData.icon;
        existingCategory.order = categoryData.order;
        existingCategory.description = categoryData.description;
        existingCategory.isActive = true;
        await existingCategory.save();
        console.log(`✅ Actualizada: ${categoryData.name}`);
      } else {
        // Crear nueva categoría
        const newCategory = new SystemCategory(categoryData);
        await newCategory.save();
        console.log(`✅ Creada: ${categoryData.name}`);
      }
    }

    console.log('\n✅ Categorías del sistema inicializadas correctamente');
    
    // Mostrar resumen
    const totalCategories = await SystemCategory.countDocuments();
    const activeCategories = await SystemCategory.countDocuments({ isActive: true });
    
    console.log(`\n📊 Resumen:`);
    console.log(`   Total de categorías: ${totalCategories}`);
    console.log(`   Categorías activas: ${activeCategories}`);

  } catch (error) {
    console.error('❌ Error inicializando categorías:', error.message);
    
    if (error.name === 'MongooseServerSelectionError') {
      console.log('\n💡 Posibles soluciones:');
      console.log('1. Verificar conexión a internet');
      console.log('2. Verificar que la IP esté en whitelist de MongoDB Atlas');
      console.log('3. Verificar credenciales en .env');
      console.log('4. Intentar desde otra red');
    }
    
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n👋 Conexión cerrada');
    }
  }
}

// Ejecutar script
initializeCategories();