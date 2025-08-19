import { renderHook, act } from '@testing-library/react-native';
import useFormValidation from '../../hooks/useFormValidation';

describe('useFormValidation', () => {
  const mockValidationRules = {
    email: ['required', 'email'],
    password: ['required', { type: 'minLength', params: 6 }],
  };

  const mockInitialValues = {
    email: '',
    password: '',
  };

  it('should initialize with correct initial state', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockInitialValues, mockValidationRules)
    );

    expect(result.current.values).toEqual(mockInitialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isValid).toBe(false);
  });

  it('should handle field changes correctly', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockInitialValues, mockValidationRules)
    );

    act(() => {
      result.current.handleChange('email', 'test@example.com');
    });

    expect(result.current.values.email).toBe('test@example.com');
  });

  it('should validate required fields on blur', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockInitialValues, mockValidationRules)
    );

    act(() => {
      result.current.handleBlur('email');
    });

    expect(result.current.touched.email).toBe(true);
    expect(result.current.errors.email).toBe('Este campo es obligatorio');
  });

  it('should validate email format', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockInitialValues, mockValidationRules)
    );

    act(() => {
      result.current.handleChange('email', 'invalid-email');
      result.current.handleBlur('email');
    });

    expect(result.current.errors.email).toBe('Ingresa un email válido');
  });

  it('should validate password minimum length', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockInitialValues, mockValidationRules)
    );

    act(() => {
      result.current.handleChange('password', '123');
      result.current.handleBlur('password');
    });

    expect(result.current.errors.password).toBe('Mínimo 6 caracteres');
  });

  it('should validate all fields and return validation status', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockInitialValues, mockValidationRules)
    );

    let isValid;
    
    act(() => {
      result.current.handleChange('email', 'test@example.com');
      result.current.handleChange('password', 'password123');
      isValid = result.current.validateAll();
    });

    expect(isValid).toBe(true);
    expect(result.current.isValid).toBe(true);
  });

  it('should reset form correctly', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockInitialValues, mockValidationRules)
    );

    act(() => {
      result.current.handleChange('email', 'test@example.com');
      result.current.handleBlur('email');
      result.current.resetForm();
    });

    expect(result.current.values).toEqual(mockInitialValues);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched).toEqual({});
    expect(result.current.isValid).toBe(false);
  });

  it('should set field error manually', () => {
    const { result } = renderHook(() =>
      useFormValidation(mockInitialValues, mockValidationRules)
    );

    act(() => {
      result.current.setFieldError('email', 'Custom error message');
    });

    expect(result.current.errors.email).toBe('Custom error message');
  });

  describe('validators', () => {
    it('should validate phone numbers', () => {
      const phoneValidationRules = {
        phone: ['phone'],
      };

      const { result } = renderHook(() =>
        useFormValidation({ phone: '' }, phoneValidationRules)
      );

      act(() => {
        result.current.handleChange('phone', '809-123-4567');
        result.current.handleBlur('phone');
      });

      expect(result.current.errors.phone).toBeUndefined();

      act(() => {
        result.current.handleChange('phone', '123');
        result.current.handleBlur('phone');
      });

      expect(result.current.errors.phone).toBe('Ingresa un teléfono válido');
    });

    it('should validate price format', () => {
      const priceValidationRules = {
        price: ['price'],
      };

      const { result } = renderHook(() =>
        useFormValidation({ price: '' }, priceValidationRules)
      );

      act(() => {
        result.current.handleChange('price', '10.50');
        result.current.handleBlur('price');
      });

      expect(result.current.errors.price).toBeUndefined();

      act(() => {
        result.current.handleChange('price', '-5.00');
        result.current.handleBlur('price');
      });

      expect(result.current.errors.price).toBe('El precio debe ser mayor a 0');
    });
  });
});