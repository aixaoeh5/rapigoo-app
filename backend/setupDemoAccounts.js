const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Service = require('./models/Service');
const Order = require('./models/Order');
const Category = require('./models/Category');
require('dotenv').config();

async function setupDemoAccounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // 1. ACTUALIZAR CUENTA DE CLIENTE
    console.log('\n📱 Actualizando cuenta de cliente...');
    let cliente = await User.findOne({ email: 'cliente-test@rapigoo.com' });
    if (cliente) {
      cliente.name = 'Juan Pérez';
      cliente.phone = '809-555-0100';
      cliente.address = {
        street: 'Calle Principal #123, Los Jardines',
        city: 'Santo Domingo',
        state: 'Distrito Nacional',
        zipCode: '10101',
        coordinates: [18.4861, -69.9312] // Santo Domingo
      };
      cliente.profileImage = 'https://ui-avatars.com/api/?name=Juan+Perez&background=FF6B6B&color=fff';
      cliente.preferences = {
        favoriteCategories: ['Restaurante', 'Comida Rápida', 'Postres'],
        dietaryRestrictions: ['Sin gluten'],
        preferredPaymentMethod: 'card'
      };
      cliente.notificationPreferences = {
        orderUpdates: true,
        promotions: true,
        newMerchants: true,
        sound: true,
        vibrate: true
      };
      await cliente.save();
      console.log('✅ Cliente actualizado: Juan Pérez');
    } else {
      console.log('❌ No se encontró la cuenta cliente-test@rapigoo.com');
      console.log('   Ejecuta primero: node createUser.js');
      await mongoose.disconnect();
      return;
    }

    // 2. ACTUALIZAR CUENTA DE COMERCIANTE
    console.log('\n🏪 Actualizando cuenta de comerciante...');
    let comerciante = await User.findOne({ email: 'mi-comerciante@rapigoo.com' });
    if (comerciante) {
      comerciante.name = 'María Rodríguez';
      comerciante.business = {
        businessName: 'Restaurante El Sabroso',
        rnc: '123456789',
        category: 'Restaurante',
        address: 'Av. Winston Churchill #500, Plaza Comercial',
        city: 'Santo Domingo',
        description: 'Deliciosa comida dominicana tradicional con un toque moderno. Especialistas en mangú, pollo guisado y tostones.',
        phone: '809-555-0200',
        email: 'contacto@elsabroso.com',
        socialMedia: '@elsabrosoRD',
        schedule: {
          opening: '08:00',
          closing: '22:00'
        },
        deliveryFee: 50,
        minimumOrder: 300,
        estimatedDeliveryTime: '30-45 min',
        logo: 'https://ui-avatars.com/api/?name=El+Sabroso&background=4CAF50&color=fff',
        coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop',
        rating: 4.5,
        totalRatings: 127,
        verified: true
      };
      await comerciante.save();
      console.log('✅ Comerciante actualizado: Restaurante El Sabroso');

      // Crear categorías para el comerciante
      console.log('📂 Creando categorías del menú...');
      
      // Primero eliminar categorías y servicios antiguos
      await Category.deleteMany({ merchantId: comerciante._id });
      await Service.deleteMany({ merchantId: comerciante._id });

      // Crear categorías
      const categorias = [
        { name: 'Platos Principales', icon: '🍽️', order: 1, description: 'Nuestros platos más populares' },
        { name: 'Acompañantes', icon: '🥗', order: 2, description: 'Para complementar tu comida' },
        { name: 'Bebidas', icon: '🥤', order: 3, description: 'Refrescantes y deliciosas' },
        { name: 'Postres', icon: '🍰', order: 4, description: 'El toque dulce perfecto' }
      ];

      const categoriaIds = {};
      for (const catData of categorias) {
        const categoria = new Category({
          merchantId: comerciante._id,
          ...catData
        });
        await categoria.save();
        categoriaIds[catData.name] = categoria._id;
        console.log(`✅ Categoría creada: ${catData.name}`);
      }

      // Crear servicios/productos para el comerciante
      console.log('📦 Creando productos del menú...');

      const productos = [
        // Platos Principales
        {
          merchantId: comerciante._id,
          name: 'Mangú Tres Golpes',
          description: 'Tradicional mangú dominicano con queso frito, huevo y salami',
          price: 285,
          categoryId: categoriaIds['Platos Principales'],
          categoryId: categoriaIds['Platos Principales'],
          category: 'Platos Principales',
          images: ['https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 20,
          tags: ['Desayuno', 'Tradicional', 'Popular'],
          options: [
            { name: 'Extra queso', price: 35 },
            { name: 'Extra salami', price: 40 },
            { name: 'Sin cebolla', price: 0 }
          ]
        },
        {
          merchantId: comerciante._id,
          name: 'Pollo Guisado',
          description: 'Pollo en salsa criolla con arroz blanco, habichuelas y ensalada',
          price: 350,
          categoryId: categoriaIds['Platos Principales'],
          category: 'Platos Principales',
          images: ['https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 25,
          tags: ['Almuerzo', 'Tradicional', 'Bestseller'],
          options: [
            { name: 'Extra arroz', price: 30 },
            { name: 'Tostones en vez de ensalada', price: 25 },
            { name: 'Picante', price: 0 }
          ]
        },
        {
          merchantId: comerciante._id,
          name: 'Sancocho Dominicano',
          description: 'Sancocho de 7 carnes con arroz blanco y aguacate',
          price: 450,
          categoryId: categoriaIds['Platos Principales'],
          category: 'Platos Principales',
          images: ['https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 30,
          tags: ['Almuerzo', 'Tradicional', 'Especial'],
          isSpecial: true,
          discount: 10
        },
        {
          merchantId: comerciante._id,
          name: 'Bandeja Paisa Criolla',
          description: 'Arroz, habichuelas, carne guisada, plátano maduro, huevo y aguacate',
          price: 425,
          categoryId: categoriaIds['Platos Principales'],
          category: 'Platos Principales',
          images: ['https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 25,
          tags: ['Almuerzo', 'Completo']
        },
        
        // Acompañantes
        {
          merchantId: comerciante._id,
          name: 'Tostones',
          description: 'Plátano verde frito con sal y ajo',
          price: 85,
          categoryId: categoriaIds['Acompañantes'],
          category: 'Acompañantes',
          images: ['https://images.unsplash.com/photo-1528751014936-863e6e7a319c?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 10,
          tags: ['Frito', 'Tradicional']
        },
        {
          merchantId: comerciante._id,
          name: 'Yuca Hervida',
          description: 'Yuca cocida con mojo de ajo',
          price: 75,
          categoryId: categoriaIds['Acompañantes'],
          category: 'Acompañantes',
          images: ['https://images.unsplash.com/photo-1550317138-10000687a72b?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 15,
          tags: ['Hervido', 'Saludable']
        },
        {
          merchantId: comerciante._id,
          name: 'Ensalada Verde',
          description: 'Lechuga, tomate, pepino con aderezo de la casa',
          price: 95,
          categoryId: categoriaIds['Acompañantes'],
          category: 'Acompañantes',
          images: ['https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 5,
          tags: ['Saludable', 'Fresco']
        },
        
        // Bebidas
        {
          merchantId: comerciante._id,
          name: 'Morir Soñando',
          description: 'Bebida tradicional de leche y naranja',
          price: 85,
          categoryId: categoriaIds['Bebidas'],
          category: 'Bebidas',
          images: ['https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 5,
          tags: ['Frío', 'Tradicional', 'Dulce'],
          options: [
            { name: 'Extra grande', price: 25 },
            { name: 'Sin azúcar', price: 0 }
          ]
        },
        {
          merchantId: comerciante._id,
          name: 'Jugo de Chinola',
          description: 'Jugo natural de maracuyá',
          price: 65,
          categoryId: categoriaIds['Bebidas'],
          category: 'Bebidas',
          images: ['https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 5,
          tags: ['Natural', 'Frío']
        },
        {
          merchantId: comerciante._id,
          name: 'Mama Juana',
          description: 'Bebida tradicional dominicana con hierbas',
          price: 150,
          categoryId: categoriaIds['Bebidas'],
          category: 'Bebidas',
          images: ['https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 2,
          tags: ['Alcohólica', 'Tradicional'],
          ageRestricted: true
        },
        
        // Postres
        {
          merchantId: comerciante._id,
          name: 'Flan de Coco',
          description: 'Flan casero con coco rallado',
          price: 120,
          categoryId: categoriaIds['Postres'],
          category: 'Postres',
          images: ['https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 5,
          tags: ['Dulce', 'Casero'],
          isSpecial: true
        },
        {
          merchantId: comerciante._id,
          name: 'Habichuelas con Dulce',
          description: 'Postre tradicional de Semana Santa',
          price: 95,
          categoryId: categoriaIds['Postres'],
          category: 'Postres',
          images: ['https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 5,
          tags: ['Tradicional', 'Temporada']
        },
        {
          merchantId: comerciante._id,
          name: 'Bizcocho Dominicano',
          description: 'Bizcocho esponjoso con merengue de guayaba',
          price: 135,
          categoryId: categoriaIds['Postres'],
          category: 'Postres',
          images: ['https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=300&fit=crop'],
          available: true,
          preparationTime: 5,
          tags: ['Dulce', 'Especial']
        }
      ];

      for (const producto of productos) {
        await Service.create(producto);
      }
      console.log(`✅ ${productos.length} productos creados para el menú`);
    } else {
      console.log('❌ No se encontró la cuenta mi-comerciante@rapigoo.com');
      console.log('   Ejecuta primero: node createMerchant.js');
      await mongoose.disconnect();
      return;
    }

    // 3. NOTA: No se puede crear cuenta de delivery porque el rol no existe en el modelo
    console.log('\n⚠️  Nota: El rol "delivery" no está implementado en el modelo User');
    console.log('   Solo se pueden crear usuarios: cliente, comerciante, admin');
    
    // Usar el comerciante como referencia temporal para los pedidos
    const delivery = comerciante; // Temporal para que los pedidos funcionen

    // 4. CREAR ALGUNOS PEDIDOS DE EJEMPLO
    console.log('\n📋 Creando pedidos de ejemplo...');
    
    // Eliminar pedidos antiguos
    await Order.deleteMany({});

    const pedidosEjemplo = [
      {
        customerId: cliente._id,
        merchantId: comerciante._id,
        deliveryPersonId: delivery._id,
        orderNumber: 'ORD-2024-001',
        status: 'delivered',
        items: [
          {
            serviceId: new mongoose.Types.ObjectId(),
            name: 'Pollo Guisado',
            description: 'Con arroz y habichuelas',
            price: 350,
            quantity: 1,
            subtotal: 350
          },
          {
            serviceId: new mongoose.Types.ObjectId(),
            name: 'Morir Soñando',
            description: 'Grande',
            price: 110,
            quantity: 1,
            subtotal: 110
          }
        ],
        subtotal: 460,
        deliveryFee: 50,
        serviceFee: 23,
        tax: 46,
        total: 579,
        deliveryInfo: {
          address: {
            street: 'Calle Principal #123',
            city: 'Santo Domingo',
            state: 'DN',
            zipCode: '10101',
            coordinates: [18.4861, -69.9312]
          },
          estimatedDeliveryTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Hace 2 días
          actualDeliveryTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 35 * 60 * 1000), // 35 min después
          contactPhone: '809-555-0100'
        },
        paymentInfo: {
          method: 'cash',
          amount: 579,
          status: 'completed'
        },
        customerReview: {
          ratings: {
            merchant: 5,
            delivery: 5
          },
          comment: 'Excelente comida y servicio rápido!',
          reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        customerId: cliente._id,
        merchantId: comerciante._id,
        orderNumber: 'ORD-2024-002',
        status: 'preparing',
        items: [
          {
            serviceId: new mongoose.Types.ObjectId(),
            name: 'Sancocho Dominicano',
            description: 'Especial del día',
            price: 405, // Con descuento
            quantity: 2,
            subtotal: 810
          },
          {
            serviceId: new mongoose.Types.ObjectId(),
            name: 'Jugo de Chinola',
            description: 'Natural',
            price: 65,
            quantity: 2,
            subtotal: 130
          }
        ],
        subtotal: 940,
        deliveryFee: 50,
        serviceFee: 47,
        tax: 94,
        total: 1131,
        deliveryInfo: {
          address: {
            street: 'Calle Principal #123',
            city: 'Santo Domingo',
            state: 'DN',
            zipCode: '10101',
            coordinates: [18.4861, -69.9312]
          },
          estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000), // En 45 minutos
          instructions: 'Apartamento 2B, tocar el timbre',
          contactPhone: '809-555-0100'
        },
        paymentInfo: {
          method: 'card',
          amount: 1131,
          status: 'pending',
          transactionId: 'TRX-123456'
        },
        createdAt: new Date() // Ahora
      }
    ];

    for (const pedido of pedidosEjemplo) {
      await Order.create(pedido);
    }
    console.log(`✅ ${pedidosEjemplo.length} pedidos de ejemplo creados`);

    // RESUMEN FINAL
    console.log('\n🎉 ¡CONFIGURACIÓN COMPLETADA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 CUENTA CLIENTE:');
    console.log(`   Email: cliente-test@rapigoo.com`);
    console.log(`   Contraseña: 123456`);
    console.log(`   Nombre: Juan Pérez`);
    console.log(`   Teléfono: 809-555-0100`);
    console.log(`   ✅ Historial de pedidos creado`);
    console.log('');
    console.log('🏪 CUENTA COMERCIANTE:');
    console.log(`   Email: mi-comerciante@rapigoo.com`);
    console.log(`   Contraseña: 123456`);
    console.log(`   Negocio: Restaurante El Sabroso`);
    console.log(`   Propietaria: María Rodríguez`);
    console.log(`   ✅ 13 productos en el menú`);
    console.log(`   ✅ Pedidos activos`);
    console.log('');
    console.log('⚠️  CUENTA DELIVERY:');
    console.log(`   No disponible - El rol delivery no está implementado`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 PARA LA DEMOSTRACIÓN:');
    console.log('1. El cliente puede buscar "El Sabroso" y hacer pedidos');
    console.log('2. El comerciante verá los pedidos en tiempo real');
    console.log('3. Los pedidos tienen historial completo para mostrar');
    console.log('4. Hay historial de pedidos para mostrar');
    
    await mongoose.disconnect();
    console.log('\n✅ Desconectado de MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

setupDemoAccounts();