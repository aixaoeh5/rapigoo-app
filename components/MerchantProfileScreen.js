import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  Alert,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getMerchantPublicProfile } from '../api/merchant';
import { useCart } from './context/CartContext';

const MerchantProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { merchantId } = route.params;
  const { addToCart, loading: cartLoading } = useCart();

  const [merchant, setMerchant] = useState(null);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(null);

  useEffect(() => {
    const fetchMerchantProfile = async () => {
      try {
        const data = await getMerchantPublicProfile(merchantId);
        setMerchant(data.merchant);
        setServices(data.services || []);
        
        // Obtener categorías únicas de los servicios
        const uniqueCategories = [...new Set(data.services.map(s => s.category))].filter(Boolean);
        setCategories(uniqueCategories);
        
        // Por defecto mostrar todos los productos
        setSelectedCategory(null);
      } catch (err) {
        console.error('❌ Error al cargar perfil público:', err.message);
        Alert.alert('Error', err.message || 'No se pudo cargar el perfil');
      } finally {
        setLoading(false);
      }
    };

    fetchMerchantProfile();
  }, [merchantId]);

  const handleAddToCart = async (service) => {
    setAddingToCart(service._id);
    
    try {
      const result = await addToCart(service._id, 1);
      
      if (result.success) {
        Alert.alert(
          'Agregado al carrito',
          result.message,
          [
            { text: 'Continuar', style: 'default' },
            { 
              text: 'Ver carrito', 
              style: 'default',
              onPress: () => navigation.navigate('Cart')
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar al carrito');
    } finally {
      setAddingToCart(null);
    }
  };

  const renderServiceItem = ({ item }) => (
    <View style={styles.serviceCard}>
      <Image
        source={{ 
          uri: (item.images && item.images[0]) || item.image || 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png' 
        }}
        style={styles.serviceImage}
      />
      <View style={styles.serviceInfo}>
        <Text style={styles.serviceTitle}>{item.name || item.title}</Text>
        <Text style={styles.serviceDescription}>
          {item.description || 'Sin descripción'}
        </Text>
        <Text style={styles.servicePrice}>DOP ${item.price}</Text>
        
        {item.available ? (
          <TouchableOpacity 
            style={[
              styles.addToCartButton,
              addingToCart === item._id && styles.addToCartButtonLoading
            ]}
            onPress={() => handleAddToCart(item)}
            disabled={addingToCart === item._id}
          >
            {addingToCart === item._id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="add" size={16} color="#fff" />
                <Text style={styles.addToCartText}>Agregar</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <Text style={styles.unavailableText}>No disponible</Text>
        )}
      </View>
    </View>
  );

  // Filtrar servicios por categoría
  const filteredServices = selectedCategory 
    ? services.filter(service => service.category === selectedCategory)
    : services;

  const renderCategoryFilter = () => (
    <View style={styles.categoryContainer}>
      <TouchableOpacity 
        style={[
          styles.categoryButton,
          !selectedCategory && styles.categoryButtonActive
        ]}
        onPress={() => setSelectedCategory(null)}
      >
        <Text style={[
          styles.categoryText,
          !selectedCategory && styles.categoryTextActive
        ]}>
          Todos
        </Text>
      </TouchableOpacity>
      
      {categories.map((category) => (
        <TouchableOpacity 
          key={category}
          style={[
            styles.categoryButton,
            selectedCategory === category && styles.categoryButtonActive
          ]}
          onPress={() => setSelectedCategory(category)}
        >
          <Text style={[
            styles.categoryText,
            selectedCategory === category && styles.categoryTextActive
          ]}>
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Icon name="chevron-back" size={26} color="#000" />
      </TouchableOpacity>

      <Image
        source={{
          uri: merchant?.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        }}
        style={styles.avatar}
      />
      <Text style={styles.businessName}>
        {merchant?.business?.businessName || merchant?.name}
      </Text>
      <Text style={styles.description}>
        {merchant?.business?.description || 'Sin descripción del negocio'}
      </Text>
      <Text style={styles.infoText}>
        🕒 {merchant?.business?.schedule?.opening || '--'} -{' '}
        {merchant?.business?.schedule?.closing || '--'}
      </Text>
      <Text style={styles.infoText}>
        📍 {typeof merchant?.business?.address === 'string' 
          ? merchant.business.address 
          : merchant?.business?.address?.street 
            ? `${merchant.business.address.street}, ${merchant.business.address.city}` 
            : 'Dirección no disponible'}
      </Text>

      <Text style={styles.sectionTitle}>MENÚ</Text>
      {renderCategoryFilter()}
    </View>
  );

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#000" />;
  }

  if (!merchant) {
    return (
      <View style={styles.centered}>
        <Text>No se encontró el comerciante</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredServices}
      keyExtractor={(item) => item._id}
      renderItem={renderServiceItem}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No hay productos en esta categoría
          </Text>
        </View>
      )}
    />
  );
};

export default MerchantProfileScreen;

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  headerContainer: {
    alignItems: 'center',
    padding: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    top: 50,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  businessName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#444',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    alignSelf: 'flex-start',
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f6f6',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    elevation: 2,
  },
  serviceImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  serviceDescription: {
    fontSize: 13,
    color: '#777',
    marginVertical: 2,
  },
  servicePrice: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  addToCartButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  addToCartButtonLoading: {
    backgroundColor: '#FFB3B3',
  },
  addToCartText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
    fontSize: 14,
  },
  unavailableText: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    flexDirection: 'row',
    paddingVertical: 10,
    marginBottom: 10,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
