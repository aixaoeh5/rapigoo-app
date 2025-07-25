import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

const MerchantPendingApprovalScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Verificación</Text>

      <Image
        source={require('../assets/Co-Workers.png')}
        style={styles.image}
        resizeMode="contain"
      />

      <Text style={styles.title}>Tu solicitud está siendo revisada</Text>

      <Text style={styles.description}>
        Pronto uno de nuestros administradores validará tu negocio.{"\n"}
        Te avisaremos por correo electrónico cuando sea aprobado.
      </Text>
    </View>
  );
};

export default MerchantPendingApprovalScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center', 
  },
  header: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 30,
    textAlign: 'center',
  },
  image: {
    width: 250,
    height: 250,
    marginBottom: 30,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: '#555',
    lineHeight: 20,
  },
});
