import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const HistorialPedidosScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Historial de pedidos</Text>
      <View style={styles.card}>
        <Text style={styles.emptyText}>El historial de tus pedidos está vacío</Text>
      </View>

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <Text style={styles.dotGreen}>●</Text>
          <Text style={styles.legendText}>Completado</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.dotYellow}>●</Text>
          <Text style={styles.legendText}>Pendiente</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.dotRed}>●</Text>
          <Text style={styles.legendText}>Cancelado</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  backText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: 'black',
    top: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 50,
    marginBottom: 20,
    top: 30,
  },
  card: {
    width: '90%',
    height: 450,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 2, height: 2 },
    top: 50,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '90%',
    marginTop: 20,
    padding: 10,
    backgroundColor: '#333',
    borderRadius: 20,
    top: 70,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotGreen: {
    fontSize: 16,
    color: 'green',
    marginRight: 5,
  },
  dotYellow: {
    fontSize: 16,
    color: 'yellow',
    marginRight: 5,
  },
  dotRed: {
    fontSize: 16,
    color: 'red',
    marginRight: 5,
  },
  legendText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
});

export default HistorialPedidosScreen;


