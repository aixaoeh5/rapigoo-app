import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Error Boundary component for catching and handling React errors
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: Date.now().toString()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
    
    // Log error to AsyncStorage for debugging
    this.logErrorToStorage(error, errorInfo);
    
    // Report error to analytics service if available
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  logErrorToStorage = async (error, errorInfo) => {
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        errorId: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        screen: this.props.screenName || 'Unknown'
      };
      
      const existingLogs = await AsyncStorage.getItem('error_logs') || '[]';
      const logs = JSON.parse(existingLogs);
      logs.push(errorLog);
      
      // Keep only last 10 errors
      const recentLogs = logs.slice(-10);
      await AsyncStorage.setItem('error_logs', JSON.stringify(recentLogs));
    } catch (storageError) {
      console.error('Failed to log error to storage:', storageError);
    }
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
    
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
    
    if (this.props.onGoHome) {
      this.props.onGoHome();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }
      
      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.title}>¡Ups! Algo salió mal</Text>
            <Text style={styles.message}>
              {this.props.userFriendlyMessage || 
               'Ocurrió un error inesperado. Por favor intenta nuevamente.'}
            </Text>
            
            {__DEV__ && this.state.error && (
              <ScrollView style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Información de debug:</Text>
                <Text style={styles.debugText}>
                  Error: {this.state.error.message}
                </Text>
                <Text style={styles.debugText}>
                  Stack: {this.state.error.stack}
                </Text>
              </ScrollView>
            )}
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.retryButton]} 
                onPress={this.handleRetry}
              >
                <Text style={styles.buttonText}>Intentar nuevamente</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.homeButton]} 
                onPress={this.handleGoHome}
              >
                <Text style={styles.buttonText}>Ir al inicio</Text>
              </TouchableOpacity>
            </View>
            
            {this.state.errorId && (
              <Text style={styles.errorId}>ID de error: {this.state.errorId}</Text>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export const withErrorBoundary = (WrappedComponent, errorBoundaryProps = {}) => {
  return (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
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
  debugContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    maxHeight: 200
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 5
  },
  debugText: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: 'monospace'
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5
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
  },
  errorId: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10
  }
});

export default ErrorBoundary;