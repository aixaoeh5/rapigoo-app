import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import ErrorBoundary from './ErrorBoundary';

/**
 * Specialized Error Boundary for Delivery Screens
 */
const DeliveryErrorBoundary = ({ children, navigation }) => {
  const handleRetry = () => {
    console.log('🔄 Retrying delivery process');
  };

  const handleGoToDeliveryHome = () => {
    navigation.navigate('HomeDelivery');
  };

  const deliveryFallback = (error, retry) => (
    <View style={styles.container}>
      <View style={styles.errorContainer}>
        <Text style={styles.title}>Error en la Entrega</Text>
        <Text style={styles.message}>
          Ocurrió un problema con el sistema de entregas.
        </Text>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.retryButton]} 
            onPress={retry}
          >
            <Text style={styles.buttonText}>Intentar nuevamente</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.homeButton]} 
            onPress={handleGoToDeliveryHome}
          >
            <Text style={styles.buttonText}>Inicio de entregas</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <ErrorBoundary
      screenName="Delivery"
      userFriendlyMessage="Error en el sistema de entregas"
      fallback={deliveryFallback}
      onRetry={handleRetry}
      onGoHome={handleGoToDeliveryHome}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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

export default DeliveryErrorBoundary;