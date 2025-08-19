/**
 * EmergencyLogoutButton - Botón de emergencia para cerrar sesión
 * Aparece cuando hay problemas de estado en deliveries
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEmergencyLogout } from '../../utils/EmergencyLogout';

const EmergencyLogoutButton = ({ 
  showAlways = false, 
  style = {},
  buttonStyle = {},
  textStyle = {},
  iconColor = '#ff4444',
  backgroundColor = '#fff',
  borderColor = '#ff4444'
}) => {
  const [showButton, setShowButton] = useState(showAlways);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasInconsistentState, setHasInconsistentState] = useState(false);
  
  const { 
    forceLogout, 
    quickLogout, 
    clearDeliveryOnly, 
    showCleanupOptions,
    checkInconsistentState 
  } = useEmergencyLogout();

  useEffect(() => {
    if (!showAlways) {
      checkForInconsistentState();
    }
  }, [showAlways]);

  const checkForInconsistentState = async () => {
    try {
      const result = await checkInconsistentState();
      setHasInconsistentState(result.hasInconsistentState);
      setShowButton(result.hasInconsistentState);
    } catch (error) {
      console.error('Error checking state:', error);
    }
  };

  const handleEmergencyAction = () => {
    Alert.alert(
      '🚨 Opciones de Emergencia',
      'Selecciona una acción para resolver problemas de estado:',
      [
        {
          text: 'Cancelar',
          style: 'cancel'
        },
        {
          text: '🧹 Limpiar Solo Delivery',
          onPress: handleClearDeliveryOnly
        },
        {
          text: '🔄 Logout Rápido',
          onPress: handleQuickLogout
        },
        {
          text: '🚪 Logout con Confirmación',
          style: 'destructive',
          onPress: handleConfirmedLogout
        }
      ]
    );
  };

  const handleClearDeliveryOnly = async () => {
    setIsProcessing(true);
    try {
      await clearDeliveryOnly();
      // Recheck state after clearing
      await checkForInconsistentState();
    } catch (error) {
      console.error('Error clearing delivery state:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickLogout = async () => {
    setIsProcessing(true);
    try {
      await quickLogout();
    } catch (error) {
      console.error('Error in quick logout:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión. Intenta reiniciar la app.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmedLogout = async () => {
    setIsProcessing(true);
    try {
      await forceLogout(true);
    } catch (error) {
      console.error('Error in confirmed logout:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión. Intenta reiniciar la app.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!showButton && !showAlways) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.emergencyButton,
          {
            backgroundColor,
            borderColor: hasInconsistentState ? '#ff4444' : borderColor
          },
          buttonStyle
        ]}
        onPress={handleEmergencyAction}
        disabled={isProcessing}
        activeOpacity={0.7}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <>
            <Ionicons 
              name="warning" 
              size={16} 
              color={hasInconsistentState ? '#ff4444' : iconColor} 
            />
            <Text style={[
              styles.emergencyText,
              {
                color: hasInconsistentState ? '#ff4444' : iconColor
              },
              textStyle
            ]}>
              {hasInconsistentState ? 'Estado Inconsistente' : 'Logout Emergencia'}
            </Text>
          </>
        )}
      </TouchableOpacity>
      
      {hasInconsistentState && (
        <Text style={styles.warningText}>
          Se detectó un problema con el estado de delivery
        </Text>
      )}
    </View>
  );
};

// Componente flotante para usar como overlay
export const FloatingEmergencyButton = ({ visible = true, onPress, ...props }) => {
  if (!visible) return null;

  return (
    <View style={styles.floatingContainer}>
      <EmergencyLogoutButton
        showAlways={true}
        style={styles.floatingButton}
        buttonStyle={styles.floatingButtonStyle}
        {...props}
      />
    </View>
  );
};

// Hook para mostrar automáticamente en pantallas de delivery
export const useAutoEmergencyButton = () => {
  const [shouldShow, setShouldShow] = useState(false);
  const { checkInconsistentState } = useEmergencyLogout();

  useEffect(() => {
    const checkState = async () => {
      try {
        const result = await checkInconsistentState();
        setShouldShow(result.hasInconsistentState);
      } catch (error) {
        console.error('Error checking for emergency button:', error);
      }
    };

    checkState();
    
    // Check every 30 seconds while on delivery screens
    const interval = setInterval(checkState, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return shouldShow;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  emergencyText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6
  },
  warningText: {
    fontSize: 10,
    color: '#ff6666',
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  floatingContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000
  },
  floatingButton: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  floatingButtonStyle: {
    backgroundColor: '#fff',
    borderColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 10
  }
});

export default EmergencyLogoutButton;