import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function WelcomeScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>
        RAPI
        <Text style={styles.logoRed}>GOO</Text>
      </Text>

      <View style={styles.content}>
        <Image
          source={require('../assets/illustration.png')} 
          style={styles.image}
          resizeMode="contain"
        />

        <Text style={styles.title}>Tu pedido, donde lo necesitas.</Text>
        <Text style={styles.subtitle}>A un clic de distancia.</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('UserType')}
        >
          <Text style={styles.buttonText}>Empezar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dots}>
        <View style={[styles.dot, styles.activeDot]} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60, 
    paddingBottom: 30, 
  },

  logo: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  logoRed: {
    color: '#E60023',
  },

  content: {
    alignItems: 'center',
  },

  image: {
    width: 250,
    height: 250,
    marginVertical: 20,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },

  button: {
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    width: 320, 
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ddd',
  },
  activeDot: {
    backgroundColor: '#000',
  },
});
