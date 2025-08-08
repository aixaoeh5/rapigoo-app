import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getMyServices } from '../api/serviceApi';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStatusBarHeight } from 'react-native-status-bar-height';

const ServicesScreen = () => {
  const navigation = useNavigation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const statusBarHeight = getStatusBarHeight();

  const loadServices = async () => {
    setLoading(true);
    try {
      const data = await getMyServices();
      setServices(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudieron cargar los servicios');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadServices();
    }, [])
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('AddService', { service: item })}
    >
      <Image
        source={{ uri: item.image }}
        style={styles.image}
        resizeMode="cover"
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
  );

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
        <ActivityIndicator size="large" style={styles.loader} />
      ) : services.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tienes servicios aún.</Text>
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={item => item._id}
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
