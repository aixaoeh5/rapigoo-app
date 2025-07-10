import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Image, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Importamos Picker
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AddServiceScreen = ({ route, navigation }) => {
    const serviceToEdit = route.params?.service || null;

    const [image, setImage] = useState(serviceToEdit?.image || '');
    const [title, setTitle] = useState(serviceToEdit?.title || '');
    const [price, setPrice] = useState(serviceToEdit?.price || '');
    const [category, setCategory] = useState(serviceToEdit?.category || 'Restaurante'); // Categoría por defecto
    const [description, setDescription] = useState(serviceToEdit?.description || '');

    useEffect(() => {
        if (serviceToEdit) {
            setImage(serviceToEdit.image);
            setTitle(serviceToEdit.title);
            setPrice(serviceToEdit.price);
            setCategory(serviceToEdit.category);
            setDescription(serviceToEdit.description);
        }
    }, [serviceToEdit]);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const saveService = async () => {
        if (!title || !price || !category || !description || !image) {
            Alert.alert('Error', 'Por favor, completa todos los campos.');
            return;
        }

        try {
            const storedServices = await AsyncStorage.getItem('services');
            let servicesArray = storedServices ? JSON.parse(storedServices) : [];

            if (serviceToEdit) {
                
                const index = servicesArray.findIndex(s => s.id === serviceToEdit.id);
                if (index !== -1) {
                    servicesArray[index] = { ...servicesArray[index], image, title, price, category, description };
                }
            } else {
                
                servicesArray.push({ id: Date.now(), image, title, price, category, description });
            }

            await AsyncStorage.setItem('services', JSON.stringify(servicesArray));
            navigation.goBack();
        } catch (error) {
            console.error('Error al guardar el servicio:', error);
        }
    };

    return (
        <View style={styles.container}>
            {}
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>{'<'}</Text>
            </TouchableOpacity>

            <Text style={styles.header}>{serviceToEdit ? 'Editar servicio' : 'Agregar nuevo servicio'}</Text>

            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {image ? <Image source={{ uri: image }} style={styles.imagePreview} /> : <Text>+ Agregar foto</Text>}
            </TouchableOpacity>

            <TextInput style={styles.input} placeholder="Título del servicio" value={title} onChangeText={setTitle} />
            <TextInput style={styles.input} placeholder="Precio" keyboardType="numeric" value={price} onChangeText={setPrice} />

            {}
            <Picker
                selectedValue={category}
                onValueChange={(itemValue) => setCategory(itemValue)}
                style={styles.picker}
            >
                <Picker.Item label="Restaurante" value="Restaurante" />
                <Picker.Item label="Postres" value="Postres" />
                <Picker.Item label="Masajes" value="Masajes" />
                <Picker.Item label="Limpieza" value="Limpieza" />
                <Picker.Item label="Farmacia" value="Farmacia" />
                <Picker.Item label="Belleza" value="Belleza" />
            </Picker>

            <TextInput style={styles.input} placeholder="Descripción" value={description} onChangeText={setDescription} multiline />

            <TouchableOpacity style={styles.saveButton} onPress={saveService}>
                <Text style={styles.saveButtonText}>{serviceToEdit ? 'Actualizar servicio' : 'Guardar servicio'}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    backButton: { position: 'absolute', top: 30, left: 20, zIndex: 10 },
    backButtonText: { fontSize: 24, fontWeight: 'bold' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, top: 10, textAlign: 'center' },
    imagePicker: { width: '100%', height: 150, backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center', borderRadius: 10, marginBottom: 20 },
    imagePreview: { width: '100%', height: '100%', borderRadius: 10 },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 10, fontSize: 16, marginBottom: 15 },
    picker: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, marginBottom: 15, backgroundColor: '#f5f5f5' },
    saveButton: { backgroundColor: '#000', padding: 15, borderRadius: 10, alignItems: 'center' },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default AddServiceScreen;


