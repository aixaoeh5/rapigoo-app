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

const MerchantProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { merchantId } = route.params;

  const [merchant, setMerchant] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMerchantProfile = async () => {
      try {
        const data = await getMerchantPublicProfile(merchantId);
        setMerchant(data.merchant);
        setServices(data.services || []);
      } catch (err) {
        console.error('❌ Error al cargar perfil público:', err.message);
        Alert.alert('Error', err.message || 'No se pudo cargar el perfil');
      } finally {
        setLoading(false);
      }
    };

    fetchMerchantProfile();
  }, [merchantId]);

  const renderServiceItem = ({ item }) => (
    <View style={styles.serviceCard}>
      <Image
        source={{ uri: item.image || 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png' }}
        style={styles.serviceImage}
      />
      <View style={styles.serviceInfo}>
        <Text style={styles.serviceTitle}>{item.title}</Text>
        <Text style={styles.serviceDescription}>
          {item.description || 'Sin descripción'}
        </Text>
        <Text style={styles.servicePrice}>DOP ${item.price}</Text>
      </View>
      <Icon name="checkmark-circle" size={20} color="green" />
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
        📍 {merchant?.business?.address || 'Dirección no disponible'}
      </Text>

      <Text style={styles.sectionTitle}>SERVICIOS</Text>
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
      data={services}
      keyExtractor={(item) => item._id}
      renderItem={renderServiceItem}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
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
    fontSize: 13,
    color: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
