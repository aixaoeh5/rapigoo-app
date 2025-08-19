import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getMyServices } from '../api/serviceApi';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import LazyImage from './shared/LazyImage';
import LoadingState from './shared/LoadingState';
import ErrorState from './shared/ErrorState';
import EmptyState from './shared/EmptyState';

// Memoized ServiceItem component
const ServiceItem = memo(({ item, onPress }) => (
  <TouchableOpacity
    style={styles.card}
    onPress={() => onPress(item)}
  >
    <LazyImage
      source={{ uri: item.image }}
      style={styles.image}
      resizeMode="cover"
      showLoader={true}
      fadeDuration={200}
    />
    <View style={styles.info}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.price}>${item.price.toFixed(2)}</Text>
    </View>
    <Icon
      name="create-outline"
      size={22}
      color="black"
      style={styles.editIcon}
    />
  </TouchableOpacity>
), (prevProps, nextProps) => {
  return (
    prevProps.item._id === nextProps.item._id &&
    prevProps.item.title === nextProps.item.title &&
    prevProps.item.price === nextProps.item.price &&
    prevProps.item.image === nextProps.item.image
  );
});

const ServicesScreen = () => {
  const navigation = useNavigation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const statusBarHeight = getStatusBarHeight();

  const loadServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyServices();
      setServices(data);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los servicios');
      console.error('Error loading services:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadServices();
    }, [])
  );

  const handleServicePress = useCallback((service) => {
    navigation.navigate('AddService', { service });
  }, [navigation]);

  const renderItem = useCallback(({ item }) => (
    <ServiceItem item={item} onPress={handleServicePress} />
  ), [handleServicePress]);

  const keyExtractor = useCallback((item) => item._id, []);

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>Tus Servicios</Text>

      <TouchableOpacity
        style={styles.addButtonLoginStyle}
        onPress={() => navigation.navigate('AddService')}
      >
        <Text style={styles.addButtonLoginText}>Agregar nuevo servicio</Text>
      </TouchableOpacity>

      {loading ? (
        <LoadingState message="Cargando servicios..." />
      ) : error ? (
        <ErrorState
          title="Error cargando servicios"
          message={error}
          onRetry={loadServices}
        />
      ) : services.length === 0 ? (
        <EmptyState
          title="No tienes servicios"
          message="Agrega tu primer servicio para comenzar a recibir pedidos"
          icon="restaurant-outline"
          showAction={true}
          actionText="Agregar Servicio"
          onAction={() => navigation.navigate('AddService')}
        />
      ) : (
        <FlatList
          data={services}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Navegación de comerciante */}
      <View style={styles.merchantBottomBar}>
        <TouchableOpacity 
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('HomeComerciante')}
        >
          <Icon name="home-outline" size={24} color="#666" />
          <Text style={styles.bottomBarText}>Inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('OrderManagement')}
        >
          <Icon name="receipt-outline" size={24} color="#666" />
          <Text style={styles.bottomBarText}>Pedidos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('Services')}
        >
          <Icon name="restaurant" size={24} color="#FF6B6B" />
          <Text style={[styles.bottomBarText, { color: '#FF6B6B' }]}>Servicios</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('ProfileMerchant')}
        >
          <Icon name="person-outline" size={24} color="#666" />
          <Text style={styles.bottomBarText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    position: 'absolute',
    top: 75,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 24,
  },
  addButtonLoginStyle: {
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    alignSelf: 'center',
    width: '80%',
    marginBottom: 20,
  },
  addButtonLoginText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loader: {
    marginTop: 20,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: 80,
    height: 80,
  },
  info: {
    flex: 1,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
  },
  price: {
    marginTop: 4,
    fontSize: 16,
    color: '#666',
  },
  editIcon: {
    paddingHorizontal: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  merchantBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 5,
  },
  bottomBarText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
});

export default ServicesScreen;
