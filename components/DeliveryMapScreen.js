import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';  
import * as Location from 'expo-location';  
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../api/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DeliveryMapScreen = () => {
    const navigation = useNavigation();
    const [location, setLocation] = useState(null);
    const [isAvailable, setIsAvailable] = useState(true);
    const [availableOrders, setAvailableOrders] = useState([]);
    const [activeDeliveries, setActiveDeliveries] = useState([]);
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [userData, setUserData] = useState(null);
    const [showMenuModal, setShowMenuModal] = useState(false);

    const dotAnimation1 = new Animated.Value(0);
    const dotAnimation2 = new Animated.Value(0);
    const dotAnimation3 = new Animated.Value(0);

    const loadUserData = async () => {
        try {
            const storedUserData = await AsyncStorage.getItem('userData');
            if (storedUserData) {
                const user = JSON.parse(storedUserData);
                setUserData(user);
                console.log('🚚 Usuario delivery cargado:', user.name);
                
                // Cargar pedidos activos
                loadActiveDeliveries();
                loadAvailableOrders();
            }
        } catch (error) {
            console.error('❌ Error cargando datos del usuario:', error);
        }
    };

    const loadActiveDeliveries = async () => {
        try {
            const response = await apiClient.get('/delivery/active');
            if (response.data.success) {
                const deliveries = response.data.data.deliveries;
                setActiveDeliveries(deliveries);
                console.log('🚚 Deliveries activos:', deliveries.length);
                
                // Si hay una entrega activa y está en un estado que requiere navegación, navegar automáticamente
                if (deliveries.length > 0) {
                    const activeDelivery = deliveries[0];
                    const navigationStates = ['assigned', 'heading_to_pickup', 'picked_up', 'heading_to_delivery'];
                    
                    if (navigationStates.includes(activeDelivery.status)) {
                        console.log('🎯 Navegando automáticamente a entrega activa:', activeDelivery.status);
                        setTimeout(() => {
                            navigation.navigate('DeliveryNavigation', { 
                                deliveryTracking: activeDelivery 
                            });
                        }, 1000); // Pequeño delay para mostrar la información primero
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error cargando deliveries activos:', error);
        }
    };

    const loadAvailableOrders = async () => {
        try {
            // Intentar obtener pedidos listos desde el endpoint de delivery
            console.log('🚚 Cargando pedidos disponibles para delivery...');
            
            // Primero intentamos obtener todos los pedidos ready sin delivery asignado
            const response = await apiClient.get('/orders/available-for-delivery');
            
            if (response.data.success) {
                setAvailableOrders(response.data.orders);
                console.log('🚚 Pedidos disponibles para delivery:', response.data.orders.length);
            }
        } catch (error) {
            console.error('❌ Error cargando pedidos disponibles:', error);
            console.error('❌ Status:', error.response?.status);
            console.error('❌ Data:', error.response?.data);
            
            // Si no existe ese endpoint, vamos a usar otro enfoque
            try {
                console.log('🚚 Intentando obtener pedidos desde endpoint general...');
                // Simulamos pedidos disponibles por ahora
                setAvailableOrders([]);
            } catch (fallbackError) {
                console.error('❌ Error en fallback:', fallbackError);
                setAvailableOrders([]);
            }
        }
    };

    const getLocationPermission = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permisos requeridos', 'Necesitamos acceso a tu ubicación para mostrar pedidos cercanos');
                return;
            }
            let userLocation = await Location.getCurrentPositionAsync({});
            setLocation(userLocation.coords);
        } catch (error) {
            console.error('❌ Error obteniendo ubicación:', error);
        }
    };

    const handleTakeOrder = async (orderId) => {
        if (!userData) return;
        
        setLoading(true);
        try {
            console.log('🚚 Tomando pedido:', orderId);
            
            const response = await apiClient.post('/delivery/assign', {
                orderId: orderId,
                deliveryPersonId: userData.id
            });

            if (response.data.success) {
                Alert.alert('¡Éxito!', 'Pedido asignado correctamente');
                setShowOrdersModal(false);
                loadActiveDeliveries();
                loadAvailableOrders();
            } else {
                Alert.alert('Error', response.data.error?.message || 'No se pudo tomar el pedido');
            }
        } catch (error) {
            console.error('❌ Error tomando pedido:', error);
            let errorMessage = 'Error al tomar el pedido';
            
            if (error.response?.status === 403) {
                errorMessage = 'No tienes permisos para tomar este pedido';
            } else if (error.response?.status === 400) {
                errorMessage = error.response.data?.error?.message || 'Pedido no válido';
            }
            
            Alert.alert('Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            Alert.alert(
                'Cerrar Sesión',
                '¿Estás seguro de que quieres cerrar sesión?',
                [
                    {
                        text: 'Cancelar',
                        style: 'cancel'
                    },
                    {
                        text: 'Cerrar Sesión',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                // Limpiar datos del AsyncStorage
                                await AsyncStorage.multiRemove(['userToken', 'userData', 'token']);
                                
                                console.log('🚪 Sesión cerrada, navegando a Welcome');
                                
                                // Resetear navegación para volver al inicio
                                navigation.reset({
                                    index: 0,
                                    routes: [{ name: 'Welcome' }],
                                });
                            } catch (error) {
                                console.error('❌ Error cerrando sesión:', error);
                                Alert.alert('Error', 'Hubo un problema cerrando la sesión');
                            }
                        }
                    }
                ]
            );
        } catch (error) {
            console.error('❌ Error en logout:', error);
        }
    };

    useEffect(() => {
        loadUserData();
        getLocationPermission();
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
                onPress={() => setShowMenuModal(true)} 
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
                {activeDeliveries.length > 0 ? (
                    <View>
                        <Text style={styles.activeDeliveryText}>Tienes {activeDeliveries.length} entrega(s) activa(s)</Text>
                        <TouchableOpacity 
                            style={styles.viewDeliveriesButton}
                            onPress={() => {
                                if (activeDeliveries.length > 0) {
                                    navigation.navigate('DeliveryNavigation', { 
                                        deliveryTracking: activeDeliveries[0] 
                                    });
                                }
                            }}
                        >
                            <Text style={styles.viewDeliveriesButtonText}>Continuar Entrega</Text>
                        </TouchableOpacity>
                    </View>
                ) : availableOrders.length > 0 ? (
                    <View>
                        <Text style={styles.searchingText}>{availableOrders.length} pedidos disponibles</Text>
                        <TouchableOpacity 
                            style={styles.viewOrdersButton}
                            onPress={() => setShowOrdersModal(true)}
                        >
                            <Text style={styles.viewOrdersButtonText}>Ver Pedidos</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View>
                        <Text style={styles.searchingText}>Buscando pedidos...</Text>
                        <View style={styles.dotsContainer}>
                            <Animated.Text style={[styles.dot, { opacity: dotAnimation1 }]}>.</Animated.Text>
                            <Animated.Text style={[styles.dot, { opacity: dotAnimation2 }]}>.</Animated.Text>
                            <Animated.Text style={[styles.dot, { opacity: dotAnimation3 }]}>.</Animated.Text>
                        </View>
                        <Text style={styles.waitingText}>Por favor, espere</Text>
                        <TouchableOpacity 
                            style={styles.refreshButton}
                            onPress={() => {
                                loadAvailableOrders();
                                loadActiveDeliveries();
                            }}
                        >
                            <Text style={styles.refreshButtonText}>🔄 Actualizar</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Modal del menú de usuario */}
            <Modal
                visible={showMenuModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowMenuModal(false)}
            >
                <TouchableOpacity 
                    style={styles.menuModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenuModal(false)}
                >
                    <View style={styles.menuModalContent}>
                        <View style={styles.userInfoSection}>
                            <Ionicons name="person-circle" size={40} color="#4CAF50" />
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>{userData?.name || 'Delivery Person'}</Text>
                                <Text style={styles.userEmail}>{userData?.email || ''}</Text>
                            </View>
                        </View>
                        
                        <View style={styles.menuOptions}>
                            <TouchableOpacity 
                                style={styles.menuOption}
                                onPress={() => {
                                    setShowMenuModal(false);
                                    navigation.navigate('Profile');
                                }}
                            >
                                <Ionicons name="person-outline" size={20} color="#333" />
                                <Text style={styles.menuOptionText}>Mi Perfil</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={styles.menuOption}
                                onPress={() => {
                                    setShowMenuModal(false);
                                    navigation.navigate('Settings');
                                }}
                            >
                                <Ionicons name="settings-outline" size={20} color="#333" />
                                <Text style={styles.menuOptionText}>Configuración</Text>
                            </TouchableOpacity>
                            
                            <View style={styles.menuDivider} />
                            
                            <TouchableOpacity 
                                style={[styles.menuOption, styles.logoutOption]}
                                onPress={() => {
                                    setShowMenuModal(false);
                                    handleLogout();
                                }}
                            >
                                <Ionicons name="exit-outline" size={20} color="#FF4444" />
                                <Text style={[styles.menuOptionText, styles.logoutText]}>Cerrar Sesión</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Modal para mostrar pedidos disponibles */}
            <Modal
                visible={showOrdersModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowOrdersModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Pedidos Disponibles</Text>
                            <TouchableOpacity onPress={() => setShowOrdersModal(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={availableOrders}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <View style={styles.orderItem}>
                                    <View style={styles.orderHeader}>
                                        <Text style={styles.orderNumber}>#{item.orderNumber}</Text>
                                        <Text style={styles.orderTotal}>${(item.total || 0).toFixed(2)}</Text>
                                    </View>
                                    <Text style={styles.customerName}>
                                        👤 {item.customerInfo?.name || 'Cliente'}
                                    </Text>
                                    <Text style={styles.deliveryAddress} numberOfLines={2}>
                                        📍 {typeof item.deliveryInfo?.address === 'string' 
                                            ? item.deliveryInfo.address 
                                            : item.deliveryInfo?.address?.street 
                                                ? `${item.deliveryInfo.address.street}, ${item.deliveryInfo.address.city}` 
                                                : 'Dirección no disponible'}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.takeOrderButton}
                                        onPress={() => handleTakeOrder(item._id)}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color="white" />
                                        ) : (
                                            <Text style={styles.takeOrderButtonText}>Tomar Pedido</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No hay pedidos disponibles</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>
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
    activeDeliveryText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#4CAF50',
        textAlign: 'center',
        marginBottom: 10,
    },
    viewDeliveriesButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    viewDeliveriesButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    viewOrdersButton: {
        backgroundColor: '#FF6B6B',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
    },
    viewOrdersButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    refreshButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    refreshButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    orderItem: {
        backgroundColor: '#f8f9fa',
        margin: 10,
        padding: 15,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderNumber: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    orderTotal: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF6B6B',
    },
    customerName: {
        fontSize: 14,
        color: '#333',
        marginBottom: 4,
    },
    deliveryAddress: {
        fontSize: 14,
        color: '#666',
        marginBottom: 12,
    },
    takeOrderButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    takeOrderButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    // Estilos del modal del menú
    menuModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        paddingTop: 100,
        paddingLeft: 20,
    },
    menuModalContent: {
        backgroundColor: 'white',
        borderRadius: 12,
        width: 280,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    userInfoSection: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
    },
    userInfo: {
        marginLeft: 12,
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    menuOptions: {
        paddingVertical: 8,
    },
    menuOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuOptionText: {
        fontSize: 16,
        color: '#333',
        marginLeft: 12,
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#e9ecef',
        marginVertical: 8,
        marginHorizontal: 16,
    },
    logoutOption: {
        marginTop: 4,
    },
    logoutText: {
        color: '#FF4444',
        fontWeight: '500',
    },
});

export default DeliveryMapScreen;








