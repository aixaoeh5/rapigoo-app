const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

// Importar modelos
const Order = require('./models/Order');
const DeliveryTracking = require('./models/DeliveryTracking');
const Cart = require('./models/Cart');

async function clearOrders() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Conectado a MongoDB');
    
    // Contar registros antes de eliminar
    const orderCount = await Order.countDocuments();
    const deliveryCount = await DeliveryTracking.countDocuments();
    const cartCount = await Cart.countDocuments();
    
    console.log(`📊 Registros encontrados:`);
    console.log(`   - Pedidos: ${orderCount}`);
    console.log(`   - Delivery Trackings: ${deliveryCount}`);
    console.log(`   - Carritos: ${cartCount}`);
    
    if (orderCount === 0 && deliveryCount === 0 && cartCount === 0) {
      console.log('✅ No hay registros que eliminar');
      process.exit(0);
    }
    
    console.log('🗑️  Eliminando todos los registros...');
    
    // Eliminar todos los pedidos
    const orderResult = await Order.deleteMany({});
    console.log(`✅ Eliminados ${orderResult.deletedCount} pedidos`);
    
    // Eliminar todos los delivery trackings
    const deliveryResult = await DeliveryTracking.deleteMany({});
    console.log(`✅ Eliminados ${deliveryResult.deletedCount} delivery trackings`);
    
    // Eliminar todos los carritos
    const cartResult = await Cart.deleteMany({});
    console.log(`✅ Eliminados ${cartResult.deletedCount} carritos`);
    
    console.log('🎉 ¡Limpieza completada exitosamente!');
    
    // Verificar que todo se eliminó
    const finalOrderCount = await Order.countDocuments();
    const finalDeliveryCount = await DeliveryTracking.countDocuments();
    const finalCartCount = await Cart.countDocuments();
    
    console.log(`📊 Registros restantes:`);
    console.log(`   - Pedidos: ${finalOrderCount}`);
    console.log(`   - Delivery Trackings: ${finalDeliveryCount}`);
    console.log(`   - Carritos: ${finalCartCount}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error limpiando la base de datos:', error);
    process.exit(1);
  }
}

// Ejecutar la función
clearOrders();