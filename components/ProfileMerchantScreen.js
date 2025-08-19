import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';

const ProfileMerchantScreen = () => {
  const navigation = useNavigation();
  const statusBarHeight = getStatusBarHeight();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('https://cdn-icons-png.flaticon.com/512/149/149071.png');
  const [address, setAddress] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState('');
  const [scheduleClose, setScheduleClose] = useState('');
  const [socials, setSocials] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      const fetchMerchant = async () => {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        try {
          const res = await apiClient.get('/auth/user');

          const data = res.data;

          setName(data.name);
          setEmail(data.email);
          setPhone(data.phone || '');
          setAvatar(data.avatar || '');
          const businessAddress = data.business?.address;
          if (typeof businessAddress === 'string') {
            setAddress(businessAddress);
          } else if (businessAddress?.street) {
            setAddress(`${businessAddress.street}, ${businessAddress.city}, ${businessAddress.state}`);
          } else {
            setAddress('');
          }
          setScheduleOpen(data.business?.schedule?.opening || '');
          setScheduleClose(data.business?.schedule?.closing || '');
          setSocials(data.business?.socials || '');

        } catch (err) {
          console.error('❌ Error al cargar comerciante:', err);
          Alert.alert('Error', err.response?.data?.message || 'No se pudo cargar el perfil');
        }
      };

      fetchMerchant();
    }, [])
  );

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('user');
      navigation.reset({ index: 0, routes: [{ name: 'UserType' }] });
    } catch (err) {
      console.error('❌ Error al cerrar sesión:', err);
    }
  };

  const openSocialLink = () => {
    if (!socials) return;
    let url = socials.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    Linking.openURL(url).catch(err =>
      Alert.alert('Error', 'No se pudo abrir el enlace')
    );
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
            onPress={() => navigation.navigate('EditMerchantProfile')}
          >
            <Icon name="pencil" size={14} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.name}>{name}</Text>
        {phone ? <Text style={styles.contact}>{phone}</Text> : null}
        <Text style={styles.contact}>{email}</Text>
        {address ? <Text style={styles.contact}>📍 {address}</Text> : null}
        {(scheduleOpen || scheduleClose) && (
          <Text style={styles.contact}>
            🕒 {scheduleOpen} - {scheduleClose}
          </Text>
        )}
        {socials ? (
          <TouchableOpacity onPress={openSocialLink}>
            <Text style={[styles.contact, styles.link]}>🔗 {socials}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.sectionList}>
        <TouchableOpacity 
          style={styles.listItem}
          onPress={() => navigation.navigate('MerchantLocation')}
        >
          <View style={styles.listItemContent}>
            <Icon name="location" size={20} color="#FF6B6B" style={styles.listIcon} />
            <Text style={styles.listText}>Ubicación del Negocio</Text>
          </View>
          <Icon name="chevron-forward" size={16} color="#555" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.listItem}>
          <View style={styles.listItemContent}>
            <Icon name="help-circle" size={20} color="#666" style={styles.listIcon} />
            <Text style={styles.listText}>Ayuda</Text>
          </View>
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
    textAlign: 'center',
    marginTop: 2,
  },
  link: {
    color: '#3366BB',
    textDecorationLine: 'underline',
  },
  sectionList: {
    marginTop: 10,
    gap: 10,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listIcon: {
    marginRight: 12,
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

export default ProfileMerchantScreen;
