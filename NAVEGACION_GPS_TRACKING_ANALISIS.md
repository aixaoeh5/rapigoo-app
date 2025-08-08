# Análisis Técnico Profundo: Navegación GPS y Tracking para App de Delivery

## Arquitectura Actual del Proyecto

Basado en el análisis del código existente, Rapigoo ya tiene una base sólida:

### Stack Tecnológico Actual:
- **Frontend**: React Native con Expo
- **Backend**: Node.js + Express + MongoDB + Socket.IO
- **Mapas**: React Native Maps
- **Ubicación**: Expo Location
- **Real-time**: Socket.IO ya implementado

### Infraestructura Existente:
- Modelo `DeliveryTracking` completamente implementado
- Sistema de rutas de delivery funcional
- Socket.IO configurado para comunicación en tiempo real
- Permisos de ubicación básicos implementados

---

## 1. NAVEGACIÓN GPS PARA DELIVERY DRIVERS

### 1.1 Tecnologías y APIs Necesarias

```javascript
// package.json - Dependencias adicionales requeridas
{
  "react-native-maps-directions": "^1.9.0",
  "react-native-geolocation-service": "^5.3.1",
  "react-native-background-job": "^1.0.12",
  "react-native-keep-awake": "^4.0.0",
  "@react-native-mapbox-gl/maps": "^8.6.0" // Alternativa a Google Maps
}
```

#### APIs de Mapas Recomendadas:
1. **Google Maps Platform** (Actual en el proyecto)
   - Directions API
   - Distance Matrix API
   - Places API

2. **Mapbox** (Alternativa más económica)
   - Navigation SDK
   - Directions API
   - Matrix API

### 1.2 Implementación de Navegación Paso a Paso

```javascript
// components/DeliveryNavigationScreen.js
import React, { useState, useEffect, useRef } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { keepAwake, allowSleepAgain } from 'react-native-keep-awake';

const DeliveryNavigationScreen = ({ route }) => {
  const { deliveryTracking } = route.params;
  const mapRef = useRef();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [navigation, setNavigation] = useState({
    currentStep: 0,
    instructions: [],
    remainingDistance: 0,
    remainingTime: 0
  });
  const [isNavigating, setIsNavigating] = useState(false);

  // Configuración de waypoints
  const waypoints = [
    deliveryTracking.pickupLocation.coordinates,
    deliveryTracking.deliveryLocation.coordinates
  ];

  useEffect(() => {
    // Mantener pantalla encendida durante navegación
    keepAwake();
    startLocationTracking();
    
    return () => {
      allowSleepAgain();
      stopLocationTracking();
    };
  }, []);

  const startLocationTracking = async () => {
    // Solicitar permisos de ubicación precisos
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permisos requeridos', 'Necesitamos acceso a tu ubicación para la navegación');
      return;
    }

    // Configurar tracking de alta precisión
    const locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000, // Actualizar cada segundo
        distanceInterval: 5, // O cada 5 metros
      },
      (location) => {
        updateCurrentLocation(location);
      }
    );

    setIsNavigating(true);
  };

  const updateCurrentLocation = async (location) => {
    const newLocation = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading
    };

    setCurrentLocation(newLocation);

    // Actualizar ubicación en el backend
    await updateDeliveryLocation(newLocation);

    // Calcular nueva ruta si hay desviación significativa
    checkRouteDeviation(newLocation);
  };

  const updateDeliveryLocation = async (location) => {
    try {
      await apiClient.put(`/delivery/${deliveryTracking._id}/location`, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading
      });

      // Emitir actualización en tiempo real
      socket.emit('delivery_location_update', {
        orderId: deliveryTracking.orderId,
        location,
        status: deliveryTracking.status
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.latitude || waypoints[0][1],
          longitude: currentLocation?.longitude || waypoints[0][0],
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        followsUserLocation
        showsCompass
        showsTraffic
      >
        {/* Marcadores de pickup y delivery */}
        <Marker
          coordinate={{
            latitude: waypoints[0][1],
            longitude: waypoints[0][0]
          }}
          title="Pickup Location"
          pinColor="blue"
        />
        
        <Marker
          coordinate={{
            latitude: waypoints[1][1],
            longitude: waypoints[1][0]
          }}
          title="Delivery Location"
          pinColor="red"
        />

        {/* Ruta con direcciones */}
        <MapViewDirections
          origin={{
            latitude: currentLocation?.latitude || waypoints[0][1],
            longitude: currentLocation?.longitude || waypoints[0][0]
          }}
          destination={{
            latitude: waypoints[1][1],
            longitude: waypoints[1][0]
          }}
          waypoints={deliveryTracking.status === 'assigned' ? [] : []}
          apikey={GOOGLE_MAPS_API_KEY}
          strokeWidth={6}
          strokeColor="#4285F4"
          optimizeWaypoints={true}
          onReady={(result) => {
            // Ajustar vista del mapa
            mapRef.current.fitToCoordinates(result.coordinates, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }
            });

            // Actualizar información de navegación
            setNavigation(prev => ({
              ...prev,
              remainingDistance: result.distance,
              remainingTime: result.duration
            }));
          }}
          onError={(error) => {
            console.error('Direction API Error:', error);
          }}
        />
      </MapView>

      {/* Panel de navegación */}
      <NavigationPanel
        navigation={navigation}
        currentStatus={deliveryTracking.status}
        onStatusUpdate={handleStatusUpdate}
      />
    </View>
  );
};
```

