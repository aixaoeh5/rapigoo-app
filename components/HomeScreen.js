import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons as Icon } from '@expo/vector-icons';
import { useCart } from './context/CartContext';
import apiClient from '../api/apiClient';
import { useTheme } from './context/ThemeContext';
import LoadingState from './shared/LoadingState';
import ErrorState from './shared/ErrorState';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { getItemCount } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [featuredMerchants, setFeaturedMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInputRef, setSearchInputRef] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check user role first and stop if navigation occurs
      const navigationOccurred = await checkUserRole();
      if (navigationOccurred) {
        return; // Exit early if we're navigating away
      }
      
      await Promise.all([
        checkDeliveryAddress(),
        loadRecentSearches(),
        loadFeaturedMerchants(),
        loadActiveOrders(),
        loadCategories()
      ]);
    } catch (err) {
      setError(err.message || 'Error cargando la pantalla');
      console.error('Error initializing HomeScreen:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkUserRole = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const response = await apiClient.get('/auth/user');
        const userData = response.data;
        
        console.log('🔍 HomeScreen - Verificando rol usuario:', userData.role);
        
        // Si es comerciante, redirigir a su dashboard
        if (userData.role === 'comerciante' || userData.role === 'merchant') {
          console.log('⚠️ Comerciante detectado en HomeScreen, redirigiendo...');
          // Use replace instead of reset to prevent infinite loops
          navigation.replace('HomeComerciante');
          return true; // Return true to indicate navigation occurred
        }
      }
    } catch (error) {
      console.error('Error verificando rol en HomeScreen:', error);
    }
    return false; // Return false if no navigation occurred
  };

  const checkDeliveryAddress = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        
        // Solo verificar para clientes
        if (user.role === 'cliente' || user.role === 'client') {
          // Verificar si tiene dirección de entrega configurada
          if (!user.deliveryAddress || !user.deliveryAddress.coordinates || 
              !user.deliveryAddress.street) {
            
            Alert.alert(
              'Configurar Ubicación',
              'Para realizar pedidos necesitas configurar tu dirección de entrega.',
              [
                {
                  text: 'Configurar Ahora',
                  onPress: () => {
                    navigation.navigate('ClientLocationSetup');
                  }
                }
              ],
              { cancelable: false }
            );
          }
        }
      }
    } catch (error) {
      console.error('Error verificando dirección de entrega:', error);
    }
  };

  const loadRecentSearches = async () => {
    try {
      const searches = await AsyncStorage.getItem('recentSearches');
      if (searches) {
        setRecentSearches(JSON.parse(searches));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = async (query) => {
    try {
      const searches = recentSearches.filter(s => s !== query);
      const newSearches = [query, ...searches].slice(0, 5);
      setRecentSearches(newSearches);
      await AsyncStorage.setItem('recentSearches', JSON.stringify(newSearches));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const loadFeaturedMerchants = async () => {
    try {
      // Usar el endpoint que existe: GET /merchant/
      const response = await apiClient.get('/merchant/');
      
      // Por ahora, mostrar todos los comerciantes activos como "destacados"
      // En el futuro, podrías filtrar por un campo "featured" o "destacado"
      const activeMerchants = response.data?.filter(merchant => 
        merchant.role === 'comerciante' && 
        (merchant.merchantStatus === 'aprobado' || merchant.status === 'aprobado' || merchant.status === 'activo')
      ) || [];
      
      // Limitar a los primeros 5 comerciantes
      setFeaturedMerchants(activeMerchants.slice(0, 5));
    } catch (error) {
      console.error('Error loading featured merchants:', error);
      // Si hay error, simplemente no mostrar comerciantes destacados
      setFeaturedMerchants([]);
      throw error; // Re-throw to be caught by initializeScreen
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiClient.get('/system-categories');
      if (response.data.success && response.data.data) {
        setCategories(response.data.data);
      } else {
        // Si la respuesta no tiene el formato esperado, usar fallback
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      
      // Verificar si es un error 404 (servidor no tiene endpoint) o error de red
      const isEndpointNotFound = error.response?.status === 404;
      const isNetworkError = !error.response;
      
      if (isEndpointNotFound) {
        console.log('🔄 Endpoint /system-categories no disponible, usando categorías por defecto');
      } else if (isNetworkError) {
        console.log('🌐 Error de red, usando categorías por defecto');
      }
      
      // Usar categorías por defecto en todos los casos
      setCategories([
        { name: 'Colmado', icon: '🏪', _id: '1' },
        { name: 'Farmacia', icon: '💊', _id: '2' },
        { name: 'Belleza', icon: '💄', _id: '3' },
        { name: 'Restaurantes', icon: '🍽️', _id: '4' },
        { name: 'Pizzería', icon: '🍕', _id: '5' },
        { name: 'Comedores', icon: '🍱', _id: '6' },
        { name: 'Comida rápida', icon: '🍔', _id: '7' },
        { name: 'Postres', icon: '🍰', _id: '8' },
        { name: 'Panadería', icon: '🥖', _id: '9' },
        { name: 'Heladería', icon: '🍦', _id: '10' },
        { name: 'Ferretería', icon: '🔧', _id: '11' },
        { name: 'Supermercado', icon: '🛒', _id: '12' }
      ]);
    }
  };

  const loadActiveOrders = async () => {
    try {
      console.log('📋 Cargando pedidos activos...');
      console.log('📋 URL completa:', '/orders');
      
      const response = await apiClient.get('/orders', { 
        params: { 
          limit: 10 // Aumentar límite para ver más pedidos
        } 
      });
      
      console.log('📋 Respuesta del servidor:', {
        success: response.data.success,
        hasData: !!response.data.data,
        hasOrders: !!response.data.orders,
        dataKeys: Object.keys(response.data),
        ordersLength: response.data.orders?.length || 'no orders',
        ordersType: typeof response.data.orders
      });
      
      if (response.data.success) {
        // Debugging: Mostrar toda la respuesta para entender la estructura
        console.log('📋 Respuesta completa:', JSON.stringify(response.data, null, 2));
        
        let ordersArray = null;
        
        if (response.data.orders && Array.isArray(response.data.orders)) {
          ordersArray = response.data.orders;
          console.log('📋 Usando response.data.orders directamente');
        } else if (response.data.data?.orders && Array.isArray(response.data.data.orders)) {
          ordersArray = response.data.data.orders;
          console.log('📋 Usando response.data.data.orders');
        } else if (response.data.data && Array.isArray(response.data.data)) {
          ordersArray = response.data.data;
          console.log('📋 Usando response.data.data como array');
        } else if (Array.isArray(response.data.orders)) {
          ordersArray = response.data.orders;
          console.log('📋 Usando response.data.orders (forzado)');
        } else {
          console.log('📋 Estructura de respuesta no reconocida');
          console.log('📋 Keys disponibles:', Object.keys(response.data));
          console.log('📋 Tipo de orders:', typeof response.data.orders);
          console.log('📋 Valor de orders:', response.data.orders);
        }
        
        if (ordersArray) {
          console.log('📋 Total de pedidos recibidos:', ordersArray.length);
          console.log('📋 Estados de pedidos:', ordersArray.map(order => ({
            id: order._id?.slice(-6) || 'no-id',
            orderNumber: order.orderNumber,
            status: order.status,
            merchantName: order.merchantId?.name || order.merchantId?.business?.businessName || 'Sin comerciante'
          })));
          
          // Filtrar pedidos activos
          const activeOrdersList = ordersArray.filter(order => {
            const isValid = order && order.status;
            const isActiveStatus = ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'in_transit'].includes(order.status);
            
            console.log(`📋 Pedido ${order.orderNumber || order._id?.slice(-6)}: válido=${isValid}, estado=${order.status}, activo=${isActiveStatus}`);
            
            return isValid && isActiveStatus;
          });
          
          console.log('📋 Pedidos activos encontrados:', activeOrdersList.length);
          console.log('📋 Pedidos activos:', activeOrdersList.map(order => ({
            orderNumber: order.orderNumber,
            status: order.status,
            merchant: order.merchantId?.name || order.merchantId?.business?.businessName
          })));
          
          setActiveOrders(activeOrdersList);
        } else {
          console.log('⚠️ No se encontró estructura de pedidos válida');
          setActiveOrders([]);
        }
      } else {
        console.log('⚠️ Respuesta no exitosa');
        setActiveOrders([]);
      }
    } catch (error) {
      console.error('Error loading active orders:', error.message);
      console.error('Error details:', {
        response: error.response?.data,
        status: error.response?.status
      });
      setActiveOrders([]);
    }
  };

  const handleSearch = async (query, filters = {}) => {
    if (!query.trim()) {
      setShowSearchResults(false);
      return;
    }

    try {
      setIsSearching(true);
      const searchParams = {
        q: query,
        type: 'all',
        limit: 20,
        sortBy: filters.sortBy || 'relevance',
        ...filters
      };

      // Agregar ubicación del usuario si está disponible para ordenar por distancia
      if (filters.sortBy === 'distance' && userLocation) {
        searchParams.location = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          radius: filters.radius || 10
        };
      }

      const response = await apiClient.get('/search', {
        params: searchParams
      });

      if (response.data.success) {
        setSearchResults(response.data.results || []);
        setShowSearchResults(true);
        saveRecentSearch(query);
      }
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'No se pudo realizar la búsqueda');
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      handleSearch(searchQuery.trim());
    }
  };

  const focusSearchInput = () => {
    if (searchInputRef) {
      searchInputRef.focus();
    }
  };

  const renderCategories = () => {
    const rows = [];
    for (let i = 0; i < categories.length; i += 2) {
      const row = (
        <View key={i} style={styles.categoryRow}>
          {[categories[i], categories[i + 1]].map((item, index) => {
            if (!item) return null;
            return (
              <TouchableOpacity
                key={index}
                style={styles.categoryBox}
                onPress={() =>
                  navigation.navigate('Category', { category: item.name })
                }
              >
                <Text style={styles.categoryIcon}>{item.icon || '📦'}</Text>
                <Text style={styles.categoryText}>{item.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
      rows.push(row);
    }
    return rows;
  };

  const renderSearchResults = () => (
    <ScrollView style={styles.searchResultsContainer}>
      <View style={styles.searchHeader}>
        <Text style={styles.searchResultsTitle}>
          Resultados para "{searchQuery}" ({searchResults.length})
        </Text>
        <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
          <Icon name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>
      
      {searchResults.map((result, index) => (
        <TouchableOpacity
          key={index}
          style={styles.searchResultItem}
          onPress={() => {
            if (result.type === 'merchant') {
              navigation.navigate('MerchantProfile', { merchantId: result._id });
            } else if (result.type === 'service') {
              navigation.navigate('ServiceDetail', { serviceId: result._id });
            }
          }}
        >
          <View style={styles.resultIcon}>
            <Icon 
              name={result.type === 'merchant' ? 'storefront-outline' : 'restaurant-outline'} 
              size={24} 
              color="#FF6B6B" 
            />
          </View>
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{result.name}</Text>
            <Text style={styles.resultSubtitle}>
              {result.type === 'merchant' ? result.category : result.merchantName}
            </Text>
            {result.rating && (
              <View style={styles.resultRating}>
                <Icon name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>{(result.rating || 0).toFixed(1)}</Text>
              </View>
            )}
          </View>
          {result.price && (
            <Text style={styles.resultPrice}>${(result.price || 0).toFixed(2)}</Text>
          )}
        </TouchableOpacity>
      ))}
      
      {searchResults.length === 0 && !isSearching && (
        <View style={styles.noResults}>
          <Icon name="search-outline" size={48} color="#ccc" />
          <Text style={styles.noResultsText}>No se encontraron resultados</Text>
          <Text style={styles.noResultsSubtext}>
            Intenta con términos diferentes o explora nuestras categorías
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderRecentSearches = () => (
    recentSearches.length > 0 && (
      <View style={styles.recentSearchesContainer}>
        <Text style={styles.sectionTitle}>Búsquedas recientes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {recentSearches.map((search, index) => (
            <TouchableOpacity
              key={index}
              style={styles.recentSearchItem}
              onPress={() => {
                setSearchQuery(search);
                handleSearch(search);
              }}
            >
              <Icon name="time-outline" size={16} color="#666" />
              <Text style={styles.recentSearchText}>{search}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )
  );

  const getStatusColor = (status) => {
    const colors = {
      pending: '#FFA500',
      confirmed: '#4CAF50',
      preparing: '#2196F3',
      ready: '#FF9800',
      assigned: '#9C27B0',
      picked_up: '#607D8B',
      in_transit: '#FF5722',
      delivered: '#4CAF50',
      cancelled: '#F44336'
    };
    return colors[status] || '#666';
  };

  const getStatusText = (status) => {
    const texts = {
      pending: 'Pendiente',
      confirmed: 'Confirmado',
      preparing: 'Preparando',
      ready: 'Listo',
      assigned: 'Asignado',
      picked_up: 'Recogido',
      in_transit: 'En camino',
      delivered: 'Entregado',
      cancelled: 'Cancelado'
    };
    return texts[status] || status;
  };

  const renderActiveOrders = () => {
    if (activeOrders.length === 0) return null;

    return (
      <View style={styles.activeOrdersSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mis Pedidos Activos</Text>
          <TouchableOpacity onPress={() => navigation.navigate('HistorialPedidos')}>
            <Text style={styles.viewAllText}>Ver todos</Text>
          </TouchableOpacity>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeOrdersContainer}
        >
          {activeOrders.map((order, index) => (
            <TouchableOpacity
              key={index}
              style={styles.activeOrderCard}
              onPress={() => navigation.navigate('OrderTracking', { 
                orderId: order._id,
                orderNumber: order.orderNumber 
              })}
            >
              <View style={styles.orderCardHeader}>
                <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
              </View>
              <Text style={styles.orderMerchant} numberOfLines={1}>
                {order.merchantId?.name || order.merchantId?.business?.businessName || 'Comerciante'}
              </Text>
              <Text style={styles.orderStatus}>
                {getStatusText(order.status)}
              </Text>
              <Text style={styles.orderTotal}>
                ${(order.total || 0).toFixed(2)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderFeaturedMerchants = () => (
    featuredMerchants.length > 0 && (
      <View style={styles.featuredContainer}>
        <Text style={styles.sectionTitle}>Comerciantes destacados</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {featuredMerchants.map((merchant, index) => (
            <TouchableOpacity
              key={index}
              style={styles.featuredMerchant}
              onPress={() => navigation.navigate('MerchantProfile', { merchantId: merchant._id })}
            >
              <View style={styles.merchantAvatar}>
                <Text style={styles.merchantAvatarText}>
                  {merchant.business?.businessName?.charAt(0) || merchant.name?.charAt(0) || 'M'}
                </Text>
              </View>
              <Text style={styles.merchantName} numberOfLines={1}>
                {merchant.business?.businessName || merchant.name || 'Comerciante'}
              </Text>
              <Text style={styles.merchantCategory}>
                {merchant.business?.category || 'General'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )
  );

  const styles = StyleSheet.create({
    container: { 
      flex: 1, 
      backgroundColor: theme.colors.background 
    },
    
    // Search Container
    searchContainer: {
      paddingTop: 50,
      paddingHorizontal: 20,
      paddingBottom: 10,
      backgroundColor: theme.colors.card,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 25,
      paddingHorizontal: 15,
      height: 50,
      marginBottom: 15,
    },
    
    searchIcon: {
      marginRight: 10,
    },
    
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    
    clearButton: {
      marginLeft: 10,
    },
    
    searchLoader: {
      marginLeft: 10,
    },
    
    // Filters
    filtersContainer: {
      paddingBottom: 5,
    },
    
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    
    filterText: {
      marginLeft: 6,
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '500',
    },
    
    // Main Content
    mainContent: {
      flex: 1,
    },
    
    // Search Results
    searchResultsContainer: {
      flex: 1,
      backgroundColor: theme.colors.card,
      paddingHorizontal: 20,
    },
    
    searchHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    
    searchResultsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    
    clearSearchButton: {
      padding: 5,
    },
    
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    
    resultIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${theme.colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 15,
    },
    
    resultInfo: {
      flex: 1,
    },
    
    resultTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    
    resultSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    
    resultRating: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    
    ratingText: {
      marginLeft: 4,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    
    resultPrice: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.success,
    },
    
    noResults: {
      alignItems: 'center',
      paddingVertical: 50,
    },
    
    noResultsText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginTop: 15,
      marginBottom: 5,
    },
    
    noResultsSubtext: {
      fontSize: 14,
      color: theme.colors.textTertiary,
      textAlign: 'center',
      paddingHorizontal: 40,
    },
    
    // Recent Searches
    recentSearchesContainer: {
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: theme.colors.card,
      marginBottom: 10,
    },
    
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    
    recentSearchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      marginRight: 10,
    },
    
    recentSearchText: {
      marginLeft: 6,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    
    // Featured Merchants
    featuredContainer: {
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: theme.colors.card,
      marginBottom: 10,
    },
    
    featuredMerchant: {
      alignItems: 'center',
      marginRight: 15,
      width: 80,
    },
    
    merchantAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    
    merchantAvatarText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: 'white',
    },
    
    merchantName: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 2,
    },
    
    merchantCategory: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    
    // Ads
    adContainer: { 
      height: 150, 
      marginVertical: 10,
      paddingHorizontal: 20,
    },
    
    adBox: {
      width: 300,
      height: 130,
      marginRight: 15,
      borderRadius: 10,
    },
    
    // Categories
    categoriesSection: {
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: theme.colors.card,
      marginBottom: 10,
    },
    
    categoriesContent: { 
      paddingBottom: 20,
    },
    
    categoryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 15,
    },
    
    categoryBox: { 
      alignItems: 'center', 
      width: '48%' 
    },
    
    categoryIcon: {
      fontSize: 40,
      marginBottom: 8,
      alignSelf: 'center'
    },
    
    categoryText: {
      marginTop: 8,
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
      textAlign: 'center',
    },
    
    // Bottom Bar
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 80,
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'center',
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 50,
      borderTopRightRadius: 50,
      paddingHorizontal: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    
    bottomBarItem: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      paddingVertical: 8,
    },
    
    bottomBarLabel: {
      fontSize: 10,
      color: '#666',
      marginTop: 2,
      fontWeight: '500',
    },
    
    bottomBarIcon: {
      width: 24,
      height: 24,
      tintColor: theme.colors.textSecondary,
    },
    
    cartIconContainer: {
      position: 'relative',
    },
    
    cartBadge: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: '#FF6B6B',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    
    cartBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    
    ordersIconContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    activeBadge: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: '#4CAF50',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    
    activeBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },

    // Estilos para pedidos activos
    activeOrdersSection: {
      marginBottom: 20,
      paddingHorizontal: 20,
    },
    
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    
    viewAllText: {
      fontSize: 14,
      color: '#FF6B6B',
      fontWeight: '600',
    },
    
    activeOrdersContainer: {
      paddingRight: 20,
    },
    
    activeOrderCard: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      marginRight: 12,
      width: 180,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    
    orderCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    
    orderNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
    },
    
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    
    orderMerchant: {
      fontSize: 14,
      color: '#FF6B6B',
      marginBottom: 6,
      fontWeight: '600',
    },
    
    orderStatus: {
      fontSize: 12,
      color: '#666',
      marginBottom: 8,
    },
    
    orderTotal: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#333',
    },
  });

  if (loading) {
    return (
      <LoadingState 
        message="Cargando..." 
        color={theme.colors.primary}
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Error de conexión"
        message={error}
        onRetry={initializeScreen}
        retryText="Reintentar"
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Enhanced Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search-outline" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            ref={setSearchInputRef}
            style={styles.searchInput}
            placeholder="Buscar comerciantes, servicios..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            placeholderTextColor={theme.colors.textTertiary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Icon name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
          {isSearching && (
            <ActivityIndicator size="small" color={theme.colors.primary} style={styles.searchLoader} />
          )}
        </View>
        
        {/* Quick filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
          <TouchableOpacity style={styles.filterChip}>
            <Icon name="location-outline" size={16} color="#FF6B6B" />
            <Text style={styles.filterText}>Cerca de mí</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Icon name="star-outline" size={16} color="#FF6B6B" />
            <Text style={styles.filterText}>Mejor calificados</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Icon name="time-outline" size={16} color="#FF6B6B" />
            <Text style={styles.filterText}>Delivery rápido</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Show search results or main content */}
      {showSearchResults ? renderSearchResults() : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.mainContent}>
          {renderActiveOrders()}
          {renderRecentSearches()}
          {renderFeaturedMerchants()}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adContainer}>
            <View style={[styles.adBox, { backgroundColor: '#FFD580' }]} />
            <View style={[styles.adBox, { backgroundColor: '#000000' }]} />
          </ScrollView>

          <View style={styles.categoriesSection}>
            <Text style={styles.sectionTitle}>Explorar categorías</Text>
            <View style={styles.categoriesContent}>
              {renderCategories()}
            </View>
          </View>
        </ScrollView>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomBarItem}>
          <Icon name="home" size={24} color="#FF6B6B" />
          <Text style={[styles.bottomBarLabel, { color: '#FF6B6B' }]}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => {
            // Si hay pedidos activos, ir directamente al tracking del más reciente
            if (activeOrders.length > 0) {
              const mostRecentOrder = activeOrders[0];
              navigation.navigate('OrderTracking', { 
                orderId: mostRecentOrder._id,
                orderNumber: mostRecentOrder.orderNumber 
              });
            } else {
              navigation.navigate('HistorialPedidos');
            }
          }}
        >
          <View style={styles.ordersIconContainer}>
            <Icon 
              name={activeOrders.length > 0 ? "bicycle" : "receipt-outline"} 
              size={24} 
              color={activeOrders.length > 0 ? "#FF6B6B" : "#666"} 
            />
            {activeOrders.length > 0 && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>{activeOrders.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomBarLabel, activeOrders.length > 0 && { color: '#FF6B6B' }]}>
            {activeOrders.length > 0 ? 'Seguir' : 'Pedidos'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={focusSearchInput}
        >
          <Icon name="search-outline" size={24} color="#666" />
          <Text style={styles.bottomBarLabel}>Buscar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('Cart')}
        >
          <View style={styles.cartIconContainer}>
            <Icon name="bag-outline" size={24} color="#666" />
            {getItemCount() > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{getItemCount()}</Text>
              </View>
            )}
          </View>
          <Text style={styles.bottomBarLabel}>Carrito</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <Icon name="person-outline" size={24} color="#666" />
          <Text style={styles.bottomBarLabel}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default HomeScreen;
