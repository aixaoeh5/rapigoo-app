import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons'; 
const BusinessFormStep2Screen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { businessName, rnc, category, address } = route.params;

  const [openingHours, setOpeningHours] = useState('');
  const [closingHours, setClosingHours] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!openingHours || !closingHours || !description) {
      Alert.alert('Campos obligatorios', 'Por favor completa todos los campos.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');

      const response = await axios.post('http://192.168.100.192:5000/api/merchant/profile', {
        businessName,
        rnc,
        category,
        address,
        openHour: openingHours,  
        closeHour: closingHours,  
        description,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      Alert.alert('✅ Enviado', 'Tu perfil de negocio está pendiente de aprobación.');
      navigation.reset({
        index: 0,
        routes: [{ name: 'MerchantPendingApproval' }],
      });
    } catch (error) {
      console.error('❌ Error al guardar el negocio:', error.response?.data?.message || error.message);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo guardar el perfil de negocio');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <Text style={styles.title}>Datos del Negocio (2 de 2)</Text>

      <Text style={styles.label}>Horario de apertura</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 08:00"
        value={openingHours}
        onChangeText={setOpeningHours}
      />

      <Text style={styles.label}>Horario de cierre</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 22:00"
        value={closingHours}
        onChangeText={setClosingHours}
      />

      <Text style={styles.label}>Descripción breve del negocio</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        placeholder="Describe brevemente qué ofreces..."
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Enviar formulario</Text>
      </TouchableOpacity>
    </View>
  );
};

export default BusinessFormStep2Screen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 10,
    zIndex: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
    textAlign: 'center',
  },
  label: {
    marginBottom: 5,
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },
  button: {
    backgroundColor: 'black',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
