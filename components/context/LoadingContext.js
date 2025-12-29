import React, { createContext, useState, useContext, useCallback } from 'react';
import { 
  Modal, 
  ActivityIndicator, 
  View, 
  StyleSheet, 
  Text, 
  Animated, 
  Easing 
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const LoadingContext = createContext();

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading debe ser usado dentro de LoadingProvider');
  }
  return context;
};

export const LoadingProvider = ({ children }) => {
  const [loadingState, setLoadingState] = useState({
    isLoading: false,
    message: '',
    type: 'default', // 'default', 'success', 'error', 'upload'
    progress: 0
  });

  const spinValue = new Animated.Value(0);

  // Animación de rotación
  const startSpinAnimation = useCallback(() => {
    spinValue.setValue(0);
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const showLoading = useCallback((message = '', type = 'default', progress = 0) => {
    setLoadingState({
      isLoading: true,
      message,
      type,
      progress
    });
    
    if (type === 'default') {
      startSpinAnimation();
    }
  }, [startSpinAnimation]);

  const hideLoading = useCallback(() => {
    setLoadingState({
      isLoading: false,
      message: '',
      type: 'default',
      progress: 0
    });
  }, []);

  const updateProgress = useCallback((progress, message = '') => {
    setLoadingState(prev => ({
      ...prev,
      progress,
      ...(message && { message })
    }));
  }, []);

  const showSuccess = useCallback((message = '¡Éxito!', duration = 2000) => {
    setLoadingState({
      isLoading: true,
      message,
      type: 'success',
      progress: 0
    });

    setTimeout(() => {
      hideLoading();
    }, duration);
  }, [hideLoading]);

  const showError = useCallback((message = 'Error', duration = 3000) => {
    setLoadingState({
      isLoading: true,
      message,
      type: 'error',
      progress: 0
    });

    setTimeout(() => {
      hideLoading();
    }, duration);
  }, [hideLoading]);

  // Funciones de conveniencia para operaciones comunes
  const withLoading = useCallback(async (asyncOperation, message = 'Cargando...') => {
    try {
      showLoading(message);
      const result = await asyncOperation();
      hideLoading();
      return result;
    } catch (error) {
      showError(error.message || 'Ocurrió un error');
      throw error;
    }
  }, [showLoading, hideLoading, showError]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const renderLoadingContent = () => {
    const { type, message, progress } = loadingState;

    switch (type) {
      case 'success':
        return (
          <View style={styles.contentContainer}>
            <View style={[styles.iconContainer, { backgroundColor: '#4CAF50' }]}>
              <Icon name="checkmark" size={40} color="#fff" />
            </View>
            {message && <Text style={styles.message}>{message}</Text>}
          </View>
        );

      case 'error':
        return (
          <View style={styles.contentContainer}>
            <View style={[styles.iconContainer, { backgroundColor: '#F44336' }]}>
              <Icon name="close" size={40} color="#fff" />
            </View>
            {message && <Text style={[styles.message, { color: '#F44336' }]}>{message}</Text>}
          </View>
        );

      case 'upload':
        return (
          <View style={styles.contentContainer}>
            <View style={styles.uploadContainer}>
              <View style={styles.progressBarBackground}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${progress}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
            {message && <Text style={styles.message}>{message}</Text>}
          </View>
        );

      default:
        return (
          <View style={styles.contentContainer}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <View style={styles.customSpinner}>
                <Icon name="refresh" size={32} color="#FF6B6B" />
              </View>
            </Animated.View>
            {message && <Text style={styles.message}>{message}</Text>}
          </View>
        );
    }
  };

  const value = {
    // Estado
    isLoading: loadingState.isLoading,
    message: loadingState.message,
    type: loadingState.type,
    progress: loadingState.progress,
    
    // Métodos básicos
    showLoading,
    hideLoading,
    updateProgress,
    
    // Métodos de conveniencia
    showSuccess,
    showError,
    withLoading,
    
    // Métodos legacy (compatibilidad)
    loading: loadingState.isLoading,
    setLoading: (isLoading) => {
      if (isLoading) {
        showLoading();
      } else {
        hideLoading();
      }
    }
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {loadingState.isLoading && (
        <Modal transparent animationType="fade" statusBarTranslucent>
          <View style={styles.overlay}>
            <View style={styles.container}>
              {renderLoadingContent()}
            </View>
          </View>
        </Modal>
      )}
    </LoadingContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  contentContainer: {
    alignItems: 'center',
  },
  customSpinner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff3f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  uploadContainer: {
    width: 200,
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6B6B',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
});