### 1.3 Manejo de Waypoints y Estados

```javascript
// utils/navigationStates.js
export const DELIVERY_STATES = {
  ASSIGNED: 'assigned',
  HEADING_TO_PICKUP: 'heading_to_pickup',
  AT_PICKUP: 'at_pickup',
  PICKED_UP: 'picked_up',
  HEADING_TO_DELIVERY: 'heading_to_delivery',
  AT_DELIVERY: 'at_delivery',
  DELIVERED: 'delivered'
};

export const getNextWaypoint = (currentStatus, pickupCoords, deliveryCoords) => {
  switch (currentStatus) {
    case DELIVERY_STATES.ASSIGNED:
    case DELIVERY_STATES.HEADING_TO_PICKUP:
      return {
        coordinates: pickupCoords,
        type: 'pickup',
        address: 'Restaurante'
      };
    
    case DELIVERY_STATES.PICKED_UP:
    case DELIVERY_STATES.HEADING_TO_DELIVERY:
      return {
        coordinates: deliveryCoords,
        type: 'delivery',
        address: 'Cliente'
      };
    
    default:
      return null;
  }
};

// Detección automática de llegada
export const checkArrival = (currentLocation, targetLocation, threshold = 50) => {
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    targetLocation[1], // latitude
    targetLocation[0]  // longitude
  );
  
  return distance <= threshold; // 50 metros por defecto
};
```

---

## 2. TRACKING EN TIEMPO REAL PARA CLIENTES

### 2.1 Componente de Tracking para Cliente

