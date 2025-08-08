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
import { useNavigation } from '@react-navigation/native';
import { useCart } from './context/CartContext';
import { apiClient } from '../api/apiClient';

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

  useEffect(() => {
    loadCartSummary();
  }, []);

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

  const validateForm = () => {
    if (!deliveryAddress.trim()) {
      Alert.alert('Error', 'Por favor ingresa la dirección de entrega');
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
      // Construir datos del pedido en el formato que espera el backend
      const orderData = {
        merchantId: cartSummary.merchant.id,
        items: cartSummary.items.map(item => ({
          serviceId: item.serviceId,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || '',
          options: item.options || []
        })),
        deliveryInfo: {
          address: {
            street: deliveryAddress.trim(),
            city: 'Ciudad', // Valor por defecto
            state: 'Estado', // Valor por defecto  
            zipCode: '00000', // Valor por defecto
            coordinates: [-69.5, -18.5] // Coordenadas por defecto
          },
          instructions: deliveryInstructions.trim(),
          contactPhone: customerPhone.trim()
        },
        paymentInfo: {
          method: paymentMethod,
          ...(paymentMethod === 'card' && {
            transactionId: 'test_transaction_' + Date.now()
          })
        },
        notes: deliveryInstructions.trim(),
        platform: 'mobile'
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

      const response = await apiClient.post('/orders', orderData);
      
      if (response.data.success) {
        // Limpiar carrito
        await clearCart();
        
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

      {/* Información de entrega */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información de entrega</Text>
        
        <Text style={styles.inputLabel}>Dirección de entrega *</Text>
        <TextInput
          style={styles.textInput}
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          placeholder="Ingresa tu dirección completa"
          multiline
        />

        <Text style={styles.inputLabel}>Instrucciones (opcional)</Text>
        <TextInput
          style={styles.textInput}
          value={deliveryInstructions}
          onChangeText={setDeliveryInstructions}
          placeholder="Piso, apartamento, referencias..."
          multiline
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
});

export default CheckoutScreen;