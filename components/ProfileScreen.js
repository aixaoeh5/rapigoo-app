import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const statusBarHeight = getStatusBarHeight();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('https://cdn-icons-png.flaticon.com/512/149/149071.png');

useFocusEffect(
  React.useCallback(() => {
    const fetchUserData = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      try {
        const res = await axios.get('http://10.0.2.2:5000/api/auth/user', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = res.data;
        console.log('✅ Usuario cargado:', data);

        setName(data.name);
        setEmail(data.email);
        setPhone(data.phone || '');
        setAvatar(data.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png');

      } catch (error) {
        console.error('❌ Error al cargar perfil:', error);
        Alert.alert('Error', error.response?.data?.message || 'No se pudo cargar el perfil');
      }
    };

    fetchUserData();
  }, [])
);

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: statusBarHeight + 10, paddingBottom: 40 },
      ]}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <View style={styles.centeredSection}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
          <TouchableOpacity
            style={styles.editIcon}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Icon name="pencil" size={14} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{name}</Text>
        {phone ? <Text style={styles.contact}>{phone}</Text> : null}
        <Text style={styles.contact}>{email}</Text>
      </View>

      <View style={styles.sectionList}>
        <TouchableOpacity style={styles.listItem}>
          <Text style={styles.listText}>Métodos de pago</Text>
          <Icon name="chevron-forward" size={16} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.listItem}>
          <Text style={styles.listText}>Seguridad</Text>
          <Icon name="chevron-forward" size={16} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.listItem}>
          <Text style={styles.listText}>Ayuda</Text>
          <Icon name="chevron-forward" size={16} color="#555" />
        </TouchableOpacity>

        <View style={styles.bottomSection}>
          <Text style={styles.bottomText}>Lenguaje</Text>
          <Text style={styles.language}>Spanish ▾</Text>
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.bottomText}>Modo oscuro</Text>
          <Text style={styles.language}>OFF</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 58,
    left: 1,
    zIndex: 10,
    padding: 10,
  },
  centeredSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  editIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    borderRadius: 10,
    padding: 5,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
  },
  contact: {
    fontSize: 14,
    color: 'gray',
  },
  sectionList: {
    marginTop: 10,
    gap: 10,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  listText: {
    fontSize: 16,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  bottomText: {
    fontSize: 16,
    color: '#333',
  },
  language: {
    fontSize: 16,
    color: '#888',
  },
  logoutButton: {
    marginTop: 30,
    backgroundColor: '#c00',
    padding: 15,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ProfileScreen;


