import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Modal, FlatList, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

// FIX: Importar componentes optimizados
import RapigooClusteredMap from './ClusteredMapView';
import OptimizedMapMarker from './OptimizedMapMarker';
import { useMapRegionDebounce, useMapLoopPrevention } from '../hooks/useMapRegionDebounce';
import mapPerformanceMonitor from '../utils/MapPerformanceMonitor';
import { apiClient } from '../api/apiClient';
import { CoordinateValidator } from '../utils/coordinateValidator';

const DeliveryMapScreenOptimized = () => {
    const navigation = useNavigation();
    const [location, setLocation] = useState(null);
    const [isAvailable, setIsAvailable] = useState(true);
    const [availableOrders, setAvailableOrders] = useState([]);
    const [activeDeliveries, setActiveDeliveries] = useState([]);
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [userData, setUserData] = useState(null);
    const [showMenuModal, setShowMenuModal] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [locationError, setLocationError] = useState(null);
    
    // FIX: Referencias optimizadas
    const dotAnimation1 = useRef(new Animated.Value(0)).current;
    const dotAnimation2 = useRef(new Animated.Value(0)).current;
    const dotAnimation3 = useRef(new Animated.Value(0)).current;
    const navigationTimeoutRef = useRef(null);
    const animationRefs = useRef([]);
    const isMountedRef = useRef(true);
    const performanceStopRef = useRef(null);
    
    // FIX: Hook de prevención de bucles
    const { checkAndPreventLoop, cleanup: cleanupLoopPrevention } = useMapLoopPrevention();

    // FIX: Región inicial memoizada
    const initialRegion = useMemo(() => {
        if (location) {
            return {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
            };
        }
        // Coordenadas por defecto (Santo Domingo)
        return {
            latitude: 18.4861,
            longitude: -69.9312,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
        };
    }, [location]);

    // FIX: Iniciar monitoreo de performance
    useEffect(() => {
        mapPerformanceMonitor.startMapLoad();
        
        // FIX: Medir FPS
        performanceStopRef.current = mapPerformanceMonitor.measureFPS(true);
        
        return () => {
            if (performanceStopRef.current) {
                performanceStopRef.current();
            }
            mapPerformanceMonitor.generateSessionReport();
            mapPerformanceMonitor.cleanup();
        };
    }, []);

    // FIX: Cargar datos de usuario optimizado
    const loadUserData = useCallback(async () => {
        try {
            const storedUserData = await AsyncStorage.getItem('userData');
            if (storedUserData && isMountedRef.current) {
                const user = JSON.parse(storedUserData);
                setUserData(user);
                console.log('🚚 Usuario delivery cargado:', user.name);
                
                // Cargar datos en paralelo
                await Promise.all([
                    loadActiveDeliveries(),
                    loadAvailableOrders()
                ]);
            }
        } catch (error) {
            console.error('❌ Error cargando datos del usuario:', error);
            mapPerformanceMonitor.logMapError(error, { context: 'loadUserData' });
        }
    }, []);

    // FIX: Cargar entregas activas con medición
    const loadActiveDeliveries = useCallback(async () => {
        const measureEnd = mapPerformanceMonitor.measureMarkerRender(0);
        
        try {
            const response = await apiClient.get('/delivery/active');
            if (response.data.success && isMountedRef.current) {
                const deliveries = response.data.data.deliveries;
                setActiveDeliveries(deliveries);
                console.log('🚚 Deliveries activos:', deliveries.length);
                
                measureEnd();
                
                // Navegación automática si hay entrega activa
                if (deliveries.length > 0) {
                    const activeDelivery = deliveries[0];
                    const navigationStates = ['assigned', 'heading_to_pickup', 'picked_up', 'heading_to_delivery'];
                    
                    if (navigationStates.includes(activeDelivery.status)) {
                        console.log('🎯 Navegando automáticamente a entrega activa:', activeDelivery.status);
                        navigationTimeoutRef.current = setTimeout(() => {
                            if (isMountedRef.current) {
                                navigation.navigate('DeliveryNavigation', { 
                                    trackingId: activeDelivery._id,
                                    orderId: activeDelivery.orderId?._id || activeDelivery.orderId,
                                    deliveryTracking: activeDelivery 
                                });
                            }
                        }, 1000);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error cargando deliveries activos:', error);
            mapPerformanceMonitor.logMapError(error, { context: 'loadActiveDeliveries' });
        }
    }, [navigation]);

    // FIX: Cargar pedidos disponibles optimizado
    const loadAvailableOrders = useCallback(async () => {
        try {
            console.log('🚚 Cargando pedidos disponibles para delivery...');
            const response = await apiClient.get('/orders/available-for-delivery');
            
            if (response.data.success && isMountedRef.current) {
                setAvailableOrders(response.data.orders);
                console.log('🚚 Pedidos disponibles:', response.data.orders.length);
            }
        } catch (error) {
            console.error('❌ Error cargando pedidos disponibles:', error);
            setAvailableOrders([]);
        }
    }, []);

    // FIX: Obtener permisos de ubicación mejorado
    const getLocationPermission = useCallback(async () => {
        try {
            console.log('📍 Solicitando permisos de ubicación...');
            setLocationError(null);
            
            // FIX: Verificar permisos de foreground
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationError('Permisos de ubicación denegados');
                Alert.alert(
                    'Permisos requeridos', 
                    'RapiGoo necesita acceso a tu ubicación para mostrarte pedidos cercanos y optimizar las rutas de entrega.',
                    [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Ir a Configuración', onPress: () => {
                            if (Platform.OS === 'ios') {
                                Linking.openURL('app-settings:');
                            } else {
                                Linking.openSettings();
                            }
                        }}
                    ]
                );
                return false;
            }
            
            // FIX: Solicitar permisos de background si es necesario
            if (Platform.OS === 'android') {
                const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
                if (backgroundStatus !== 'granted') {
                    console.warn('⚠️ Permisos de ubicación en background no otorgados');
                }
            }
            
            // FIX: Verificar servicios de ubicación
            const locationProviderStatus = await Location.getProviderStatusAsync();
            if (!locationProviderStatus.locationServicesEnabled) {
                setLocationError('GPS deshabilitado');
                Alert.alert(
                    'GPS Deshabilitado',
                    'Por favor habilita el servicio de ubicación en tu dispositivo para usar RapiGoo Delivery',
                    [{ text: 'OK' }]
                );
                return false;
            }
            
            console.log('📍 Obteniendo ubicación actual...');
            
            // FIX: Configuración optimizada para obtener ubicación
            let userLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
                timeout: 15000,
                maximumAge: 60000
            });
            
            // FIX: Validación robusta de coordenadas
            if (userLocation?.coords?.latitude && userLocation?.coords?.longitude) {
                const coords = {
                    latitude: userLocation.coords.latitude,
                    longitude: userLocation.coords.longitude,
                    accuracy: userLocation.coords.accuracy
                };
                
                const validatedCoords = CoordinateValidator.getSafeCoords(coords);
                
                if (validatedCoords && isMountedRef.current) {
                    setLocation(validatedCoords);
                    setLocationError(null);
                    console.log('✅ Ubicación validada:', validatedCoords.latitude, validatedCoords.longitude);
                    
                    // FIX: Finalizar medición de carga del mapa
                    mapPerformanceMonitor.endMapLoad();
                    
                    return true;
                }
            }
            
            throw new Error('Coordenadas inválidas recibidas del GPS');
            
        } catch (error) {
            console.error('❌ Error obteniendo ubicación:', error);
            setLocationError(error.message);
            mapPerformanceMonitor.logMapError(error, { context: 'getLocationPermission' });
            
            // FIX: Usar ubicación por defecto con confirmación
            Alert.alert(
                'Error de Ubicación',
                `No se pudo obtener tu ubicación: ${error.message}`,
                [
                    { text: 'Reintentar', onPress: () => getLocationPermission() },
                    { text: 'Usar ubicación aproximada', onPress: () => {
                        const defaultCoords = CoordinateValidator.getDefaultDRCoords();
                        setLocation(defaultCoords);
                        setLocationError('Usando ubicación aproximada (Santo Domingo)');
                        mapPerformanceMonitor.endMapLoad();
                    }},
                    { text: 'Cancelar', style: 'cancel' }
                ]
            );
            return false;
        }
    }, []);

    // FIX: Manejar cambio de región con debounce
    const handleRegionChangeComplete = useCallback((region, details) => {
        const measureEnd = mapPerformanceMonitor.measureRegionChange();
        
        // FIX: Log de cambio de región
        console.log('📍 Región cambiada:', {
            lat: region.latitude.toFixed(4),
            lng: region.longitude.toFixed(4),
            isGesture: details?.isGesture
        });
        
        measureEnd();
        
        // Aquí puedes cargar markers basados en la nueva región
        // loadMarkersForRegion(region);
    }, []);

    // FIX: Preparar markers para el mapa
    const mapMarkers = useMemo(() => {
        const markers = [];
        
        // Añadir markers de pedidos disponibles
        availableOrders.forEach((order, index) => {
            if (order.merchant?.location?.coordinates) {
                markers.push({
                    id: `order-${order._id}`,
                    coordinate: {
                        latitude: order.merchant.location.coordinates[1],
                        longitude: order.merchant.location.coordinates[0],
                    },
                    title: `Pedido #${order.orderNumber || index + 1}`,
                    description: order.merchant.businessName,
                    pinColor: '#4CAF50',
                    onPress: () => handleTakeOrder(order._id),
                });
            }
        });
        
        // Añadir markers de entregas activas
        activeDeliveries.forEach((delivery) => {
            if (delivery.orderId?.deliveryAddress?.coordinates) {
                markers.push({
                    id: `delivery-${delivery._id}`,
                    coordinate: {
                        latitude: delivery.orderId.deliveryAddress.coordinates[1],
                        longitude: delivery.orderId.deliveryAddress.coordinates[0],
                    },
                    title: 'Entrega Activa',
                    description: delivery.orderId.deliveryAddress.street,
                    pinColor: '#FF6B6B',
                    isActive: true,
                });
            }
        });
        
        // FIX: Medir rendering de markers
        if (markers.length > 0) {
            const measureEnd = mapPerformanceMonitor.measureMarkerRender(markers.length);
            requestAnimationFrame(measureEnd);
        }
        
        return markers;
    }, [availableOrders, activeDeliveries]);

    // FIX: Tomar pedido
    const handleTakeOrder = useCallback(async (orderId) => {
        if (!userData) return;
        
        setLoading(true);
        try {
            console.log('🚚 Tomando pedido:', orderId);
            
            const response = await apiClient.post('/delivery/assign', {
                orderId,
                deliveryPersonId: userData.id
            });
            
            if (response.data.success && isMountedRef.current) {
                Alert.alert('✅ Éxito', 'Pedido asignado correctamente');
                setShowOrdersModal(false);
                
                // Recargar datos
                await Promise.all([
                    loadActiveDeliveries(),
                    loadAvailableOrders()
                ]);
                
                // Navegar a la pantalla de navegación
                if (response.data.trackingId) {
                    navigation.navigate('DeliveryNavigation', {
                        trackingId: response.data.trackingId,
                        orderId
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error tomando pedido:', error);
            Alert.alert('Error', error.response?.data?.message || 'No se pudo tomar el pedido');
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [userData, navigation, loadActiveDeliveries, loadAvailableOrders]);

    // FIX: Animación de disponibilidad
    useEffect(() => {
        if (isAvailable) {
            const animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(dotAnimation1, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(dotAnimation2, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(dotAnimation3, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.parallel([
                        Animated.timing(dotAnimation1, {
                            toValue: 0,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                        Animated.timing(dotAnimation2, {
                            toValue: 0,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                        Animated.timing(dotAnimation3, {
                            toValue: 0,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                    ]),
                ])
            );
            animation.start();
            animationRefs.current.push(animation);
        }
        
        return () => {
            animationRefs.current.forEach(anim => anim?.stop());
        };
    }, [isAvailable, dotAnimation1, dotAnimation2, dotAnimation3]);

    // FIX: Cargar datos al enfocar
    useFocusEffect(
        useCallback(() => {
            getLocationPermission();
            loadUserData();
            
            // FIX: Monitorear memoria periódicamente
            const memoryInterval = setInterval(() => {
                mapPerformanceMonitor.measureMemory();
            }, 30000); // Cada 30 segundos
            
            return () => {
                clearInterval(memoryInterval);
                if (navigationTimeoutRef.current) {
                    clearTimeout(navigationTimeoutRef.current);
                }
                cleanupLoopPrevention();
            };
        }, [getLocationPermission, loadUserData, cleanupLoopPrevention])
    );

    // FIX: Cleanup al desmontar
    useEffect(() => {
        isMountedRef.current = true;
        
        return () => {
            isMountedRef.current = false;
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }
        };
    }, []);

    return (
        <View style={styles.container}>
            {location ? (
                <RapigooClusteredMap
                    initialRegion={initialRegion}
                    markers={mapMarkers}
                    onRegionChangeComplete={handleRegionChangeComplete}
                    clusteringEnabled={true}
                    clusterThreshold={20}
                    style={styles.map}
                />
            ) : (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF6B6B" />
                    <Text style={styles.loadingText}>
                        {locationError || 'Obteniendo ubicación...'}
                    </Text>
                </View>
            )}

            {/* Status Bar */}
            <View style={styles.statusBar}>
                <View style={[
                    styles.statusIndicator,
                    { backgroundColor: isAvailable ? '#4CAF50' : '#757575' }
                ]} />
                <Text style={styles.statusText}>
                    {isAvailable ? 'Disponible' : 'No disponible'}
                </Text>
                {isAvailable && (
                    <View style={styles.animationContainer}>
                        <Animated.View
                            style={[
                                styles.dot,
                                { opacity: dotAnimation1 }
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.dot,
                                { opacity: dotAnimation2 }
                            ]}
                        />
                        <Animated.View
                            style={[
                                styles.dot,
                                { opacity: dotAnimation3 }
                            ]}
                        />
                    </View>
                )}
            </View>

            {/* Botones de acción */}
            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={styles.availabilityButton}
                    onPress={() => setIsAvailable(!isAvailable)}
                >
                    <Ionicons
                        name={isAvailable ? "pause-circle" : "play-circle"}
                        size={50}
                        color={isAvailable ? "#FF6B6B" : "#4CAF50"}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.ordersButton}
                    onPress={() => setShowOrdersModal(true)}
                >
                    <Ionicons name="list-circle" size={50} color="#2196F3" />
                    {availableOrders.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {availableOrders.length}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Modal de pedidos disponibles */}
            <Modal
                visible={showOrdersModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowOrdersModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Pedidos Disponibles ({availableOrders.length})
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowOrdersModal(false)}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={availableOrders}
                            keyExtractor={(item) => item._id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.orderItem}
                                    onPress={() => handleTakeOrder(item._id)}
                                    disabled={loading}
                                >
                                    <View style={styles.orderInfo}>
                                        <Text style={styles.orderNumber}>
                                            Pedido #{item.orderNumber}
                                        </Text>
                                        <Text style={styles.orderMerchant}>
                                            {item.merchant?.businessName}
                                        </Text>
                                        <Text style={styles.orderAddress}>
                                            📍 {item.deliveryAddress?.street}
                                        </Text>
                                        <Text style={styles.orderTotal}>
                                            Total: ${item.total?.toFixed(2)}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={24}
                                        color="#FF6B6B"
                                    />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>
                                    No hay pedidos disponibles en este momento
                                </Text>
                            }
                        />
                    </View>
                </View>
            </Modal>

            {/* Loading overlay */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FF6B6B" />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 16,
        color: '#666',
    },
    statusBar: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        backgroundColor: 'white',
        borderRadius: 25,
        paddingVertical: 10,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    animationContainer: {
        flexDirection: 'row',
        marginLeft: 'auto',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4CAF50',
        marginHorizontal: 2,
    },
    actionButtons: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        gap: 15,
    },
    availabilityButton: {
        backgroundColor: 'white',
        borderRadius: 30,
        padding: 5,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    ordersButton: {
        backgroundColor: 'white',
        borderRadius: 30,
        padding: 5,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    badge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#FF6B6B',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    modalContainer: {
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
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    orderItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    orderInfo: {
        flex: 1,
    },
    orderNumber: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    orderMerchant: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    orderAddress: {
        fontSize: 13,
        color: '#888',
        marginBottom: 2,
    },
    orderTotal: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4CAF50',
    },
    emptyText: {
        textAlign: 'center',
        padding: 40,
        fontSize: 16,
        color: '#666',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default DeliveryMapScreenOptimized;