```javascript
// components/OrderTrackingScreen.js
import React, { useState, useEffect } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { io } from 'socket.io-client';

const OrderTrackingScreen = ({ route }) => {
  const { orderId } = route.params;
  const [deliveryTracking, setDeliveryTracking] = useState(null);
  const [deliveryLocation, setDeliveryLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Conectar a WebSocket
    const socketConnection = io(API_BASE_URL, {
      auth: {
        token: await AsyncStorage.getItem('authToken')
      }
    });

    setSocket(socketConnection);

    // Unirse al tracking del pedido
    socketConnection.emit('join_delivery_tracking', { orderId });

    // Escuchar actualizaciones de ubicación
    socketConnection.on('delivery_location_updated', (data) => {
      setDeliveryLocation(data.location);
      updateETA(data.location);
    });

    // Escuchar cambios de estado
    socketConnection.on('delivery_update', (data) => {
      setDeliveryTracking(prev => ({
        ...prev,
        status: data.status
      }));
    });

    // Cargar datos iniciales
    loadDeliveryTracking();

    return () => {
      socketConnection.emit('leave_delivery_tracking', { orderId });
      socketConnection.disconnect();
    };
  }, []);

  const loadDeliveryTracking = async () => {
    try {
      const response = await apiClient.get(`/delivery/order/${orderId}`);
      if (response.data.success) {
        setDeliveryTracking(response.data.data.deliveryTracking);
        if (response.data.data.deliveryTracking.currentLocation) {
          setDeliveryLocation(response.data.data.deliveryTracking.currentLocation);
        }
      }
    } catch (error) {
      console.error('Error loading tracking:', error);
    }
  };

  const updateETA = (currentLocation) => {
    if (!deliveryTracking || !currentLocation) return;

    const targetLocation = deliveryTracking.status.includes('pickup') 
      ? deliveryTracking.pickupLocation.coordinates
      : deliveryTracking.deliveryLocation.coordinates;

    // Calcular ETA basado en distancia y velocidad promedio
    const distance = calculateDistance(
      currentLocation.coordinates[1],
      currentLocation.coordinates[0],
      targetLocation[1],
      targetLocation[0]
    );

    const averageSpeed = 25; // km/h promedio en ciudad
    const etaMinutes = Math.round((distance / averageSpeed) * 60);
    
    setEta(etaMinutes);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={{
          latitude: deliveryLocation?.coordinates[1] || deliveryTracking?.deliveryLocation.coordinates[1],
          longitude: deliveryLocation?.coordinates[0] || deliveryTracking?.deliveryLocation.coordinates[0],
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* Marcador del delivery */}
        {deliveryLocation && (
          <Marker
            coordinate={{
              latitude: deliveryLocation.coordinates[1],
              longitude: deliveryLocation.coordinates[0]
            }}
            title="Repartidor"
            description="Ubicación actual"
          >
            <DeliveryMarker />
          </Marker>
        )}

        {/* Marcador del destino */}
        <Marker
          coordinate={{
            latitude: deliveryTracking?.deliveryLocation.coordinates[1],
            longitude: deliveryTracking?.deliveryLocation.coordinates[0]
          }}
          title="Tu ubicación"
          pinColor="red"
        />
      </MapView>

      {/* Panel de información */}
      <TrackingInfoPanel
        status={deliveryTracking?.status}
        eta={eta}
        deliveryPerson={deliveryTracking?.deliveryPersonId}
      />
    </View>
  );
};

// Componente del marcador personalizado
const DeliveryMarker = () => (
  <View style={styles.markerContainer}>
    <View style={styles.marker}>
      <Ionicons name="bicycle" size={20} color="white" />
    </View>
    <View style={styles.pulse} />
  </View>
);
```

### 2.2 Sistema de Actualizaciones en Tiempo Real

```javascript
// services/realTimeService.js
class RealTimeService {
  constructor() {
    this.socket = null;
    this.subscribers = new Map();
  }

  connect(token) {
    this.socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to real-time service');
    });

    this.socket.on('delivery_location_updated', (data) => {
      this.notifySubscribers('location_update', data);
    });

    this.socket.on('delivery_update', (data) => {
      this.notifySubscribers('status_update', data);
    });
  }

  subscribeToOrder(orderId, callback) {
    this.socket.emit('join_delivery_tracking', { orderId });
    
    if (!this.subscribers.has(orderId)) {
      this.subscribers.set(orderId, []);
    }
    this.subscribers.get(orderId).push(callback);
  }

  unsubscribeFromOrder(orderId, callback) {
    this.socket.emit('leave_delivery_tracking', { orderId });
    
    if (this.subscribers.has(orderId)) {
      const callbacks = this.subscribers.get(orderId);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifySubscribers(event, data) {
    const orderId = data.orderId;
    if (this.subscribers.has(orderId)) {
      this.subscribers.get(orderId).forEach(callback => {
        callback(event, data);
      });
    }
  }
}

export default new RealTimeService();
```

---

## 3. IMPLEMENTACIÓN TÉCNICA BACKEND

### 3.1 API Endpoints Adicionales Necesarios

