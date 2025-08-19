import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import ErrorBoundary from './ErrorBoundary';

/**
 * Specialized Error Boundary for Checkout Screen
 */
const CheckoutErrorBoundary = ({ children, navigation }) => {
  const handleRetry = () => {
    // Clear any cached checkout data and restart the process
    console.log('🔄 Retrying checkout process');
  };

  const handleGoToCart = () => {
    navigation.navigate('Cart');
  };

  const handleGoHome = () => {
    navigation.navigate('Home');
  };

  const checkoutFallback = (error, retry) => (
    <View style={styles.container}>
      <View style={styles.errorContainer}>
        <Text style={styles.title}>Error en el Checkout</Text>
        <Text style={styles.message}>
          No pudimos procesar tu pedido en este momento. 
          Esto puede deberse a un problema temporal.
        </Text>
        
        <Text style={styles.suggestion}>
          Sugerencias:
        </Text>
        <Text style={styles.suggestionItem}>
          • Verifica tu conexión a internet
        </Text>
        <Text style={styles.suggestionItem}>
          • Asegúrate de que tu dirección de entrega esté completa
        </Text>
        <Text style={styles.suggestionItem}>
          • Revisa tu método de pago
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.retryButton]} 
            onPress={retry}
          >
            <Text style={styles.buttonText}>Intentar nuevamente</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.cartButton]} 
            onPress={handleGoToCart}
          >
            <Text style={styles.buttonText}>Ir al carrito</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.homeButton]} 
            onPress={handleGoHome}
          >
            <Text style={styles.buttonText}>Ir al inicio</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <ErrorBoundary
      screenName="Checkout"
      userFriendlyMessage="Error al procesar el pedido"
      fallback={checkoutFallback}
      onRetry={handleRetry}
      onGoHome={handleGoHome}
    >
      {children}
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  errorContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 10
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22
  },
  suggestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 10
  },
  suggestionItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    paddingLeft: 10
  },
  buttonContainer: {
    marginTop: 20
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 5
  },
  retryButton: {
    backgroundColor: '#007bff'
  },
  cartButton: {
    backgroundColor: '#ffc107'
  },
  homeButton: {
    backgroundColor: '#28a745'
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center'
  }
});

export default CheckoutErrorBoundary;