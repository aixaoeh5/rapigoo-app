import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { createOrUpdateService } from '../api/serviceApi';
import LazyImage from './shared/LazyImage';

const AddServiceScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const statusBarHeight = getStatusBarHeight();

  const editing = !!route.params?.service;

  const [image, setImage] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (editing) {
      const { service } = route.params;
      setImage(service.image);
      setTitle(service.title);
      setPrice(service.price.toString());
      setCategory(service.category);
      setDescription(service.description);
    }
  }, [route.params]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!image || !title || !price || !category || !description) {
      return Alert.alert('Campos incompletos', 'Todos los campos son obligatorios.');
    }

    // Validación: solo números y punto decimal (no letras ni símbolos)
    const priceRegex = /^[0-9]+(\.[0-9]{1,2})?$/;
    if (!priceRegex.test(price)) {
      return Alert.alert('Precio inválido', 'El precio no debe contener letras ni símbolos.');
    }

    try {
      await createOrUpdateService({
        id: editing ? route.params.service._id : undefined,
        image,
        title,
        price: parseFloat(price),
        category,
        description,
      });

      Alert.alert('Éxito', editing ? 'Servicio actualizado' : 'Servicio creado');
      navigation.goBack();
    } catch (error) {
      let msg = error.message;

      if (msg.includes('"description"') && msg.includes('length')) {
        msg = 'La descripción debe tener al menos 10 caracteres.';
      } else if (msg.includes('"title"') && msg.includes('empty')) {
        msg = 'El título no puede estar vacío.';
      } else if (msg.includes('"price"') && msg.includes('must be a number')) {
        msg = 'El precio debe ser un número válido.';
      } else if (msg.includes('"image"') && msg.includes('required')) {
        msg = 'Debes seleccionar una imagen para el servicio.';
      }

      Alert.alert('Error', msg || 'No se pudo guardar el servicio');
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: statusBarHeight + 10 }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Icon name="chevron-back" size={26} color="black" />
      </TouchableOpacity>

      <Text style={styles.title}>
        {editing ? 'Editar Servicio' : 'Agregar Servicio'}
      </Text>

      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {image ? (
          <LazyImage 
            source={{ uri: image }} 
            style={styles.image}
            resizeMode="cover"
            showLoader={true}
            fadeDuration={200}
          />
        ) : (
          <Text style={styles.imagePlaceholder}>Seleccionar imagen</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Título</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Corte de cabello"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Precio (DOP)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 15.00"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
      />

      <Text style={styles.label}>Categoría</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Peluquería"
        value={category}
        onChangeText={setCategory}
      />

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Describe tu servicio"
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
      />

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Guardar servicio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 75,
    left: 10,
    padding: 10,
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 50,
    marginBottom: 20,
    alignSelf: 'center',
  },
  imagePicker: {
    backgroundColor: '#f0f0f0',
    height: 180,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    color: '#888',
  },
  label: {
    marginBottom: 5,
    marginLeft: 10,
    fontSize: 14,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  textArea: {
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: 'black',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AddServiceScreen;
