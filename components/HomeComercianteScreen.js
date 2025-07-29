import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HomeComercianteScreen = () => {
  const navigation = useNavigation();
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      try {
        const res = await fetch('http://10.0.2.2:5000/api/auth/user', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const text = await res.text();
        const data = JSON.parse(text);

        if (res.ok) {
          setBusinessName(data.business?.businessName || 'Nombre del Negocio');
        } else {
          console.log('Error al obtener nombre del negocio:', data.message);
        }
      } catch (error) {
        console.error('❌ Error de conexión:', error);
      }
    };

    fetchUser();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.welcomeText}>¡Bienvenido!</Text>
      <Text style={styles.businessName}>{businessName}</Text>

      <View style={styles.activityCard}>
        <Text style={styles.activityText}>
          La actividad de tu negocio se mostrará aquí.
        </Text>
      </View>

      <View style={styles.walletCard}>
        <Text style={styles.walletTitle}>Total acumulado</Text>
        <Text style={styles.walletActivityText}>
          La actividad de billetera se mostrará aquí
        </Text>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('HomeComerciante')}
        >
          <Image
            style={styles.bottomBarIcon}
            source={require('../assets/home-icon.png')}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('HistorialPedidos')}
        >
          <Image
            style={styles.bottomBarIcon}
            source={require('../assets/paper-icon.png')}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('Services')}
        >
          <Image
            style={styles.bottomBarIcon}
            source={require('../assets/box-icon.png')}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarItem}
          onPress={() => navigation.navigate('ProfileMerchant')}
        >
          <Image
            style={styles.bottomBarIcon}
            source={require('../assets/user.png')}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 50,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  businessName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  activityCard: {
    width: '90%',
    height: 300,
    backgroundColor: '#333',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  activityText: {
    color: 'white',
    textAlign: 'center',
  },
  walletCard: {
    width: '90%',
    height: 200,
    backgroundColor: '#333',
    borderRadius: 20,
    padding: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  walletTitle: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    top: 10,
  },
  walletActivityText: {
    color: 'white',
    textAlign: 'center',
    top: 70,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    paddingHorizontal: 10,
  },
  bottomBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#292929',
  },
  bottomBarIcon: {
    width: 24,
    height: 24,
    tintColor: '#A0A0A0',
  },
});

export default HomeComercianteScreen;
