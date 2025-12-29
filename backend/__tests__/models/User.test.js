const User = require('../../models/User');
const bcrypt = require('bcryptjs');

describe('User Model', () => {
  describe('User Creation', () => {
    test('should create a valid user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '1234567890'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser.name).toBe(userData.name);
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.phone).toBe(userData.phone);
      expect(savedUser.role).toBe('cliente'); // default value
      expect(savedUser.isVerified).toBe(false); // default value
    });

    test('should hash password before saving', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = new User(userData);
      await user.save();

      expect(user.password).not.toBe(userData.password);
      expect(user.password.length).toBeGreaterThan(20); // bcrypt hash length
    });

    test('should require name, email and password', async () => {
      const user = new User({});

      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.name).toBeDefined();
      expect(error.errors.email).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    test('should enforce unique email', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      await new User(userData).save();

      const duplicateUser = new User(userData);
      
      let error;
      try {
        await duplicateUser.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(11000); // MongoDB duplicate key error
    });

    test('should convert email to lowercase', async () => {
      const userData = {
        name: 'Test User',
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      };

      const user = new User(userData);
      await user.save();

      expect(user.email).toBe('test@example.com');
    });
  });

  describe('Merchant User', () => {
    test('should create merchant with business data', async () => {
      const merchantData = {
        name: 'Test Merchant',
        email: 'merchant@example.com',
        password: 'password123',
        role: 'comerciante',
        business: {
          businessName: 'Test Business',
          rnc: '123456789',
          category: 'Restaurante',
          address: 'Test Address',
          phone: '1234567890'
        }
      };

      const merchant = new User(merchantData);
      const savedMerchant = await merchant.save();

      expect(savedMerchant.role).toBe('comerciante');
      expect(savedMerchant.business.businessName).toBe('Test Business');
      expect(savedMerchant.merchantStatus).toBe('pendiente'); // default
    });
  });

  describe('Favorites System', () => {
    test('should initialize empty favorites', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      await user.save();

      expect(user.favorites).toBeDefined();
      expect(user.favorites.merchants).toEqual([]);
      expect(user.favorites.services).toEqual([]);
    });
  });

  describe('Notification Preferences', () => {
    test('should have default notification preferences', async () => {
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });

      await user.save();

      expect(user.notificationPreferences).toBeDefined();
      expect(user.notificationPreferences.orderUpdates).toBe(true);
      expect(user.notificationPreferences.promotions).toBe(true);
      expect(user.notificationPreferences.sound).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should enforce minimum password length', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: '12345' // Less than 6 characters
      };

      const user = new User(userData);
      
      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.password).toBeDefined();
    });

    test('should validate email format', async () => {
      const userData = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      };

      const user = new User(userData);
      
      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
    });

    test('should validate role enum', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'invalid-role'
      };

      const user = new User(userData);
      
      let error;
      try {
        await user.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.role).toBeDefined();
    });
  });

  describe('Password Comparison', () => {
    test('should compare password correctly', async () => {
      const password = 'password123';
      const user = new User({
        name: 'Test User',
        email: 'test@example.com',
        password
      });

      await user.save();

      const isMatch = await bcrypt.compare(password, user.password);
      expect(isMatch).toBe(true);

      const isWrongMatch = await bcrypt.compare('wrongpassword', user.password);
      expect(isWrongMatch).toBe(false);
    });
  });
});