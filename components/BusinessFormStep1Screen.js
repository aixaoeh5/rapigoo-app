import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

const BusinessFormStep1Screen = ({ route }) => {
  const navigation = useNavigation();

  const [businessName, setBusinessName] = useState('');
  const [rnc, setRnc] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');

  const handleContinue = () => {
    if (!businessName || !rnc || !category || !address) {
      Alert.alert('Campos obligatorios', 'Por favor, completa todos los campos.');
      return;
    }

    navigation.navigate('BusinessFormStep2', {
      businessName,
      rnc,
      category,
      address,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Datos del Negocio (1 de 2)</Text>

      <Text style={styles.label}>Nombre del negocio</Text>
      <TextInput
        style={styles.input}
        value={businessName}
        onChangeText={setBusinessName}
        placeholder="Ej: Colmado La Esquina"
      />

      <Text style={styles.label}>RNC o Cédula</Text>
      <TextInput
        style={styles.input}
        value={rnc}
        onChangeText={setRnc}
        placeholder="Ej: 123456789"
        keyboardType="numeric"
      />

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={category}
          onValueChange={(value) => setCategory(value)}
        >
  <Picker.Item label="Seleccione una categoría" value="" />
  <Picker.Item label="Colmado" value="Colmado" />
  <Picker.Item label="Farmacia" value="Farmacia" />
  <Picker.Item label="Belleza" value="Belleza" />
  <Picker.Item label="Restaurantes" value="Restaurantes" />
  <Picker.Item label="Pizzería" value="Pizzería" />
  <Picker.Item label="Comedores" value="Comedores" />
  <Picker.Item label="Comida rápida" value="Comida rápida" />
  <Picker.Item label="Postres" value="Postres" />
  <Picker.Item label="Panadería" value="Panadería" />
  <Picker.Item label="Heladería" value="Heladería" />
  <Picker.Item label="Ferretería" value="Ferretería" />
        </Picker>
      </View>

      <Text style={styles.label}>Dirección del local</Text>
      <TextInput
        style={styles.input}
        value={address}
        onChangeText={setAddress}
        placeholder="Ej: Calle 123, Zona Colonial"
      />

      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
};

export default BusinessFormStep1Screen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
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
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
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
