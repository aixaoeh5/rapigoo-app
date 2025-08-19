const mongoose = require('mongoose');
const DeliveryTracking = require('../models/DeliveryTracking');
const Order = require('../models/Order');
require('dotenv').config();

async function createTestDelivery() {
    try {
        console.log('🔄 Conectando a MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        // Simular ubicaciones de Santo Domingo para testing
        const testDeliveryData = {
            orderId: new mongoose.Types.ObjectId(),
            deliveryPersonId: new mongoose.Types.ObjectId(), 
            status: 'heading_to_pickup',
            
            // Ubicación actual del delivery (Plaza de la Cultura)
            currentLocation: {
                coordinates: [-69.9312117, 18.4645],
                accuracy: 5,
                altitude: 50,
                heading: 45,
                speed: 15,
                timestamp: new Date()
            },
            
            // Ruta simulada (3 puntos)
            route: [
                {
                    coordinates: [-69.9312117, 18.4645], // Plaza de la Cultura
                    timestamp: new Date(Date.now() - 300000), // 5 min ago
                    distanceFromPrevious: 0
                },
                {
                    coordinates: [-69.9365, 18.4712], // Av. Churchill
                    timestamp: new Date(Date.now() - 180000), // 3 min ago
                    distanceFromPrevious: 800
                },
                {
                    coordinates: [-69.9421, 18.4789], // Cerca del destino
                    timestamp: new Date(),
                    distanceFromPrevious: 950
                }
            ],
            
            // Ubicación de pickup (Restaurante)
            pickupLocation: {
                coordinates: [-69.9365, 18.4712],
                address: 'Av. Winston Churchill #500, Plaza Comercial',
                arrived: true,
                arrivedAt: new Date(Date.now() - 120000), // 2 min ago
                leftAt: new Date(Date.now() - 60000) // 1 min ago
            },
            
            // Ubicación de entrega (Cliente)
            deliveryLocation: {
                coordinates: [-69.9456, 18.4823],
                address: 'Calle José Martí #123, Gazcue',
                arrived: false
            },
            
            // Métricas
            totalDistance: 2.3, // km
            estimatedTotalTime: 15, // minutos
            actualTotalTime: null,
            metrics: {
                averageSpeed: 18, // km/h
                maxSpeed: 35,
                totalStops: 1,
                onTimeDelivery: null
            },
            
            isLive: true,
            lastLocationUpdate: new Date(),
            deliveryNotes: 'Cliente prefiere entrega en portería del edificio'
        };

        // Crear el tracking de prueba
        const deliveryTracking = new DeliveryTracking(testDeliveryData);
        await deliveryTracking.save();

        console.log('✅ Delivery tracking de prueba creado:');
        console.log('   Order ID:', deliveryTracking.orderId);
        console.log('   Status:', deliveryTracking.status);
        console.log('   Current Location:', deliveryTracking.currentLocation.coordinates);
        console.log('   Total Distance:', deliveryTracking.totalDistance, 'km');
        
        // También crear una orden de prueba asociada
        const testOrder = {
            _id: deliveryTracking.orderId,
            orderNumber: 'TEST-' + Date.now(),
            customerId: new mongoose.Types.ObjectId(),
            merchantId: new mongoose.Types.ObjectId(),
            deliveryPersonId: deliveryTracking.deliveryPersonId,
            status: 'picked_up',
            items: [
                {
                    serviceId: new mongoose.Types.ObjectId(),
                    name: 'Pollo a la brasa con tostones',
                    price: 450,
                    quantity: 1,
                    subtotal: 450
                }
            ],
            subtotal: 450,
            deliveryFee: 80,
            total: 530,
            deliveryInfo: {
                address: {
                    street: 'Calle José Martí #123',
                    city: 'Santo Domingo',
                    state: 'Distrito Nacional',
                    coordinates: [-69.9456, 18.4823]
                },
                instructions: 'Entregar en portería del edificio',
                contactPhone: '+1 (809) 555-0123',
                estimatedDeliveryTime: new Date(Date.now() + 600000) // 10 min desde ahora
            },
            paymentInfo: {
                method: 'cash',
                status: 'completed',
                amount: 530,
                currency: 'DOP'
            },
            tracking: [
                {
                    status: 'pending',
                    timestamp: new Date(Date.now() - 1800000), // 30 min ago
                    description: 'Pedido recibido',
                    updatedBy: 'system'
                },
                {
                    status: 'confirmed',
                    timestamp: new Date(Date.now() - 1500000), // 25 min ago
                    description: 'Pedido confirmado por el comerciante',
                    updatedBy: 'merchant'
                },
                {
                    status: 'assigned',
                    timestamp: new Date(Date.now() - 900000), // 15 min ago
                    description: 'Delivery asignado',
                    updatedBy: 'system'
                },
                {
                    status: 'picked_up',
                    timestamp: new Date(Date.now() - 300000), // 5 min ago
                    description: 'Pedido recogido por el delivery',
                    location: [-69.9365, 18.4712],
                    updatedBy: 'delivery'
                }
            ],
            placedAt: new Date(Date.now() - 1800000),
            confirmedAt: new Date(Date.now() - 1500000)
        };

        const order = new Order(testOrder);
        await order.save();

        console.log('✅ Orden de prueba creada:', order.orderNumber);
        console.log('\n📱 Para probar el tracking desde la app:');
        console.log('   Order ID:', deliveryTracking.orderId);
        console.log('   Endpoint: GET /api/delivery/' + deliveryTracking.orderId + '/tracking');
        
        console.log('\n🗺️ Ubicaciones de prueba:');
        console.log('   Pickup: Av. Winston Churchill (Plaza Comercial)');
        console.log('   Delivery: Calle José Martí, Gazcue');
        console.log('   Current: En ruta hacia el cliente');

    } catch (error) {
        console.error('❌ Error creando delivery de prueba:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Conexión a MongoDB cerrada');
    }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
    createTestDelivery();
}

module.exports = createTestDelivery;