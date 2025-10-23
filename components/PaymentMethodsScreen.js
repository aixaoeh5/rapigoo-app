import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { useTheme } from './context/ThemeContext';
import apiClient from '../api/apiClient';

const PaymentMethodsScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const statusBarHeight = getStatusBarHeight();
  
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultMethod, setDefaultMethod] = useState(null);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      // TODO: Implementar endpoint real
      // const response = await apiClient.get('/payment/methods');
      // setPaymentMethods(response.data.methods);
      // setDefaultMethod(response.data.defaultMethod);
      
      // Datos simulados mientras se implementa el backend
      setTimeout(() => {
        setPaymentMethods([
          {
            id: '1',
            type: 'card',
            brand: 'visa',
            last4: '4242',
            expiryMonth: 12,
            expiryYear: 2025,
            isDefault: true,
          },
          {
            id: '2',
            type: 'card',
            brand: 'mastercard',
            last4: '5555',
            expiryMonth: 10,
            expiryYear: 2026,
            isDefault: false,
          }
        ]);
        setDefaultMethod('1');
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      Alert.alert('Error', 'No se pudieron cargar los métodos de pago');
      setLoading(false);
    }
  };

  const handleSetDefault = async (methodId) => {
    try {
      // TODO: Implementar endpoint real
      // await apiClient.put(`/payment/methods/${methodId}/default`);
      
      setDefaultMethod(methodId);
      setPaymentMethods(prev => 
        prev.map(method => ({
          ...method,
          isDefault: method.id === methodId
        }))
      );
      
      Alert.alert('Éxito', 'Método de pago predeterminado actualizado');
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el método predeterminado');
    }
  };

  const handleDeleteMethod = (methodId) => {
    Alert.alert(
      'Eliminar Método de Pago',
      '¿Estás seguro de que quieres eliminar este método de pago?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: () => deleteMethod(methodId)
        }
      ]
    );
  };

  const deleteMethod = async (methodId) => {
    try {
      // TODO: Implementar endpoint real
      // await apiClient.delete(`/payment/methods/${methodId}`);
      
      setPaymentMethods(prev => prev.filter(method => method.id !== methodId));
      
      if (defaultMethod === methodId) {
        const remaining = paymentMethods.filter(method => method.id !== methodId);
        if (remaining.length > 0) {
          setDefaultMethod(remaining[0].id);
        } else {
          setDefaultMethod(null);
        }
      }
      
      Alert.alert('Éxito', 'Método de pago eliminado');
    } catch (error) {
      Alert.alert('Error', 'No se pudo eliminar el método de pago');
    }
  };

  const getCardIcon = (brand) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return 'card-outline';
      case 'mastercard':
        return 'card-outline';
      case 'american express':
      case 'amex':
        return 'card-outline';
      default:
        return 'card-outline';
    }
  };

  const getCardColor = (brand) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return '#1A1F71';
      case 'mastercard':
        return '#EB001B';
      case 'american express':
      case 'amex':
        return '#006FCF';
      default:
        return theme.colors.textSecondary;
    }
  };

  const formatCardNumber = (last4) => {
    return `•••• •••• •••• ${last4}`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: statusBarHeight + 10,
      paddingBottom: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      marginRight: 15,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    content: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 30,
    },
    methodsList: {
      padding: 20,
    },
    methodCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      marginBottom: 15,
      overflow: 'hidden',
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    defaultBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: theme.colors.success,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    defaultText: {
      fontSize: 10,
      fontWeight: '600',
      color: 'white',
      textTransform: 'uppercase',
    },
    methodHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 15,
    },
    methodInfo: {
      flex: 1,
    },
    cardNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    cardDetails: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    methodActions: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonBorder: {
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: theme.colors.border,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.primary,
    },
    deleteText: {
      color: theme.colors.error,
    },
    addButton: {
      backgroundColor: theme.colors.primary,
      margin: 20,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    securityNote: {
      backgroundColor: theme.colors.surface,
      margin: 20,
      padding: 15,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    securityIcon: {
      marginRight: 10,
      marginTop: 2,
    },
    securityText: {
      flex: 1,
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Métodos de Pago</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Métodos de Pago</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {paymentMethods.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon 
              name="card-outline" 
              size={64} 
              color={theme.colors.textTertiary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>Sin métodos de pago</Text>
            <Text style={styles.emptyText}>
              Agrega un método de pago para realizar compras de forma rápida y segura.
            </Text>
          </View>
        ) : (
          <View style={styles.methodsList}>
            {paymentMethods.map((method) => (
              <View key={method.id} style={styles.methodCard}>
                {method.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultText}>Predeterminado</Text>
                  </View>
                )}
                
                <View style={styles.methodHeader}>
                  <View style={[
                    styles.cardIcon,
                    { backgroundColor: `${getCardColor(method.brand)}20` }
                  ]}>
                    <Icon 
                      name={getCardIcon(method.brand)} 
                      size={20} 
                      color={getCardColor(method.brand)} 
                    />
                  </View>
                  
                  <View style={styles.methodInfo}>
                    <Text style={styles.cardNumber}>
                      {formatCardNumber(method.last4)}
                    </Text>
                    <Text style={styles.cardDetails}>
                      {method.brand.toUpperCase()} • Vence {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                    </Text>
                  </View>
                </View>

                <View style={styles.methodActions}>
                  {!method.isDefault && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonBorder]}
                      onPress={() => handleSetDefault(method.id)}
                    >
                      <Text style={styles.actionText}>Predeterminado</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteMethod(method.id)}
                  >
                    <Text style={[styles.actionText, styles.deleteText]}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => navigation.navigate('AddPaymentMethod')}
        >
          <Text style={styles.addButtonText}>+ Agregar Método de Pago</Text>
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Icon 
            name="shield-checkmark" 
            size={16} 
            color={theme.colors.success}
            style={styles.securityIcon}
          />
          <Text style={styles.securityText}>
            Tus datos de pago están protegidos con encriptación de nivel bancario. 
            No almacenamos información sensible de tarjetas en nuestros servidores.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default PaymentMethodsScreen;