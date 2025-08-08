import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const lightTheme = {
  colors: {
    primary: '#FF6B6B',
    secondary: '#4CAF50',
    background: '#ffffff',
    surface: '#f8f9fa',
    card: '#ffffff',
    text: '#333333',
    textSecondary: '#666666',
    textTertiary: '#999999',
    border: '#e0e0e0',
    error: '#FF4444',
    success: '#4CAF50',
    warning: '#FF9800',
    info: '#2196F3',
    disabled: '#cccccc',
    shadow: '#000000',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: 'bold' },
    h2: { fontSize: 24, fontWeight: 'bold' },
    h3: { fontSize: 20, fontWeight: 'bold' },
    h4: { fontSize: 18, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: 'normal' },
    caption: { fontSize: 14, fontWeight: 'normal' },
    small: { fontSize: 12, fontWeight: 'normal' },
  }
};

export const darkTheme = {
  ...lightTheme,
  colors: {
    primary: '#FF6B6B',
    secondary: '#4CAF50',
    background: '#121212',
    surface: '#1e1e1e',
    card: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#b3b3b3',
    textTertiary: '#808080',
    border: '#404040',
    error: '#FF4444',
    success: '#4CAF50',
    warning: '#FF9800',
    info: '#2196F3',
    disabled: '#666666',
    shadow: '#000000',
  }
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('isDarkMode');
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('isDarkMode', JSON.stringify(newTheme));
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  const value = {
    theme,
    isDarkMode,
    toggleTheme,
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};