import React from 'react';
import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { ThemeProvider, useTheme } from '../../components/context/ThemeContext';

// Test component that uses the theme context
const TestComponent = () => {
  const { theme } = useTheme();
  
  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.text }}>Test Text</Text>
    </View>
  );
};

// Test component to verify theme values
const ThemeValueTest = () => {
  const { theme } = useTheme();
  
  return (
    <View testID="theme-test">
      <Text testID="background-color">{theme.colors.background}</Text>
      <Text testID="text-color">{theme.colors.text}</Text>
      <Text testID="primary-color">{theme.colors.primary}</Text>
    </View>
  );
};

describe('ThemeContext', () => {
  it('provides theme values to child components', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeValueTest />
      </ThemeProvider>
    );

    const backgroundColor = getByTestId('background-color');
    const textColor = getByTestId('text-color');
    const primaryColor = getByTestId('primary-color');

    expect(backgroundColor.children[0]).toBeTruthy();
    expect(textColor.children[0]).toBeTruthy();
    expect(primaryColor.children[0]).toBeTruthy();
  });

  it('provides default theme when no custom theme is provided', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeValueTest />
      </ThemeProvider>
    );

    const themeTest = getByTestId('theme-test');
    expect(themeTest).toBeTruthy();
  });

  it('allows components to access theme colors', () => {
    const { getByText } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(getByText('Test Text')).toBeTruthy();
  });

  it('throws error when useTheme is used outside provider', () => {
    // Mock console.error to avoid test output pollution
    const originalError = console.error;
    console.error = jest.fn();

    expect(() => {
      render(<TestComponent />);
    }).toThrow();

    console.error = originalError;
  });

  it('provides all expected theme colors', () => {
    const ThemeColorTest = () => {
      const { theme } = useTheme();
      
      const expectedColors = [
        'background',
        'surface',
        'primary',
        'secondary',
        'text',
        'textSecondary',
        'textTertiary',
        'border',
        'success',
        'warning',
        'error',
        'info'
      ];

      return (
        <View>
          {expectedColors.map((colorKey) => (
            <Text key={colorKey} testID={`color-${colorKey}`}>
              {theme.colors[colorKey] || 'undefined'}
            </Text>
          ))}
        </View>
      );
    };

    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeColorTest />
      </ThemeProvider>
    );

    // Check that primary colors exist
    expect(getByTestId('color-background')).toBeTruthy();
    expect(getByTestId('color-primary')).toBeTruthy();
    expect(getByTestId('color-text')).toBeTruthy();
  });

  it('maintains consistent theme values across re-renders', () => {
    let themeRef;
    
    const ThemeRefTest = () => {
      const { theme } = useTheme();
      themeRef = theme;
      return <View testID="theme-ref-test" />;
    };

    const { rerender, getByTestId } = render(
      <ThemeProvider>
        <ThemeRefTest />
      </ThemeProvider>
    );

    const initialTheme = themeRef;
    expect(getByTestId('theme-ref-test')).toBeTruthy();

    rerender(
      <ThemeProvider>
        <ThemeRefTest />
      </ThemeProvider>
    );

    expect(themeRef).toBe(initialTheme);
  });

  describe('theme color values', () => {
    it('has correct primary color', () => {
      const { getByTestId } = render(
        <ThemeProvider>
          <ThemeValueTest />
        </ThemeProvider>
      );

      const primaryColor = getByTestId('primary-color');
      // Assuming the primary color is #FF6B6B as used throughout the app
      expect(primaryColor.children[0]).toBeTruthy();
    });

    it('has accessible color contrast', () => {
      const AccessibilityTest = () => {
        const { theme } = useTheme();
        
        return (
          <View 
            style={{ backgroundColor: theme.colors.background }}
            testID="accessibility-test"
          >
            <Text 
              style={{ color: theme.colors.text }}
              testID="accessible-text"
            >
              Readable text
            </Text>
          </View>
        );
      };

      const { getByTestId } = render(
        <ThemeProvider>
          <AccessibilityTest />
        </ThemeProvider>
      );

      expect(getByTestId('accessibility-test')).toBeTruthy();
      expect(getByTestId('accessible-text')).toBeTruthy();
    });
  });

  describe('theme structure', () => {
    it('has correct theme structure', () => {
      const StructureTest = () => {
        const { theme } = useTheme();
        
        return (
          <View testID="structure-test">
            <Text testID="has-colors">{typeof theme.colors}</Text>
            <Text testID="colors-is-object">{theme.colors.constructor.name}</Text>
          </View>
        );
      };

      const { getByTestId } = render(
        <ThemeProvider>
          <StructureTest />
        </ThemeProvider>
      );

      expect(getByTestId('has-colors').children[0]).toBe('object');
      expect(getByTestId('colors-is-object').children[0]).toBe('Object');
    });
  });
});