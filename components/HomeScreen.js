import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { useCart } from './context/CartContext';
import { categories } from '../utils/categories';
import apiClient from '../api/apiClient';
import { useTheme } from './context/ThemeContext';

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
  const [loading, setLoading] = useState(false);
  const [searchInputRef, setSearchInputRef] = useState(null);

  useEffect(() => {
    checkUserRole();
    loadRecentSearches();
    loadFeaturedMerchants();
  }, []);

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
          navigation.reset({
            index: 0,
            routes: [{ name: 'HomeComerciante' }],
          });
        }
      }
    } catch (error) {
      console.error('Error verificando rol en HomeScreen:', error);
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
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setShowSearchResults(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await apiClient.get('/search', {
        params: {
          q: query,
          type: 'all',
          limit: 20
        }
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
                <Text style={styles.categoryText}>{item.name}</Text>
                <Image style={styles.categoryImage} source={item.image} />
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
    
    categoryImage: {
      width: '100%',
      height: 120,
      borderRadius: 10,
      backgroundColor: theme.colors.surface,
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
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.colors.surface,
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
  });

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
          <Image style={styles.bottomBarIcon} source={require('../assets/home.png')} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={focusSearchInput}
        >
          <Image style={styles.bottomBarIcon} source={require('../assets/search.png')} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('Cart')}
        >
          <View style={styles.cartIconContainer}>
            <Image style={styles.bottomBarIcon} source={require('../assets/cart.png')} />
            {getItemCount() > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{getItemCount()}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <Image style={styles.bottomBarIcon} source={require('../assets/user.png')} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default HomeScreen;
