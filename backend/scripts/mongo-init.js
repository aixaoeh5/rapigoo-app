// MongoDB initialization script for production
// This script runs when the MongoDB container starts for the first time

// Switch to the rapigoo database
db = db.getSiblingDB('rapigoo');

// Create application user with read/write permissions
db.createUser({
  user: 'rapigoo_app',
  pwd: 'app_password_change_in_production',
  roles: [
    {
      role: 'readWrite',
      db: 'rapigoo'
    }
  ]
});

// Create indexes for better performance
print('Creating indexes...');

// Users collection indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "merchantStatus": 1 });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "createdAt": -1 });
db.users.createIndex({ "business.category": 1 });
db.users.createIndex({ "rating": -1 });
db.users.createIndex({ "favorites.merchants": 1 });
db.users.createIndex({ "favorites.services": 1 });

// Services collection indexes
db.services.createIndex({ "merchantId": 1 });
db.services.createIndex({ "available": 1 });
db.services.createIndex({ "category": 1 });
db.services.createIndex({ "price": 1 });
db.services.createIndex({ "rating": -1 });
db.services.createIndex({ "name": "text", "description": "text", "tags": "text" });

// Orders collection indexes
db.orders.createIndex({ "userId": 1 });
db.orders.createIndex({ "merchantId": 1 });
db.orders.createIndex({ "status": 1 });
db.orders.createIndex({ "createdAt": -1 });
db.orders.createIndex({ "orderNumber": 1 }, { unique: true });

// Cart collection indexes
db.carts.createIndex({ "userId": 1 }, { unique: true });
db.carts.createIndex({ "lastUpdated": 1 });

// Device tokens collection indexes
db.devicetokens.createIndex({ "userId": 1 });
db.devicetokens.createIndex({ "deviceToken": 1 }, { unique: true });
db.devicetokens.createIndex({ "isActive": 1 });
db.devicetokens.createIndex({ "platform": 1 });

// Compound indexes for better query performance
db.users.createIndex({ "merchantStatus": 1, "rating": -1 });
db.services.createIndex({ "merchantId": 1, "available": 1 });
db.orders.createIndex({ "userId": 1, "status": 1 });
db.orders.createIndex({ "merchantId": 1, "status": 1 });

print('Indexes created successfully!');

// Insert initial data if needed
print('Inserting initial data...');

// Create admin user if it doesn't exist
const adminExists = db.users.findOne({ email: 'admin@rapigoo.com' });
if (!adminExists) {
  db.users.insertOne({
    name: 'Rapigoo Admin',
    email: 'admin@rapigoo.com',
    password: '$2a$10$placeholder_hash_change_in_production',
    role: 'admin',
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  print('Admin user created');
}

// Create categories collection for reference
db.categories.drop(); // Remove existing if any
db.categories.insertMany([
  { name: 'Restaurante', icon: 'restaurant', color: '#FF6B35' },
  { name: 'Comida Rápida', icon: 'fast-food', color: '#F7931E' },
  { name: 'Supermercado', icon: 'storefront', color: '#4CAF50' },
  { name: 'Farmacia', icon: 'medical', color: '#2196F3' },
  { name: 'Ferretería', icon: 'build', color: '#FF9800' },
  { name: 'Tecnología', icon: 'phone-portrait', color: '#9C27B0' },
  { name: 'Ropa y Accesorios', icon: 'shirt', color: '#E91E63' },
  { name: 'Hogar y Jardín', icon: 'home', color: '#4CAF50' },
  { name: 'Salud y Belleza', icon: 'heart', color: '#FF4081' },
  { name: 'Deportes', icon: 'football', color: '#FF5722' },
  { name: 'Mascotas', icon: 'paw', color: '#795548' },
  { name: 'Servicios', icon: 'hammer', color: '#607D8B' }
]);

print('Categories created');

print('MongoDB initialization completed!');