import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { getMerchantsByCategory } from '../api/merchant';

const CategoryScreen = ({ route }) => {
  const { category } = route.params;
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const data = await getMerchantsByCategory(category);
        setMerchants(data);
      } catch (error) {
        console.error('❌ Error al obtener comerciantes:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchants();
  }, [category]);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#000" />;
  }

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{category}</Text>
      </View>

      {/* Lista de comerciantes */}
      <FlatList
        data={merchants}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate('MerchantProfile', { merchantId: item._id })
            }
          >
            <Image
              source={{
                uri: item.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
              }}
              style={styles.avatar}
            />
            <View style={styles.info}>
              <Text style={styles.name}>
                {item.business?.businessName || item.name}
              </Text>
              <Text style={styles.address}>
                {item.business?.address || 'Dirección no disponible'}
              </Text>
              <Text style={styles.schedule}>
                {item.business?.schedule?.opening || '--'} a{' '}
                {item.business?.schedule?.closing || '--'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default CategoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  address: {
    fontSize: 14,
    color: '#555',
    marginBottom: 1,
  },
  schedule: {
    fontSize: 13,
    color: '#888',
  },
});
