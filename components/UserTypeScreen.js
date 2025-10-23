import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

export default function UserTypeScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
<TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Welcome')}>
  <Icon name="chevron-back" size={26} color="black" />
</TouchableOpacity>

      <Text style={styles.logo}>
        RAPI
        <Text style={styles.logoRed}>GOO</Text>
      </Text>

      <View style={styles.content}>
        <Text style={styles.title}>Por favor, seleccioná tu tipo de usuario.</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('LoginComerciante')}
        >
          <Text style={styles.buttonText}>Comerciante</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Consumidor</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('LoginDelivery')}
        >
          <Text style={styles.buttonText}>Delivery</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dotsContainer}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.activeDot]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 60, 
    alignItems: 'center',
    justifyContent: 'space-between', 
  },

  backButton: {
    position: 'absolute',
    top: 58,
    left: 20,
    zIndex: 10,
    padding: 10,
  },

  logo: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  logoRed: {
    color: '#E60023',
  },

  content: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },

  button: {
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },

  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 30,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D9D9D9',
  },
  activeDot: {
    backgroundColor: 'black',
  },
});
