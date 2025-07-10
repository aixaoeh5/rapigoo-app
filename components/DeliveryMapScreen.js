import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import MapView, { Marker } from 'react-native-maps';  
import * as Location from 'expo-location';  
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';  // Importa useNavigation

const DeliveryMapScreen = () => {
    const navigation = useNavigation();  // Instancia de navegación
    const [location, setLocation] = useState(null);
    const [isAvailable, setIsAvailable] = useState(true);

    const dotAnimation1 = new Animated.Value(0);
    const dotAnimation2 = new Animated.Value(0);
    const dotAnimation3 = new Animated.Value(0);

    useEffect(() => {
        const animateDots = () => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(dotAnimation1, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(dotAnimation1, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(dotAnimation2, {
                        toValue: 1,
                        duration: 500,
                        delay: 200, 
                        useNativeDriver: true,
                    }),
                    Animated.timing(dotAnimation2, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(dotAnimation3, {
                        toValue: 1,
                        duration: 500,
                        delay: 400, 
                        useNativeDriver: true,
                    }),
                    Animated.timing(dotAnimation3, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        };

        animateDots();

        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permiso de ubicación denegado');
                return;
            }
            let userLocation = await Location.getCurrentPositionAsync({});
            setLocation(userLocation.coords);
        })();
    }, []);

    return (
        <View style={styles.container}>
            {location ? (
                <MapView
                    style={styles.map}
                    initialRegion={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                    }}
                    showsUserLocation
                >
                    <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
                </MapView>
            ) : (
                <Text style={styles.loadingText}>Cargando ubicación...</Text>
            )}

            <TouchableOpacity 
                style={styles.menuButton}
                onPress={() => navigation.navigate('Settings')} 
            >
                <Ionicons name="menu" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.statusButton} 
                onPress={() => setIsAvailable(!isAvailable)}
            >
                <Text style={styles.statusText}>{isAvailable ? 'Disponible' : 'No Disponible'}</Text>
            </TouchableOpacity>

            <View style={styles.bottomContainer}>
                <Text style={styles.searchingText}>Buscando pedidos...</Text>
                <View style={styles.dotsContainer}>
                    <Animated.Text style={[styles.dot, { opacity: dotAnimation1 }]}>.</Animated.Text>
                    <Animated.Text style={[styles.dot, { opacity: dotAnimation2 }]}>.</Animated.Text>
                    <Animated.Text style={[styles.dot, { opacity: dotAnimation3 }]}>.</Animated.Text>
                </View>
                <Text style={styles.waitingText}>Por favor, espere</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1, 
    },
    menuButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: 'black',
        padding: 10,
        borderRadius: 50,
    },
    statusButton: {
        position: 'absolute',
        top: 50,
        alignSelf: 'center',
        backgroundColor: 'black',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    statusText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    bottomContainer: {
        backgroundColor: 'white',
        padding: 20,
        position: 'absolute',
        bottom: 0,
        width: '100%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        alignItems: 'center',
    },
    searchingText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 10,
    },
    dot: {
        fontSize: 30,
        marginHorizontal: 5,
        color: 'gray',
    },
    waitingText: {
        color: 'gray',
    },
    loadingText: {
        fontSize: 18,
        textAlign: 'center',
        marginTop: 370,
    },
});

export default DeliveryMapScreen;








