import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCart } from './context/CartContext';

const CartScreen = () => {
  const navigation = useNavigation();
  const { items, subtotal, deliveryFee, total, loading, error, updateItemQuantity, removeFromCart, isEmpty } = useCart();
  
  console.log('🛒 CartScreen render - items:', items);
  console.log('🛒 CartScreen render - isEmpty:', isEmpty);
  console.log('🛒 CartScreen render - loading:', loading);

  // Si el carrito está vacío, mostrar pantalla vacía
  console.log('🛒 Evaluando si mostrar pantalla vacía - isEmpty:', isEmpty, 'loading:', loading);
  if (isEmpty && !loading) {
    console.log('🛒 Mostrando pantalla vacía');
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={styles.content}>
          <Image
            source={require('../assets/box.png')}
            style={styles.emptyCartImage}
          />
          <Text style={styles.title}>Tu carrito está vacío</Text>
          <Text style={styles.message}>Agrega productos para continuar.</Text>
          <TouchableOpacity 
            style={styles.continueShoppingButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.continueShoppingText}>Continuar comprando</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (newQuantity === 0) {
      Alert.alert(
        'Remover item',
        '¿Estás seguro de que deseas remover este item del carrito?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Remover', 
            style: 'destructive',
            onPress: () => removeFromCart(itemId)
          }
        ]
      );
    } else {
      await updateItemQuantity(itemId, newQuantity);
    }
  };

  const handleCheckout = () => {
    navigation.navigate('Checkout');
  };

  if (loading) {
    console.log('🛒 Mostrando loading');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Cargando carrito...</Text>
      </View>
    );
  }
  
  console.log('🛒 Renderizando carrito con items:', items.length);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Carrito</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Items del carrito */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Información del comerciante */}
        {items.length > 0 && (
          <View style={styles.merchantInfo}>
            <Text style={styles.merchantName}>{items[0].merchantName}</Text>
            <Text style={styles.merchantAddress}>Tiempo estimado: 30-45 min</Text>
          </View>
        )}

        {/* Lista de items */}
        {items.map((item) => (
          <View key={item._id} style={styles.cartItem}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.serviceName}</Text>
              <Text style={styles.itemDescription} numberOfLines={2}>
                {item.serviceDescription}
              </Text>
              <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            </View>
            
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item._id, item.quantity - 1)}
              >
                <Text style={styles.quantityButtonText}>-</Text>
              </TouchableOpacity>
              
              <Text style={styles.quantity}>{item.quantity}</Text>
              
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => handleQuantityChange(item._id, item.quantity + 1)}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Resumen del pedido */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>${(subtotal || 0).toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery</Text>
          <Text style={styles.summaryValue}>
            {(deliveryFee || 0) === 0 ? 'Gratis' : `$${(deliveryFee || 0).toFixed(2)}`}
          </Text>
        </View>
        
        <View style={styles.divider} />
        
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${(total || 0).toFixed(2)}</Text>
        </View>
      </View>

      {/* Botón de checkout */}
      <TouchableOpacity 
        style={styles.checkoutButton}
        onPress={handleCheckout}
      >
        <Text style={styles.checkoutButtonText}>
          Proceder al pago • ${(total || 0).toFixed(2)}
        </Text>
      </TouchableOpacity>
    </View>
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
  backButtonText: {
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
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 10,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 5,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  merchantInfo: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  merchantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  merchantAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
    marginRight: 15,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  itemDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 5,
  },
  quantityButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantity: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 15,
    color: '#333',
  },
  summary: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
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
  checkoutButton: {
    backgroundColor: '#FF6B6B',
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Estilos para carrito vacío
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  message: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  continueShoppingButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  continueShoppingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CartScreen;