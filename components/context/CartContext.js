import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../../api/apiClient';

const CartContext = createContext();

// Estados del carrito
const CART_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_CART: 'SET_CART',
  ADD_ITEM: 'ADD_ITEM',
  UPDATE_ITEM: 'UPDATE_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  CLEAR_CART: 'CLEAR_CART',
  SET_ERROR: 'SET_ERROR'
};

const initialState = {
  items: [],
  subtotal: 0,
  deliveryFee: 0,
  total: 0,
  loading: false,
  error: null
};

const cartReducer = (state, action) => {
  switch (action.type) {
    case CART_ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case CART_ACTIONS.SET_CART:
      const newState = {
        ...state,
        items: action.payload.items || [],
        subtotal: action.payload.subtotal || 0,
        deliveryFee: action.payload.deliveryFee || 0,
        total: action.payload.total || 0,
        loading: false,
        error: null
      };
      console.log('🔄 Cart state actualizado:', newState);
      return newState;
    
    case CART_ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case CART_ACTIONS.CLEAR_CART:
      return { ...initialState };
    
    default:
      return state;
  }
};

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isInitialized, setIsInitialized] = useState(false);

  // Cargar carrito al iniciar (solo una vez y priorizar local)
  useEffect(() => {
    if (!isInitialized) {
      console.log('🚀 Inicializando CartProvider...');
      // SIEMPRE priorizar carrito local primero
      loadCartLocal().finally(() => setIsInitialized(true));
    }
  }, [isInitialized]);

  // Persistir carrito cuando cambie
  useEffect(() => {
    if (state.items.length > 0) {
      persistCartLocally();
    }
  }, [state.items]);

  const persistCartLocally = async () => {
    try {
      await AsyncStorage.setItem('cart', JSON.stringify({
        items: state.items,
        subtotal: state.subtotal,
        deliveryFee: state.deliveryFee,
        total: state.total
      }));
    } catch (error) {
      console.error('Error al persistir carrito:', error);
    }
  };

  const loadCartLocal = async () => {
    console.log('📱 Cargando carrito desde AsyncStorage únicamente...');
    dispatch({ type: CART_ACTIONS.SET_LOADING, payload: true });
    
    try {
      const localCart = await AsyncStorage.getItem('cart');
      if (localCart) {
        const cartData = JSON.parse(localCart);
        console.log('✅ Carrito local encontrado:', cartData);
        dispatch({ type: CART_ACTIONS.SET_CART, payload: cartData });
      } else {
        console.log('📭 No hay carrito local, iniciando vacío');
        dispatch({ type: CART_ACTIONS.SET_CART, payload: initialState });
      }
    } catch (error) {
      console.log('❌ Error cargando carrito local:', error);
      dispatch({ type: CART_ACTIONS.SET_CART, payload: initialState });
    }
  };

  const loadCart = async (forceServerLoad = false) => {
    dispatch({ type: CART_ACTIONS.SET_LOADING, payload: true });
    
    try {
      // Verificar token antes de hacer la llamada
      const token = await AsyncStorage.getItem('token');
      console.log('🔑 Token disponible:', !!token);
      
      if (!token || !forceServerLoad) {
        console.log('⚠️  Sin token o no forzando carga, cargando carrito local');
        // Sin token, cargar desde AsyncStorage
        try {
          const localCart = await AsyncStorage.getItem('cart');
          if (localCart) {
            const cartData = JSON.parse(localCart);
            console.log('✅ Carrito cargado desde AsyncStorage:', cartData);
            dispatch({ type: CART_ACTIONS.SET_CART, payload: cartData });
          } else {
            console.log('📭 No hay carrito local, iniciando vacío');
            dispatch({ type: CART_ACTIONS.SET_CART, payload: initialState });
          }
        } catch (localError) {
          dispatch({ type: CART_ACTIONS.SET_CART, payload: initialState });
        }
        return;
      }
      
      // Intentar cargar desde servidor solo si se fuerza
      console.log('📡 Cargando carrito desde servidor...');
      const response = await apiClient.get('/cart');
      console.log('✅ Carrito cargado desde servidor:', response.data);
      dispatch({ type: CART_ACTIONS.SET_CART, payload: response.data });
    } catch (error) {
      console.log('⚠️  Error cargando carrito del servidor:', error.message);
      // Si falla, cargar desde AsyncStorage
      try {
        const localCart = await AsyncStorage.getItem('cart');
        if (localCart) {
          const cartData = JSON.parse(localCart);
          console.log('✅ Carrito cargado desde AsyncStorage (fallback):', cartData);
          dispatch({ type: CART_ACTIONS.SET_CART, payload: cartData });
        } else {
          console.log('📭 No hay carrito local, iniciando vacío');
          dispatch({ type: CART_ACTIONS.SET_CART, payload: initialState });
        }
      } catch (localError) {
        console.log('❌ Error cargando carrito local:', localError);
        dispatch({ type: CART_ACTIONS.SET_ERROR, payload: 'Error al cargar carrito' });
      }
    }
  };

  const addToCart = async (serviceId, quantity = 1) => {
    dispatch({ type: CART_ACTIONS.SET_LOADING, payload: true });
    
    try {
      console.log('🛒 Agregando al carrito:', { serviceId, quantity });
      console.log('🔗 API Client:', apiClient);
      console.log('📡 Base URL:', apiClient.defaults.baseURL);
      
      const response = await apiClient.post('/cart/add', {
        serviceId,
        quantity
      });
      
      console.log('✅ Respuesta del carrito:', response.data);
      
      dispatch({ type: CART_ACTIONS.SET_CART, payload: response.data.cart });
      return { success: true, message: response.data.message };
    } catch (error) {
      console.error('❌ Error agregando al carrito:', error);
      console.error('❌ Error completo:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
      
      const errorMessage = error.response?.data?.error || error.message || 'Error al agregar al carrito';
      dispatch({ type: CART_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const updateItemQuantity = async (itemId, quantity) => {
    dispatch({ type: CART_ACTIONS.SET_LOADING, payload: true });
    
    try {
      const response = await apiClient.put(`/cart/item/${itemId}`, {
        quantity
      });
      
      dispatch({ type: CART_ACTIONS.SET_CART, payload: response.data.cart });
      return { success: true, message: response.data.message };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Error al actualizar cantidad';
      dispatch({ type: CART_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const removeFromCart = async (itemId) => {
    dispatch({ type: CART_ACTIONS.SET_LOADING, payload: true });
    
    try {
      const response = await apiClient.delete(`/cart/item/${itemId}`);
      dispatch({ type: CART_ACTIONS.SET_CART, payload: response.data.cart });
      return { success: true, message: response.data.message };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Error al remover item';
      dispatch({ type: CART_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const clearCart = async () => {
    dispatch({ type: CART_ACTIONS.SET_LOADING, payload: true });
    
    try {
      await apiClient.delete('/cart');
      dispatch({ type: CART_ACTIONS.CLEAR_CART });
      await AsyncStorage.removeItem('cart');
      return { success: true, message: 'Carrito limpiado' };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Error al limpiar carrito';
      dispatch({ type: CART_ACTIONS.SET_ERROR, payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const getCartSummary = async () => {
    try {
      // Si ya tenemos items en el contexto, generar resumen local
      if (state.items.length > 0) {
        console.log('📋 Generando resumen desde contexto local...');
        const merchant = state.items[0].merchantId;
        const summary = {
          merchant: {
            id: merchant._id,
            name: merchant.business?.businessName || merchant.name,
            address: merchant.business?.address || 'Dirección no disponible',
            phone: merchant.business?.phone || merchant.phone
          },
          items: state.items.map(item => ({
            id: item._id,
            serviceName: item.serviceName,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity
          })),
          subtotal: state.subtotal,
          deliveryFee: state.deliveryFee,
          total: state.total,
          estimatedPreparationTime: 30
        };
        console.log('✅ Resumen local generado:', summary);
        return { success: true, data: summary };
      }
      
      // Si no hay items en contexto, intentar desde servidor
      console.log('📡 Obteniendo resumen desde servidor...');
      const response = await apiClient.get('/cart/summary');
      console.log('✅ Resumen del servidor:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Error obteniendo resumen:', error);
      const errorMessage = error.response?.data?.error || 'Error al obtener resumen';
      return { success: false, error: errorMessage };
    }
  };

  const getItemCount = () => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };

  const value = {
    // Estado
    ...state,
    
    // Métodos
    addToCart,
    updateItemQuantity,
    removeFromCart,
    clearCart,
    loadCart,
    loadCartLocal,
    getCartSummary,
    
    // Utilidades
    getItemCount,
    isEmpty: state.items.length === 0
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe ser usado dentro de CartProvider');
  }
  return context;
};