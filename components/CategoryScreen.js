import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import axios from 'axios';

const CategoryScreen = ({ route }) => {
  const { category } = route.params;
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const BASE_URL =
          Platform.OS === 'android'
            ? 'http://10.0.2.2:5000'
            : 'http://localhost:5000';

        const res = await axios.get(
          `${BASE_URL}/api/merchant/category?category=${category}`
        );
        setMerchants(res.data);
      } catch (error) {
        console.error('Error al obtener comerciantes:', error);
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
      <Text style={styles.title}>{category.toUpperCase()}</Text>
      <FlatList
        data={merchants}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View>
              <Text style={styles.name}>
                {item.business?.businessName || item.name}
              </Text>
              <Text style={styles.address}>{item.business?.address}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  address: { color: '#666' },
});

export default CategoryScreen;
