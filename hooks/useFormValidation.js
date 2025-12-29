import { useState, useCallback, useEffect, useMemo } from 'react';

const useFormValidation = (initialValues, validationRules) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isValid, setIsValid] = useState(false);

  // Validation functions
  const validators = {
    required: (value) => {
      if (!value || (typeof value === 'string' && !value.trim())) {
        return 'Este campo es obligatorio';
      }
      return null;
    },
    
    email: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        return 'Ingresa un email válido';
      }
      return null;
    },
    
    minLength: (minLength) => (value) => {
      if (value && value.length < minLength) {
        return `Mínimo ${minLength} caracteres`;
      }
      return null;
    },
    
    maxLength: (maxLength) => (value) => {
      if (value && value.length > maxLength) {
        return `Máximo ${maxLength} caracteres`;
      }
      return null;
    },
    
    phone: (value) => {
      const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
      if (value && !phoneRegex.test(value.replace(/\s/g, ''))) {
        return 'Ingresa un teléfono válido';
      }
      return null;
    },
    
    password: (value) => {
      if (value && value.length < 6) {
        return 'La contraseña debe tener al menos 6 caracteres';
      }
      if (value && !/(?=.*[a-zA-Z])(?=.*\d)/.test(value)) {
        return 'Debe contener al menos una letra y un número';
      }
      return null;
    },
    
    confirmPassword: (originalPassword) => (value) => {
      if (value && value !== originalPassword) {
        return 'Las contraseñas no coinciden';
      }
      return null;
    },
    
    price: (value) => {
      const priceRegex = /^\d+(\.\d{1,2})?$/;
      if (value && !priceRegex.test(value)) {
        return 'Ingresa un precio válido (ej: 10.50)';
      }
      if (value && parseFloat(value) <= 0) {
        return 'El precio debe ser mayor a 0';
      }
      return null;
    },

    custom: (validationFn) => (value) => {
      return validationFn(value);
    }
  };

  // Validate a single field
  const validateField = useCallback((fieldName, value) => {
    const rules = validationRules[fieldName];
    if (!rules) return null;

    for (const rule of rules) {
      let error = null;
      
      if (typeof rule === 'string') {
        // Simple validator name
        error = validators[rule]?.(value);
      } else if (typeof rule === 'object') {
        // Validator with parameters
        const { type, params, message } = rule;
        if (validators[type]) {
          if (params !== undefined) {
            error = validators[type](params)(value);
          } else {
            error = validators[type](value);
          }
          if (error && message) {
            error = message;
          }
        }
      } else if (typeof rule === 'function') {
        // Custom validation function
        error = rule(value, values);
      }

      if (error) {
        return error;
      }
    }
    return null;
  }, [validationRules, values]);

  // Validate all fields
  const validateAll = useCallback(() => {
    const newErrors = {};
    let hasErrors = false;

    Object.keys(validationRules).forEach(fieldName => {
      const error = validateField(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    setIsValid(!hasErrors);
    return !hasErrors;
  }, [values, validateField]);

  // Handle field change
  const handleChange = useCallback((fieldName, value) => {
    setValues(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Real-time validation for touched fields
    if (touched[fieldName]) {
      const error = validateField(fieldName, value);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error
      }));
    }
  }, [touched, validateField]);

  // Handle field blur (mark as touched)
  const handleBlur = useCallback((fieldName) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));

    // Validate field on blur
    const error = validateField(fieldName, values[fieldName]);
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  }, [values, validateField]);

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsValid(false);
  }, [initialValues]);

  // Set field error manually
  const setFieldError = useCallback((fieldName, error) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  }, []);

  // Memoize touched state to prevent unnecessary re-renders
  const hasAnyTouched = useMemo(() => {
    return Object.values(touched).some(Boolean);
  }, [touched]);

  // Check if form is valid on values change
  useEffect(() => {
    if (hasAnyTouched) {
      validateAll();
    }
  }, [values, hasAnyTouched, validateAll]);

  return {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    validateAll,
    resetForm,
    setFieldError,
    setValues,
  };
};

export default useFormValidation;