```javascript
// routes/deliveryRoutes.js - Endpoints adicionales
// GET /api/delivery/nearby-orders - Pedidos cercanos para delivery
router.get('/nearby-orders', async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.query; // radius en km
    
    if (req.user.role !== 'delivery') {
      return res.status(403).json({
        success: false,
        error: { message: 'Solo delivery persons pueden ver pedidos cercanos' }
      });
    }

    // Buscar pedidos ready sin delivery asignado cerca de la ubicación
    const nearbyOrders = await Order.aggregate([
      {
        $match: {
          status: 'ready',
          deliveryPersonId: { $exists: false }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $match: {
          'merchant.business.coordinates': {
            $geoWithin: {
              $centerSphere: [[parseFloat(longitude), parseFloat(latitude)], radius / 6371]
            }
          }
        }
      },
      {
        $project: {
          orderNumber: 1,
          total: 1,
          customerInfo: 1,
          deliveryInfo: 1,
          merchant: { $arrayElemAt: ['$merchant', 0] },
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json({
      success: true,
      data: { orders: nearbyOrders }
    });

  } catch (error) {
    console.error('Error fetching nearby orders:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Error interno del servidor' }
    });
  }
});

// POST /api/delivery/:id/route-optimization
router.post('/:id/route-optimization', async (req, res) => {
  try {
    const { waypoints, optimize = true } = req.body;
    
    // Integración con Google Directions API para optimización de ruta
    const optimizedRoute = await optimizeRoute(waypoints, optimize);
    
    res.json({
      success: true,
      data: { route: optimizedRoute }
    });

  } catch (error) {
    console.error('Error optimizing route:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Error optimizando ruta' }
    });
  }
});
```

### 3.2 Servicio de Optimización de Rutas

```javascript
// services/routeOptimizationService.js
const axios = require('axios');

class RouteOptimizationService {
  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.mapboxApiKey = process.env.MAPBOX_API_KEY;
  }

  async optimizeRoute(waypoints, options = {}) {
    const { provider = 'google', optimize = true } = options;

    try {
      if (provider === 'google') {
        return await this.optimizeWithGoogle(waypoints, optimize);
      } else if (provider === 'mapbox') {
        return await this.optimizeWithMapbox(waypoints, optimize);
      }
    } catch (error) {
      console.error('Route optimization error:', error);
      throw error;
    }
  }

  async optimizeWithGoogle(waypoints, optimize) {
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediateWaypoints = waypoints.slice(1, -1);

    const url = 'https://maps.googleapis.com/maps/api/directions/json';
    const params = {
      origin: `${origin[1]},${origin[0]}`,
      destination: `${destination[1]},${destination[0]}`,
      waypoints: intermediateWaypoints.map(w => `${w[1]},${w[0]}`).join('|'),
      optimize: optimize ? 'true' : 'false',
      key: this.googleMapsApiKey,
      traffic_model: 'best_guess',
      departure_time: 'now'
    };

    const response = await axios.get(url, { params });
    
    if (response.data.status === 'OK') {
      const route = response.data.routes[0];
      return {
        coordinates: this.decodePolyline(route.overview_polyline.points),
        distance: route.legs.reduce((total, leg) => total + leg.distance.value, 0),
        duration: route.legs.reduce((total, leg) => total + leg.duration.value, 0),
        steps: route.legs.flatMap(leg => leg.steps)
      };
    } else {
      throw new Error(`Google Directions API error: ${response.data.status}`);
    }
  }

  async calculateETA(currentLocation, destination, trafficConditions = 'optimistic') {
    try {
      const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
      const params = {
        origins: `${currentLocation[1]},${currentLocation[0]}`,
        destinations: `${destination[1]},${destination[0]}`,
        traffic_model: trafficConditions,
        departure_time: 'now',
        key: this.googleMapsApiKey
      };

      const response = await axios.get(url, { params });
      
      if (response.data.status === 'OK') {
        const element = response.data.rows[0].elements[0];
        if (element.status === 'OK') {
          return {
            distance: element.distance.value,
            duration: element.duration.value,
            durationInTraffic: element.duration_in_traffic?.value || element.duration.value
          };
        }
      }
      
      throw new Error('Failed to calculate ETA');
    } catch (error) {
      console.error('ETA calculation error:', error);
      throw error;
    }
  }

  decodePolyline(encoded) {
    // Implementación del algoritmo de decodificación de polyline de Google
    const points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lng * 1e-5, lat * 1e-5]);
    }

    return points;
  }
}

module.exports = new RouteOptimizationService();
```

---

## 4. CONSIDERACIONES TÉCNICAS AVANZADAS

### 4.1 Optimización de Batería y Performance

