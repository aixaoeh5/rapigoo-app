import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ServicesScreen = () => {
    const navigation = useNavigation();
    const [services, setServices] = useState([]);

    useEffect(() => {
        const loadServices = async () => {
            const savedServices = await AsyncStorage.getItem('services');
            if (savedServices) {
                setServices(JSON.parse(savedServices));
            }
        };
        loadServices();
    }, []);

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>{'<'}</Text>
            </TouchableOpacity>
            
            <Text style={styles.header}>Tus Servicios</Text>
            
            <TouchableOpacity 
                style={styles.addButton} 
                onPress={() => navigation.navigate('AddService')}
            >
                <Text style={styles.addButtonText}>+ Agregar nuevo servicio</Text>
            </TouchableOpacity>

            <FlatList
                data={services}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={styles.serviceItem} 
                        onPress={() => navigation.navigate('AddService', { service: item })}
                    >
                        <Image source={{ uri: item.image }} style={styles.serviceImage} />
                        <View style={styles.serviceDetails}>
                            <Text style={styles.serviceTitle}>{item.title}</Text>
                            <Text style={styles.serviceDescription}>{item.description}</Text>
                            <Text style={styles.servicePrice}>${item.price}</Text>
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    backButton: { marginBottom: 10, top: 57, left: 20, position: 'absolute' },
    backButtonText: { fontSize: 24, fontWeight: 'bold' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', marginTop: 40 },
    addButton: { backgroundColor: '#000', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    serviceItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#ddd' },
    serviceImage: { width: 60, height: 60, borderRadius: 10, marginRight: 15 },
    serviceDetails: { flex: 1 },
    serviceTitle: { fontSize: 18, fontWeight: 'bold' },
    serviceDescription: { fontSize: 14, color: '#777' },
    servicePrice: { fontSize: 16, fontWeight: 'bold', marginTop: 5 },
});

export default ServicesScreen;
