import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getMerchantsByCategory } from '../api/merchant';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import LazyImage from './shared/LazyImage';

// Memoized MerchantItem component
const MerchantItem = memo(({ item, onPress }) => (
  <TouchableOpacity
    style={styles.card}
    onPress={() => onPress(item._id)}
  >
    <LazyImage
      source={{ uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }}
      style={styles.avatar}
      resizeMode="cover"
      showLoader={true}
      fadeDuration={200}
    />
    <View>
      <Text style={styles.name}>
        {item.business?.businessName || item.name}
      </Text>
      <Text style={styles.address}>
        {typeof item.business?.address === 'string' 
          ? item.business.address 
          : item.business?.address?.street 
            ? `${item.business.address.street}, ${item.business.address.city}` 
            : 'Dirección no disponible'}
      </Text>
      <Text style={styles.schedule}>
        Horario: {item.business?.schedule?.opening || '--'} - {item.business?.schedule?.closing || '--'}
      </Text>
    </View>
    <Icon name="chevron-forward" size={20} color="#888" style={{ marginLeft: 'auto' }} />
  </TouchableOpacity>
), (prevProps, nextProps) => {
  return (
    prevProps.item._id === nextProps.item._id &&
    prevProps.item.business?.businessName === nextProps.item.business?.businessName &&
    prevProps.item.avatar === nextProps.item.avatar
  );
});

const CategoryScreen = ({ route }) => {
  const { category } = route.params;
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const statusBarHeight = getStatusBarHeight();

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        console.log('🔎 Obteniendo comerciantes por categoría:', category);
        const data = await getMerchantsByCategory(category);
        console.log('✅ Comerciantes recibidos:', data);
        setMerchants(data);
      } catch (error) {
        console.error('❌ Error al obtener comerciantes:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchants();
  }, [category]);

  const handleMerchantPress = useCallback((merchantId) => {
    navigation.navigate('MerchantProfile', { merchantId });
  }, [navigation]);

  const renderItem = useCallback(({ item }) => (
    <MerchantItem item={item} onPress={handleMerchantPress} />
  ), [handleMerchantPress]);

  const keyExtractor = useCallback((item) => item._id, []);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (merchants.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No hay comerciantes en esta categoría</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.backButton, { top: statusBarHeight + 10 }]} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <Text style={styles.title}>{category.toUpperCase()}</Text>

      <FlatList
        data={merchants}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 16,
    alignSelf: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 10,
    zIndex: 10,
    padding: 8,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    color: '#777',
    marginTop: 2,
  },
  schedule: {
    fontSize: 13,
    color: '#555',
    marginTop: 1,
  },
});

export default CategoryScreen;
