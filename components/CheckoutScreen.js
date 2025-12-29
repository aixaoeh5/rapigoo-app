import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCart } from './context/CartContext';
import apiClient from '../api/apiClient';
import NotificationService from '../services/NotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CheckoutScreen = () => {
  const navigation = useNavigation();
  const { getCartSummary, clearCart } = useCart();

  const [cartSummary, setCartSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  
  // Información del pedido
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerPhone, setCustomerPhone] = useState('');
  const [userDeliveryData, setUserDeliveryData] = useState(null);

  useEffect(() => {
    // Inicializar servicio de notificaciones al entrar al checkout
    NotificationService.initialize();
    loadCartSummary();
    loadUserDeliveryAddress();
  }, []);

  // Recargar datos cada vez que la pantalla se enfoca
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 Checkout screen focused - recargando datos...');
      loadUserDeliveryAddress(); // Recargar dirección de entrega
    }, [])
  );

  const loadCartSummary = async () => {
    setLoading(true);
    try {
      console.log('📋 Cargando resumen del carrito desde backend...');
      
      // Usar el endpoint del backend directamente
      const response = await apiClient.get('/cart/summary');
      
      if (response.data) {
        console.log('📋 Cart Summary recibido del backend:', response.data);
        setCartSummary(response.data);
      } else {
        Alert.alert('Error', 'Error al cargar el carrito');
        navigation.goBack();
      }
    } catch (error) {
      console.error('❌ Error cargando resumen:', error);
      
      if (error.response?.status === 400) {
        Alert.alert('Carrito vacío', 'No hay items en el carrito');
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Error al cargar el carrito');
      }
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadUserDeliveryAddress = async () => {
    try {
      console.log('📍 Cargando dirección de entrega del usuario...');
      
      // Primero intentar cargar desde el servidor (más actualizado)
      try {
        const response = await apiClient.get('/auth/user');
        console.log('📍 Datos del servidor:', response.data);
        
        if (response.data.deliveryAddress && response.data.deliveryAddress.coordinates && response.data.deliveryAddress.coordinates.length === 2) {
          console.log('✅ Dirección encontrada en servidor:', {
            street: response.data.deliveryAddress.street,
            coordinates: response.data.deliveryAddress.coordinates,
            city: response.data.deliveryAddress.city
          });
          setUserDeliveryData(response.data.deliveryAddress);
          setDeliveryInstructions(response.data.deliveryAddress.instructions || '');
          
          // Actualizar AsyncStorage con datos del servidor
          const userData = await AsyncStorage.getItem('userData');
          if (userData) {
            const user = JSON.parse(userData);
            user.deliveryAddress = response.data.deliveryAddress;
            await AsyncStorage.setItem('userData', JSON.stringify(user));
            console.log('✅ AsyncStorage actualizado con dirección del servidor');
          }
        } else {
          console.log('⚠️ No hay dirección válida en el servidor');
          console.log('📍 Datos recibidos:', {
            hasDeliveryAddress: !!response.data.deliveryAddress,
            hasCoordinates: !!response.data.deliveryAddress?.coordinates,
            coordinatesLength: response.data.deliveryAddress?.coordinates?.length,
            street: response.data.deliveryAddress?.street
          });
          setUserDeliveryData(null);
        }
        
        // Cargar teléfono del usuario
        if (response.data.phone) {
          setCustomerPhone(response.data.phone);
        }
        
      } catch (serverError) {
        console.log('⚠️ Error del servidor, intentando AsyncStorage...');
        
        // Fallback a AsyncStorage
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          
          if (user.deliveryAddress && user.deliveryAddress.coordinates && user.deliveryAddress.coordinates.length === 2) {
            console.log('✅ Dirección encontrada en AsyncStorage:', {
              street: user.deliveryAddress.street,
              coordinates: user.deliveryAddress.coordinates,
              city: user.deliveryAddress.city
            });
            setUserDeliveryData(user.deliveryAddress);
            setDeliveryInstructions(user.deliveryAddress.instructions || '');
          } else {
            console.log('⚠️ No hay dirección válida en AsyncStorage tampoco');
            console.log('📍 Datos de AsyncStorage:', {
              hasDeliveryAddress: !!user.deliveryAddress,
              hasCoordinates: !!user.deliveryAddress?.coordinates,
              coordinatesLength: user.deliveryAddress?.coordinates?.length,
              street: user.deliveryAddress?.street
            });
            setUserDeliveryData(null);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error cargando dirección del usuario:', error);
      setUserDeliveryData(null);
    }
  };

  const validateForm = () => {
    if (!userDeliveryData || !userDeliveryData.coordinates || userDeliveryData.coordinates.length !== 2) {
      Alert.alert('Dirección requerida', 'Por favor configura tu dirección de entrega antes de continuar', [
        {
          text: 'Configurar ahora',
          onPress: () => navigation.navigate('ClientLocationSetup')
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]);
      return false;
    }
    if (!userDeliveryData.street || !userDeliveryData.street.trim()) {
      Alert.alert('Dirección incompleta', 'Por favor completa tu dirección de entrega', [
        {
          text: 'Editar dirección',
          onPress: () => navigation.navigate('ClientLocationSetup', { isEditing: true })
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]);
      return false;
    }
    if (!customerPhone.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu número de teléfono');
      return false;
    }
    if (customerPhone.length < 10) {
      Alert.alert('Error', 'Por favor ingresa un número de teléfono válido');
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateForm()) return;

    // Validar que tenemos el resumen del carrito
    if (!cartSummary || !cartSummary.items || cartSummary.items.length === 0) {
      Alert.alert('Error', 'No hay items en el carrito');
      return;
    }

    if (!cartSummary.merchant || !cartSummary.merchant.id) {
      Alert.alert('Error', 'Información del comerciante no disponible');
      return;
    }

    setPlacing(true);
    
    try {
      // Validar que tenemos coordenadas de entrega válidas
      if (!userDeliveryData || !userDeliveryData.coordinates || userDeliveryData.coordinates.length !== 2) {
        Alert.alert('Error', 'No se pudo obtener tu ubicación de entrega. Por favor configura tu dirección.');
        return;
      }
      
      // Validar que las coordenadas son números válidos
      const [longitude, latitude] = userDeliveryData.coordinates;
      if (typeof longitude !== 'number' || typeof latitude !== 'number' || 
          longitude === 0 || latitude === 0 || 
          isNaN(longitude) || isNaN(latitude)) {
        Alert.alert('Error', 'Coordenadas de entrega inválidas. Por favor configura tu dirección nuevamente.');
        return;
      }
      
      // Validar que tenemos una dirección completa
      if (!userDeliveryData.street || !userDeliveryData.street.trim()) {
        Alert.alert('Error', 'Dirección de entrega incompleta. Por favor completa tu dirección.');
        return;
      }

      // Construir datos del pedido en el formato que espera el backend
      const orderData = {
        deliveryInfo: {
          address: {
            street: userDeliveryData.street,
            city: userDeliveryData.city || 'Santo Domingo',
            state: userDeliveryData.state || 'Distrito Nacional',  
            zipCode: userDeliveryData.zipCode || '10101',
            coordinates: userDeliveryData.coordinates
          },
          instructions: deliveryInstructions.trim(),
          contactPhone: customerPhone.trim()
        },
        paymentMethod: paymentMethod,
        customerInfo: {
          phone: customerPhone.trim(),
          deliveryAddress: `${userDeliveryData.street}, ${userDeliveryData.city || 'Santo Domingo'}`,
          deliveryInstructions: deliveryInstructions.trim()
        }
      };

      console.log('📋 Enviando datos del pedido:', JSON.stringify(orderData, null, 2));

      // Simular procesamiento de pago con tarjeta
      if (paymentMethod === 'card') {
        Alert.alert(
          'Procesando pago',
          'Simulando pago con tarjeta de prueba...',
          [{ text: 'OK' }]
        );
        // Simular delay de procesamiento
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const response = await apiClient.post('/orders/checkout', orderData);
      
      if (response.data.success) {
        // Limpiar carrito
        await clearCart();
        
        // Enviar notificación local inmediata
        NotificationService.sendLocalNotification({
          channelId: 'rapigoo-orders',
          title: '✅ Pedido creado exitosamente',
          message: `Tu pedido #${response.data.order.orderNumber} ha sido enviado al comerciante`,
          data: {
            type: 'order_update',
            orderId: response.data.order._id,
            orderNumber: response.data.order.orderNumber,
            status: 'pending'
          }
        });
        
        // Navegar a pantalla de confirmación
        navigation.reset({
          index: 0,
          routes: [
            { name: 'Home' },
            { 
              name: 'OrderConfirmation', 
              params: { 
                orderNumber: response.data.order.orderNumber,
                orderId: response.data.order._id
              }
            }
          ]
        });
      } else {
        Alert.alert('Error', response.data.error || 'No se pudo crear el pedido');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Error al crear el pedido';
      Alert.alert('Error', errorMessage);
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (!cartSummary) {
    return (
      <View style={styles.container}>
        <Text>Error al cargar el resumen</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Resumen del comerciante */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pedido de</Text>
        <Text style={styles.merchantName}>{cartSummary.merchant.name}</Text>
        <Text style={styles.merchantAddress}>
          {typeof cartSummary.merchant.address === 'string' 
            ? cartSummary.merchant.address 
            : cartSummary.merchant.address?.street || 'Dirección no disponible'
          }
        </Text>
        <Text style={styles.estimatedTime}>
          Tiempo estimado: {cartSummary.estimatedPreparationTime} min
        </Text>
      </View>

      {/* Items del pedido */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tu pedido</Text>
        {cartSummary.items.map((item, index) => (
          <View key={index} style={styles.orderItem}>
            <Text style={styles.itemQuantity}>{item.quantity || 0}x</Text>
            <Text style={styles.itemName}>{item.serviceName || 'Producto'}</Text>
            <Text style={styles.itemPrice}>${(item.totalPrice || 0).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Dirección de entrega configurada */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dirección de entrega</Text>

        {userDeliveryData ? (
          <View style={styles.deliveryAddressContainer}>
            <View style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <View style={styles.locationIcon}>
                  <Text style={styles.locationIconText}>📍</Text>
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressTitle}>Tu ubicación guardada</Text>
                  <Text style={styles.addressText}>
                    {userDeliveryData.street}
                    {userDeliveryData.city && `, ${userDeliveryData.city}`}
                  </Text>
                  {userDeliveryData.landmarks && (
                    <Text style={styles.landmarksText}>
                      📍 {userDeliveryData.landmarks}
                    </Text>
                  )}
                </View>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('ClientLocationSetup', { isEditing: true })}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.inputLabel}>Instrucciones para el delivery (opcional)</Text>
            <TextInput
              style={styles.textInput}
              value={deliveryInstructions}
              onChangeText={setDeliveryInstructions}
              placeholder="Ej: Apartamento 3B, tocar timbre, casa azul..."
              multiline
              numberOfLines={2}
            />

            <Text style={styles.inputLabel}>Teléfono de contacto *</Text>
            <TextInput
              style={styles.textInput}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="Ej: 8091234567"
              keyboardType="phone-pad"
            />
          </View>
        ) : (
          <View style={styles.noAddressContainer}>
            <Text style={styles.noAddressTitle}>⚠️ Ubicación requerida</Text>
            <Text style={styles.noAddressText}>
              Necesitas configurar tu dirección de entrega antes de hacer un pedido
            </Text>
            <TouchableOpacity 
              style={styles.configureLocationButton}
              onPress={() => navigation.navigate('ClientLocationSetup')}
            >
              <Text style={styles.configureLocationText}>Configurar mi ubicación</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Método de pago */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Método de pago</Text>
        
        <TouchableOpacity
          style={[
            styles.paymentOption,
            paymentMethod === 'cash' && styles.paymentOptionSelected
          ]}
          onPress={() => setPaymentMethod('cash')}
        >
          <View style={styles.radioButton}>
            {paymentMethod === 'cash' && <View style={styles.radioButtonSelected} />}
          </View>
          <Text style={styles.paymentOptionText}>Efectivo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.paymentOption,
            paymentMethod === 'card' && styles.paymentOptionSelected
          ]}
          onPress={() => setPaymentMethod('card')}
        >
          <View style={styles.radioButton}>
            {paymentMethod === 'card' && <View style={styles.radioButtonSelected} />}
          </View>
          <Text style={styles.paymentOptionText}>Tarjeta de crédito (Prueba)</Text>
        </TouchableOpacity>
      </View>

      {/* Resumen de precios */}
      <View style={styles.section}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Subtotal</Text>
          <Text style={styles.priceValue}>${(cartSummary.subtotal || 0).toFixed(2)}</Text>
        </View>
        
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Delivery</Text>
          <Text style={styles.priceValue}>
            {(cartSummary.deliveryFee || 0) === 0 ? 'Gratis' : `$${(cartSummary.deliveryFee || 0).toFixed(2)}`}
          </Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.priceRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${(cartSummary.total || 0).toFixed(2)}</Text>
        </View>
      </View>

      {/* Botón de confirmar pedido */}
      <TouchableOpacity 
        style={[styles.confirmButton, placing && styles.confirmButtonDisabled]}
        onPress={handlePlaceOrder}
        disabled={placing}
      >
        {placing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.confirmButtonText}>
            Confirmar pedido • ${(cartSummary.total || 0).toFixed(2)}
          </Text>
        )}
      </TouchableOpacity>
      
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  merchantAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  estimatedTime: {
    fontSize: 14,
    color: '#FF6B6B',
    marginTop: 5,
    fontWeight: '500',
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
    width: 30,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 10,
  },
  paymentOptionSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#fff5f5',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B6B',
  },
  paymentOptionText: {
    fontSize: 16,
    color: '#333',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priceLabel: {
    fontSize: 16,
    color: '#666',
  },
  priceValue: {
    fontSize: 16,
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  confirmButton: {
    backgroundColor: '#FF6B6B',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#FFB3B3',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 30,
  },
  deliveryAddressContainer: {
    marginBottom: 0,
  },
  addressCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIconText: {
    fontSize: 24,
  },
  addressInfo: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  landmarksText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  editButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  noAddressContainer: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  noAddressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  noAddressText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  configureLocationButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  configureLocationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CheckoutScreen;