```javascript
// services/locationOptimizationService.js
class LocationOptimizationService {
  constructor() {
    this.isTracking = false;
    this.lastKnownLocation = null;
    this.locationQueue = [];
    this.batchSize = 5;
    this.syncInterval = 30000; // 30 segundos
  }

  startOptimizedTracking() {
    // Configuración adaptiva de precisión
    const trackingConfig = {
      accuracy: Location.Accuracy.Balanced, // No siempre BestForNavigation
      timeInterval: this.getAdaptiveInterval(),
      distanceInterval: 10, // metros
    };

    this.locationSubscription = Location.watchPositionAsync(
      trackingConfig,
      this.handleLocationUpdate.bind(this)
    );
  }

  getAdaptiveInterval() {
    // Interval adaptivo basado en velocidad
    const speed = this.lastKnownLocation?.speed || 0;
    
    if (speed > 50) return 2000;  // Alta velocidad: cada 2s
    if (speed > 20) return 5000;  // Velocidad media: cada 5s
    if (speed > 5) return 10000;  // Velocidad baja: cada 10s
    return 30000; // Estacionario: cada 30s
  }

  handleLocationUpdate(location) {
    // Filtro de precisión
    if (location.coords.accuracy > 100) {
      console.log('Location accuracy too low, skipping');
      return;
    }

    // Filtro de movimiento mínimo
    if (this.hasMovedSignificantly(location)) {
      this.queueLocationUpdate(location);
    }
  }

  hasMovedSignificantly(newLocation) {
    if (!this.lastKnownLocation) return true;

    const distance = calculateDistance(
      this.lastKnownLocation.latitude,
      this.lastKnownLocation.longitude,
      newLocation.coords.latitude,
      newLocation.coords.longitude
    );

    return distance > 5; // Solo actualizar si se movió más de 5 metros
  }

  queueLocationUpdate(location) {
    this.locationQueue.push({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
      timestamp: new Date().toISOString()
    });

    // Batch upload para reducir consumo de batería
    if (this.locationQueue.length >= this.batchSize) {
      this.syncQueuedLocations();
    }
  }

  async syncQueuedLocations() {
    if (this.locationQueue.length === 0) return;

    try {
      await apiClient.post('/delivery/batch-location-update', {
        locations: this.locationQueue
      });

      this.locationQueue = [];
    } catch (error) {
      console.error('Failed to sync locations:', error);
      // Mantener en queue para retry
    }
  }
}
```

### 4.2 Manejo de Conexión Offline

```javascript
// services/offlineService.js
import NetInfo from '@react-native-netinfo/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

class OfflineService {
  constructor() {
    this.isOnline = true;
    this.pendingActions = [];
    this.offlineData = new Map();
  }

  initialize() {
    NetInfo.addEventListener(this.handleNetworkChange.bind(this));
  }

  handleNetworkChange(state) {
    const wasOffline = !this.isOnline;
    this.isOnline = state.isConnected;

    if (wasOffline && this.isOnline) {
      this.syncPendingActions();
    }
  }

  async cacheDeliveryData(deliveryId, data) {
    try {
      await AsyncStorage.setItem(`delivery_${deliveryId}`, JSON.stringify(data));
      this.offlineData.set(deliveryId, data);
    } catch (error) {
      console.error('Failed to cache delivery data:', error);
    }
  }

  async getCachedDeliveryData(deliveryId) {
    try {
      if (this.offlineData.has(deliveryId)) {
        return this.offlineData.get(deliveryId);
      }

      const cached = await AsyncStorage.getItem(`delivery_${deliveryId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  queueAction(action) {
    this.pendingActions.push({
      ...action,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    });

    this.savePendingActions();
  }

  async syncPendingActions() {
    const actions = [...this.pendingActions];
    this.pendingActions = [];

    for (const action of actions) {
      try {
        await this.executeAction(action);
      } catch (error) {
        console.error('Failed to sync action:', action, error);
        // Re-queue failed actions
        this.pendingActions.push(action);
      }
    }

    this.savePendingActions();
  }

  async executeAction(action) {
    switch (action.type) {
      case 'location_update':
        return await apiClient.put(`/delivery/${action.deliveryId}/location`, action.data);
      
      case 'status_update':
        return await apiClient.put(`/delivery/${action.deliveryId}/status`, action.data);
      
      default:
        console.warn('Unknown action type:', action.type);
    }
  }
}

