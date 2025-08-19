import apiClient from './apiClient';

// Mock merchant data for demo
const DEMO_MERCHANTS = [
  {
    _id: 'demo-merchant-1',
    businessName: 'Restaurante La Demo',
    description: 'El mejor restaurante para demostraciones',
    imageUrl: 'https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=Restaurante+Demo',
    rating: 4.8,
    deliveryTime: '20-30 min',
    deliveryFee: 2.50,
    minimumOrder: 10.00,
    isOpen: true,
    categories: ['comida-rapida', 'italiana'],
    location: {
      coordinates: [-69.9312, 18.4861]
    }
  }
];

const DEMO_SERVICES = [
  {
    _id: 'demo-service-1',
    name: 'Pizza Margherita',
    description: 'Pizza clásica con tomate, mozzarella y albahaca',
    price: 12.99,
    imageUrl: 'https://via.placeholder.com/300x200/FF5722/FFFFFF?text=Pizza+Margherita',
    category: 'pizzas',
    available: true,
    merchant: 'demo-merchant-1'
  },
  {
    _id: 'demo-service-2', 
    name: 'Hamburguesa Clásica',
    description: 'Hamburguesa con carne, lechuga, tomate y papas',
    price: 8.99,
    imageUrl: 'https://via.placeholder.com/300x200/795548/FFFFFF?text=Hamburguesa',
    category: 'hamburguesas',
    available: true,
    merchant: 'demo-merchant-1'
  }
];

// Override merchant API calls with demo data
const originalPost = apiClient.post;
const originalGet = apiClient.get;

apiClient.get = function(url, config) {
  console.log('🎬 DEMO GET:', url);
  
  if (url.includes('/merchant') && !url.includes('/auth')) {
    return Promise.resolve({
      data: DEMO_MERCHANTS,
      status: 200
    });
  }
  
  if (url.includes('/services')) {
    return Promise.resolve({
      data: DEMO_SERVICES,
      status: 200
    });
  }
  
  return originalGet.call(this, url, config);
};

apiClient.post = function(url, data, config) {
  console.log('🎬 DEMO POST:', url, data);
  
  if (url.includes('/orders') && !url.includes('/auth')) {
    return Promise.resolve({
      data: {
        _id: 'demo-order-' + Date.now(),
        customer: 'demo-customer-1',
        merchant: 'demo-merchant-1',
        items: data.items || [],
        total: data.total || 15.99,
        status: 'pending',
        createdAt: new Date().toISOString()
      },
      status: 201
    });
  }
  
  return originalPost.call(this, url, data, config);
};

export { DEMO_MERCHANTS, DEMO_SERVICES };
export default apiClient;