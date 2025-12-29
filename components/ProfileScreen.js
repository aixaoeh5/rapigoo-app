import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/apiClient';
import { useTheme } from './context/ThemeContext';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { theme, isDarkMode, toggleTheme } = useTheme();
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
        const res = await apiClient.get('/auth/user');

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
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('user');
      navigation.reset({ index: 0, routes: [{ name: 'UserType' }] });
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
      color: theme.colors.text,
    },
    contact: {
      fontSize: 14,
      color: theme.colors.textSecondary,
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
      borderColor: theme.colors.border,
    },
    listText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    bottomSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
    },
    bottomText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    language: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    logoutButton: {
      marginTop: 30,
      backgroundColor: theme.colors.error,
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: statusBarHeight + 10, paddingBottom: 40 },
      ]}
    >
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color={theme.colors.text} />
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
        <TouchableOpacity 
          style={styles.listItem}
          onPress={() => navigation.navigate('ClientLocationSetup', { isEditing: true })}
        >
          <Text style={styles.listText}>Mi ubicación de entrega</Text>
          <Icon name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.listItem}
          onPress={() => navigation.navigate('PaymentMethods')}
        >
          <Text style={styles.listText}>Métodos de pago</Text>
          <Icon name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.listItem}
          onPress={() => navigation.navigate('Security')}
        >
          <Text style={styles.listText}>Seguridad</Text>
          <Icon name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.listItem}
          onPress={() => navigation.navigate('Help')}
        >
          <Text style={styles.listText}>Ayuda</Text>
          <Icon name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.bottomSection}>
          <Text style={styles.bottomText}>Lenguaje</Text>
          <Text style={styles.language}>Spanish ▾</Text>
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.bottomText}>Modo oscuro</Text>
          <Switch
            value={isDarkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: theme.colors.disabled, true: theme.colors.primary }}
            thumbColor={isDarkMode ? theme.colors.surface : theme.colors.background}
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default ProfileScreen;


