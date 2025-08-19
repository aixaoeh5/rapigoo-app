/**
 * Basic validation utility tests
 * Tests core validation functions without complex dependencies
 */

describe('Validation Utils', () => {
  // Email validation
  describe('Email validation', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });

  // Phone validation
  describe('Phone validation', () => {
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;

    it('should validate correct phone formats', () => {
      const validPhones = [
        '+1-234-567-8900',
        '(234) 567-8900',
        '234-567-8900',
        '2345678900',
        '+52 123 456 7890'
      ];

      validPhones.forEach(phone => {
        expect(phoneRegex.test(phone.replace(/\s/g, ''))).toBe(true);
      });
    });

    it('should reject invalid phone formats', () => {
      const invalidPhones = [
        '123',
        'abc-def-ghij',
        '123-45',
        ''
      ];

      invalidPhones.forEach(phone => {
        expect(phoneRegex.test(phone.replace(/\s/g, ''))).toBe(false);
      });
    });
  });

  // Price validation
  describe('Price validation', () => {
    const priceRegex = /^\d+(\.\d{1,2})?$/;

    it('should validate correct price formats', () => {
      const validPrices = [
        '10.50',
        '100',
        '0.99',
        '1234.56'
      ];

      validPrices.forEach(price => {
        expect(priceRegex.test(price)).toBe(true);
        expect(parseFloat(price)).toBeGreaterThan(0);
      });
    });

    it('should reject invalid price formats', () => {
      const invalidPrices = [
        '-10.50',
        '10.999',
        'abc',
        '10.',
        '10.5a'
      ];

      invalidPrices.forEach(price => {
        expect(priceRegex.test(price) && parseFloat(price) > 0).toBe(false);
      });
    });
  });

  // Required field validation
  describe('Required field validation', () => {
    const isRequired = (value) => {
      if (!value || (typeof value === 'string' && !value.trim())) {
        return 'Este campo es obligatorio';
      }
      return null;
    };

    it('should pass for valid values', () => {
      const validValues = ['test', '123', 'a', '  text  '];
      
      validValues.forEach(value => {
        expect(isRequired(value)).toBeNull();
      });
    });

    it('should fail for invalid values', () => {
      const invalidValues = ['', '   ', null, undefined];
      
      invalidValues.forEach(value => {
        expect(isRequired(value)).toBe('Este campo es obligatorio');
      });
    });
  });

  // MinLength validation
  describe('MinLength validation', () => {
    const minLength = (min) => (value) => {
      if (value && value.length < min) {
        return `Mínimo ${min} caracteres`;
      }
      return null;
    };

    it('should pass for strings meeting minimum length', () => {
      const validator = minLength(6);
      
      expect(validator('password')).toBeNull();
      expect(validator('123456')).toBeNull();
      expect(validator('verylongpassword')).toBeNull();
    });

    it('should fail for strings below minimum length', () => {
      const validator = minLength(6);
      
      expect(validator('123')).toBe('Mínimo 6 caracteres');
      expect(validator('ab')).toBe('Mínimo 6 caracteres');
      expect(validator('')).toBeNull(); // Empty should be handled by required validator
    });
  });

  // Password validation
  describe('Password validation', () => {
    const validatePassword = (value) => {
      if (value && value.length < 6) {
        return 'La contraseña debe tener al menos 6 caracteres';
      }
      if (value && !/(?=.*[a-zA-Z])(?=.*\d)/.test(value)) {
        return 'Debe contener al menos una letra y un número';
      }
      return null;
    };

    it('should pass for valid passwords', () => {
      const validPasswords = [
        'password123',
        'abc123',
        '1a2b3c',
        'Test123'
      ];

      validPasswords.forEach(password => {
        expect(validatePassword(password)).toBeNull();
      });
    });

    it('should fail for invalid passwords', () => {
      expect(validatePassword('123')).toBe('La contraseña debe tener al menos 6 caracteres');
      expect(validatePassword('password')).toBe('Debe contener al menos una letra y un número');
      expect(validatePassword('123456')).toBe('Debe contener al menos una letra y un número');
    });
  });

  // Confirm password validation
  describe('Confirm password validation', () => {
    const confirmPassword = (originalPassword) => (value) => {
      if (value && value !== originalPassword) {
        return 'Las contraseñas no coinciden';
      }
      return null;
    };

    it('should pass when passwords match', () => {
      const validator = confirmPassword('password123');
      expect(validator('password123')).toBeNull();
    });

    it('should fail when passwords do not match', () => {
      const validator = confirmPassword('password123');
      expect(validator('password456')).toBe('Las contraseñas no coinciden');
    });
  });
});