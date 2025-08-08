const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const Service = require('../../models/Service');

describe('Search Routes', () => {
  let merchantUser;
  let service;

  beforeEach(async () => {
    // Create test merchant
    merchantUser = new User({
      name: 'Test Merchant',
      email: 'merchant@example.com',
      password: 'password123',
      role: 'comerciante',
      merchantStatus: 'aprobado',
      business: {
        businessName: 'Pizza Palace',
        category: 'Restaurante',
        description: 'Best pizza in town',
        address: 'Test Street 123'
      },
      rating: 4.5,
      totalOrders: 50
    });
    await merchantUser.save();

    // Create test service
    service = new Service({
      name: 'Margherita Pizza',
      description: 'Classic margherita with fresh basil',
      price: 15.99,
      category: 'Pizza',
      merchantId: merchantUser._id,
      available: true,
      preparationTime: 25,
      tags: ['pizza', 'vegetarian', 'classic'],
      rating: 4.3,
      reviewCount: 25
    });
    await service.save();
  });

  describe('GET /api/search', () => {
    test('should search for merchants and services', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'pizza' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      expect(response.body.results.length).toBeGreaterThan(0);
      expect(response.body.query).toBe('pizza');
      expect(response.body.totalResults).toBeGreaterThan(0);
    });

    test('should search only merchants when type=merchants', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'pizza', type: 'merchants' })
        .expect(200);

      expect(response.body.success).toBe(true);
      const results = response.body.results;
      
      // All results should be merchants
      results.forEach(result => {
        expect(result.type).toBe('merchant');
      });
    });

    test('should search only services when type=services', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'pizza', type: 'services' })
        .expect(200);

      expect(response.body.success).toBe(true);
      const results = response.body.results;
      
      // All results should be services
      results.forEach(result => {
        expect(result.type).toBe('service');
      });
    });

    test('should filter by category', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'pizza', category: 'Restaurante' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filters.category).toBe('Restaurante');
    });

    test('should filter by minimum rating', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'pizza', minRating: 4.0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filters.minRating).toBe(4.0);
    });

    test('should limit results', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'pizza', limit: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results.length).toBeLessThanOrEqual(1);
    });

    test('should sort by rating', async () => {
      // Create another merchant with different rating
      const anotherMerchant = new User({
        name: 'Another Merchant',
        email: 'another@example.com',
        password: 'password123',
        role: 'comerciante',
        merchantStatus: 'aprobado',
        business: {
          businessName: 'Pizza Corner',
          category: 'Restaurante'
        },
        rating: 3.5
      });
      await anotherMerchant.save();

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'pizza', sortBy: 'rating', type: 'merchants' })
        .expect(200);

      expect(response.body.success).toBe(true);
      const results = response.body.results;
      
      // Results should be sorted by rating (descending)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].rating).toBeGreaterThanOrEqual(results[i + 1].rating);
      }
    });

    test('should validate required query parameter', async () => {
      const response = await request(app)
        .get('/api/search')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Parámetros de búsqueda inválidos');
    });

    test('should validate query length', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should return empty results for non-matching query', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'nonexistentquery123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results.length).toBe(0);
      expect(response.body.totalResults).toBe(0);
    });
  });

  describe('GET /api/search/suggestions', () => {
    test('should return search suggestions', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ q: 'piz' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.suggestions).toBeDefined();
      expect(response.body.query).toBe('piz');
    });

    test('should return empty suggestions for short query', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ q: 'p' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.suggestions.length).toBe(0);
    });

    test('should return empty suggestions without query', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.suggestions.length).toBe(0);
    });
  });

  describe('GET /api/search/featured', () => {
    test('should return featured merchants', async () => {
      const response = await request(app)
        .get('/api/search/featured')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.merchants).toBeDefined();
      expect(Array.isArray(response.body.merchants)).toBe(true);
    });

    test('should only return approved merchants', async () => {
      // Create unapproved merchant
      const unapprovedMerchant = new User({
        name: 'Unapproved Merchant',
        email: 'unapproved@example.com',
        password: 'password123',
        role: 'comerciante',
        merchantStatus: 'pendiente',
        business: {
          businessName: 'Pending Business',
          category: 'Restaurante'
        },
        rating: 5.0
      });
      await unapprovedMerchant.save();

      const response = await request(app)
        .get('/api/search/featured')
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Should not include unapproved merchant
      const merchantNames = response.body.merchants.map(m => m.businessName);
      expect(merchantNames).not.toContain('Pending Business');
    });

    test('should limit featured merchants', async () => {
      const response = await request(app)
        .get('/api/search/featured')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.merchants.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock a database error
      jest.spyOn(User, 'find').mockImplementationOnce(() => {
        throw new Error('Database connection error');
      });

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'pizza' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Error interno del servidor');

      // Restore the mock
      User.find.mockRestore();
    });
  });
});