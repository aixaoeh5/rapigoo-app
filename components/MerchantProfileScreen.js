import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
  TouchableOpacity,
  FlatList,
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
      <Text style={styles.serviceName}>{item.name}</Text>
      <Text style={styles.servicePrice}>${item.price}</Text>
    </View>
  );

  const renderGroupedServices = () => {
    const grouped = services.reduce((acc, service) => {
      const cat = service.category || 'Otros';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(service);
      return acc;
    }, {});

    return Object.entries(grouped).map(([category, items]) => (
      <View key={category} style={styles.serviceSection}>
        <Text style={styles.sectionTitle}>{category}</Text>
        <FlatList
          data={items}
          horizontal
          keyExtractor={(item) => item._id}
          renderItem={renderServiceItem}
          showsHorizontalScrollIndicator={false}
        />
      </View>
    ));
  };

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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="chevron-back" size={26} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {merchant.business?.businessName || merchant.name}
        </Text>
      </View>

      <View style={styles.profileSection}>
        <Image
          source={{
            uri: merchant.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
          }}
          style={styles.avatar}
        />
        <Text style={styles.name}>{merchant.business?.businessName || merchant.name}</Text>
        <Text style={styles.address}>📍 {merchant.business?.address || 'Dirección no disponible'}</Text>
        <Text style={styles.schedule}>
          🕒 {merchant.business?.schedule?.opening || '--'} - {merchant.business?.schedule?.closing || '--'}
        </Text>
        <Text style={styles.description}>
          {merchant.business?.description || 'Sin descripción disponible.'}
        </Text>
      </View>

      <View style={styles.servicesSection}>
        <Text style={styles.servicesTitle}>Servicios</Text>
        {renderGroupedServices()}
      </View>
    </ScrollView>
  );
};

export default MerchantProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileSection: {
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  schedule: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#444',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  servicesSection: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  servicesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  serviceSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  serviceCard: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '500',
  },
  servicePrice: {
    fontSize: 12,
    color: '#666',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
