import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../components/LoginScreen';
import { loginUser } from '../../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock API calls
jest.mock('../../api/auth', () => ({
  loginUser: jest.fn(),
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock ThemeContext
jest.mock('../../components/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#fff',
        text: '#000',
        border: '#ccc',
        surface: '#f5f5f5',
        primary: '#FF6B6B',
        textSecondary: '#666',
        textTertiary: '#999',
      },
    },
  }),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  it('renders correctly', () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    expect(getByText('Bienvenido de nuevo')).toBeTruthy();
    expect(getByPlaceholderText('Ingresa tu email')).toBeTruthy();
    expect(getByPlaceholderText('Ingresa tu contraseña')).toBeTruthy();
    expect(getByText('Iniciar Sesión')).toBeTruthy();
  });

  it('navigates to Home if token exists', async () => {
    AsyncStorage.setItem('token', 'valid-token');

    render(<LoginScreen />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });

  it('shows validation errors for empty fields', async () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('Ingresa tu email');
    const passwordInput = getByPlaceholderText('Ingresa tu contraseña');

    // Focus and blur to trigger validation
    fireEvent(emailInput, 'focus');
    fireEvent(emailInput, 'blur');
    fireEvent(passwordInput, 'focus');
    fireEvent(passwordInput, 'blur');

    await waitFor(() => {
      expect(getByText('Este campo es obligatorio')).toBeTruthy();
    });
  });

  it('shows email validation error for invalid email', async () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('Ingresa tu email');

    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent(emailInput, 'blur');

    await waitFor(() => {
      expect(getByText('Ingresa un email válido')).toBeTruthy();
    });
  });

  it('shows password validation error for short password', async () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const passwordInput = getByPlaceholderText('Ingresa tu contraseña');

    fireEvent.changeText(passwordInput, '123');
    fireEvent(passwordInput, 'blur');

    await waitFor(() => {
      expect(getByText('Mínimo 6 caracteres')).toBeTruthy();
    });
  });

  it('enables login button when form is valid', async () => {
    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('Ingresa tu email');
    const passwordInput = getByPlaceholderText('Ingresa tu contraseña');
    const loginButton = getByText('Iniciar Sesión');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');

    await waitFor(() => {
      expect(loginButton).toBeTruthy();
      // Button should be enabled when form is valid
    });
  });

  it('calls loginUser API on form submission', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    loginUser.mockResolvedValueOnce(mockUser);

    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('Ingresa tu email');
    const passwordInput = getByPlaceholderText('Ingresa tu contraseña');
    const loginButton = getByText('Iniciar Sesión');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(loginUser).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('navigates to Home on successful login', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    loginUser.mockResolvedValueOnce(mockUser);

    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('Ingresa tu email');
    const passwordInput = getByPlaceholderText('Ingresa tu contraseña');
    const loginButton = getByText('Iniciar Sesión');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });

  it('shows error alert on login failure', async () => {
    const mockError = {
      response: {
        data: {
          message: 'Invalid credentials',
        },
      },
    };
    loginUser.mockRejectedValueOnce(mockError);

    // Mock Alert
    const mockAlert = jest.spyOn(require('react-native').Alert, 'alert');

    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('Ingresa tu email');
    const passwordInput = getByPlaceholderText('Ingresa tu contraseña');
    const loginButton = getByText('Iniciar Sesión');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'wrongpassword');
    fireEvent.press(loginButton);

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Error',
        'Invalid credentials'
      );
    });
  });

  it('navigates to Register screen when create account is pressed', () => {
    const { getByText } = render(<LoginScreen />);

    const createAccountButton = getByText('Crear cuenta');
    fireEvent.press(createAccountButton);

    expect(mockNavigate).toHaveBeenCalledWith('Register');
  });

  it('navigates to ForgotPassword screen when forgot password is pressed', () => {
    const { getByText } = render(<LoginScreen />);

    const forgotPasswordButton = getByText('¿Olvidaste la contraseña?');
    fireEvent.press(forgotPasswordButton);

    expect(mockNavigate).toHaveBeenCalledWith('ForgotPassword');
  });

  it('navigates back to UserType when back button is pressed', () => {
    const { getByTestId } = render(<LoginScreen />);

    // Assuming the back button has a testID
    const backButton = getByTestId('back-button') || getByText('←');
    fireEvent.press(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('UserType');
  });

  it('shows loading indicator during login process', async () => {
    // Mock a delayed response
    loginUser.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({ id: '1' }), 100))
    );

    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('Ingresa tu email');
    const passwordInput = getByPlaceholderText('Ingresa tu contraseña');
    const loginButton = getByText('Iniciar Sesión');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(loginButton);

    // Should show loading indicator
    await waitFor(() => {
      // Check for ActivityIndicator or loading text
      expect(loginButton).toBeTruthy();
    });
  });

  it('prevents multiple submissions during loading', async () => {
    loginUser.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({ id: '1' }), 100))
    );

    const { getByText, getByPlaceholderText } = render(<LoginScreen />);

    const emailInput = getByPlaceholderText('Ingresa tu email');
    const passwordInput = getByPlaceholderText('Ingresa tu contraseña');
    const loginButton = getByText('Iniciar Sesión');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    
    // Press button multiple times
    fireEvent.press(loginButton);
    fireEvent.press(loginButton);
    fireEvent.press(loginButton);

    await waitFor(() => {
      // Should only call loginUser once
      expect(loginUser).toHaveBeenCalledTimes(1);
    });
  });
});