export default new OfflineService();
```

### 4.3 Sistema de Notificaciones Push

```javascript
// services/pushNotificationService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
  }

  async initialize() {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      this.expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
      await this.registerPushToken();
    }

    // Configurar manejo de notificaciones
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Escuchar notificaciones recibidas
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived.bind(this)
    );

    // Escuchar respuestas a notificaciones
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );
  }

  async registerPushToken() {
    try {
      await apiClient.post('/user/register-push-token', {
        token: this.expoPushToken,
        platform: Device.osName
      });
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  handleNotificationReceived(notification) {
    const { data } = notification.request.content;
    
    switch (data.type) {
      case 'delivery_assigned':
        // Mostrar notificación de nuevo delivery
        break;
      
      case 'delivery_update':
        // Actualizar estado de delivery
        break;
      
      case 'eta_update':
        // Actualizar ETA
        break;
    }
  }

  handleNotificationResponse(response) {
    const { data } = response.notification.request.content;
    
    // Navegar a la pantalla apropiada
    if (data.orderId) {
      // Navegar a DeliveryTrackingScreen
    }
  }

  async sendLocalNotification(title, body, data = {}) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // Enviar inmediatamente
    });
  }
}

export default new PushNotificationService();
```

---

## 5. EJEMPLOS DE CÓDIGO Y CONFIGURACIÓN

### 5.1 Configuración de Permisos (Android)

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Para mantener la app activa en background -->
<service android:name=".LocationService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="location" />
```

### 5.2 Configuración de Variables de Entorno

```javascript
// .env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
SOCKET_IO_URL=ws://localhost:5000
EXPO_PUSH_TOKEN_ENDPOINT=https://exp.host/--/api/v2/push/send
```

### 5.3 Hook Personalizado para Tracking

```javascript
// hooks/useDeliveryTracking.js
import { useState, useEffect, useCallback } from 'react';
import { realTimeService } from '../services/realTimeService';

export const useDeliveryTracking = (orderId) => {
  const [deliveryData, setDeliveryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const handleUpdate = useCallback((event, data) => {
    switch (event) {
      case 'location_update':
        setDeliveryData(prev => ({
          ...prev,
          currentLocation: data.location,
          lastUpdate: data.timestamp
        }));
        break;
      
      case 'status_update':
        setDeliveryData(prev => ({
          ...prev,
          status: data.status,
          statusHistory: [...(prev.statusHistory || []), data]
        }));
        break;
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const response = await apiClient.get(`/delivery/order/${orderId}`);
        if (response.data.success) {
          setDeliveryData(response.data.data.deliveryTracking);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
    realTimeService.subscribeToOrder(orderId, handleUpdate);

    return () => {
      realTimeService.unsubscribeFromOrder(orderId, handleUpdate);
    };
  }, [orderId, handleUpdate]);

  return { deliveryData, isLoading, error };
};
```

---

## 6. ARQUITECTURA DE DEPLOYMENT

### 6.1 Docker Configuration para Servicios

```dockerfile
# backend/Dockerfile.delivery
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Instalar dependencias para servicios de ubicación
RUN apk add --no-cache python3 make g++

EXPOSE 5000

CMD ["node", "server.js"]
```

### 6.2 Nginx Configuration para WebSockets

```nginx
# nginx/nginx.conf
upstream backend {
    server backend:5000;
}

server {
    listen 80;
    
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## RESUMEN DE IMPLEMENTACIÓN

### Pasos Prioritarios:

1. **Implementar navegación básica** con MapViewDirections
2. **Optimizar el tracking de ubicación** con batching y filtros
3. **Mejorar el sistema de WebSockets** para actualizaciones en tiempo real
4. **Agregar manejo offline** con cache local
5. **Implementar notificaciones push** para estados críticos
6. **Optimizar performance** con técnicas de batería y red

### Costos Estimados:
- **Google Maps Platform**: ~$200-500/mes para 100K requests
- **Mapbox**: ~$100-300/mes (alternativa más económica)
- **Expo Push Notifications**: Gratis hasta 1M notificaciones/mes
- **Servidor adicional**: ~$50-100/mes para Socket.IO escalable

### Timeline de Implementación:
- **Semana 1-2**: Navegación básica y tracking
- **Semana 3-4**: Real-time updates y WebSockets
- **Semana 5-6**: Optimizaciones y manejo offline
- **Semana 7-8**: Testing y deployment

La arquitectura existente de Rapigoo está bien preparada para estas mejoras, con Socket.IO ya configurado y el modelo de datos adecuado implementado.