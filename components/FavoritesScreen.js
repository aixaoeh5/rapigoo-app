import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFavorites } from './context/FavoritesContext';
import { useLoading } from './context/LoadingContext';

const FavoritesScreen = () => {
  const navigation = useNavigation();
  const { 
    favorites, 
    loading: favoritesLoading, 
    syncFavorites, 
    searchFavorites,
    getFavoritesByCategory,
    clearAllFavorites,
    toggleMerchantFavorite,
    toggleServiceFavorite
  } = useFavorites();
  const { showLoading, hideLoading, showSuccess, showError } = useLoading();

  const [activeTab, setActiveTab] = useState('all'); // 'all', 'merchants', 'services'
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState({ merchants: [], services: [] });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    filterData();
  }, [favorites, searchQuery, activeTab]);

  const filterData = () => {
    let merchants = favorites.merchants;
    let services = favorites.services;

    // Filtrar por búsqueda
    if (searchQuery) {
      const searchResults = searchFavorites(searchQuery);
      merchants = searchResults.merchants;
      services = searchResults.services;
    }

    setFilteredData({ merchants, services });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncFavorites();
    } catch (error) {
      showError('Error al sincronizar favoritos');
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearFavorites = () => {
    Alert.alert(
      'Eliminar todos los favoritos',
      '¿Estás seguro de que quieres eliminar todos tus favoritos? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            showLoading('Eliminando favoritos...');
            const success = await clearAllFavorites();
            hideLoading();
            if (success) {
              showSuccess('Favoritos eliminados');
            } else {
              showError('Error al eliminar favoritos');
            }
          }
        }
      ]
    );
  };

  const renderMerchantItem = ({ item }) => (
    <TouchableOpacity
      style={styles.favoriteItem}
      onPress={() => navigation.navigate('MerchantProfile', { merchantId: item._id })}
    >
      <View style={styles.merchantAvatar}>
        <Text style={styles.avatarText}>
          {item.businessName?.charAt(0) || 'M'}
        </Text>
      </View>
      
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.businessName}</Text>
        <Text style={styles.itemSubtitle}>{item.category}</Text>
        {item.rating > 0 && (
          <View style={styles.ratingContainer}>
            <Icon name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>{(item.rating || 0).toFixed(1)}</Text>
            <Text style={styles.ordersText}>• {item.totalOrders} pedidos</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() => toggleMerchantFavorite(item)}
      >
        <Icon name="heart" size={24} color="#FF6B6B" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderServiceItem = ({ item }) => (
    <TouchableOpacity
      style={styles.favoriteItem}
      onPress={() => navigation.navigate('ServiceDetail', { serviceId: item._id })}
    >
      <View style={styles.serviceImage}>
        <Icon name="restaurant-outline" size={24} color="#FF6B6B" />
      </View>
      
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle}>{item.name}</Text>
        <Text style={styles.itemSubtitle}>{item.merchantName}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>${(item.price || 0).toFixed(2)}</Text>
          {item.preparationTime && (
            <Text style={styles.prepTime}>• {item.preparationTime} min</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() => toggleServiceFavorite(item)}
      >
        <Icon name="heart" size={24} color="#FF6B6B" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="heart-outline" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>Sin favoritos aún</Text>
      <Text style={styles.emptyMessage}>
        Los comerciantes y servicios que marques como favoritos aparecerán aquí
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.exploreButtonText}>Explorar comerciantes</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTabButton = (tab, title, count) => (
    <TouchableOpacity
      key={tab}
      style={[
        styles.tabButton,
        activeTab === tab && styles.tabButtonActive
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabButtonText,
        activeTab === tab && styles.tabButtonTextActive
      ]}>
        {title}
      </Text>
      {count > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const getData = () => {
    switch (activeTab) {
      case 'merchants':
        return filteredData.merchants;
      case 'services':
        return filteredData.services;
      default:
        return [
          ...filteredData.merchants.map(item => ({ ...item, type: 'merchant' })),
          ...filteredData.services.map(item => ({ ...item, type: 'service' }))
        ];
    }
  };

  const renderItem = ({ item }) => {
    if (item.type === 'merchant' || item.businessName) {
      return renderMerchantItem({ item });
    } else {
      return renderServiceItem({ item });
    }
  };

  const totalCount = filteredData.merchants.length + filteredData.services.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Favoritos</Text>
        <TouchableOpacity 
          onPress={handleClearFavorites}
          disabled={totalCount === 0}
        >
          <Icon 
            name="trash-outline" 
            size={24} 
            color={totalCount > 0 ? "#F44336" : "#ccc"} 
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search-outline" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar en favoritos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {renderTabButton('all', 'Todos', totalCount)}
        {renderTabButton('merchants', 'Comerciantes', filteredData.merchants.length)}
        {renderTabButton('services', 'Servicios', filteredData.services.length)}
      </View>

      {/* Content */}
      {totalCount === 0 ? renderEmptyState() : (
        <FlatList
          data={getData()}
          keyExtractor={(item) => `${item.type || 'item'}-${item._id}`}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#FF6B6B']}
              tintColor="#FF6B6B"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Stats Footer */}
      {totalCount > 0 && (
        <View style={styles.statsFooter}>
          <Text style={styles.statsText}>
            {totalCount} favorito{totalCount !== 1 ? 's' : ''} • 
            {filteredData.merchants.length} comerciante{filteredData.merchants.length !== 1 ? 's' : ''} • 
            {filteredData.services.length} servicio{filteredData.services.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 45,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#f5f5f5',
  },
  tabButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  merchantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  serviceImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#fff3f3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  ordersText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  prepTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  favoriteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  exploreButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsFooter: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default FavoritesScreen;