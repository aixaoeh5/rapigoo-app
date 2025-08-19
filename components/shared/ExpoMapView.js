// components/shared/ExpoMapView.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

/**
 * Componente de mapa compatible con Expo Go
 * Muestra un fallback cuando react-native-maps no está disponible
 */
const ExpoMapView = ({ 
  mapState, 
  onMapReady, 
  onMapError,
  onMarkerPress,
  style = {},
  ...props 
}) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  useEffect(() => {
    getCurrentLocation();
    
    // Notificar que el mapa está "listo" después de un breve delay
    const timer = setTimeout(() => {
      if (onMapReady) {
        onMapReady();
        console.log('✅ ExpoMapView listo');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [onMapReady]);

  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('❌ Permisos de ubicación denegados');
        setIsLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 15000,
        maximumAge: 60000
      });

      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      });

      console.log('📍 Ubicación actual obtenida:', {
        lat: location.coords.latitude.toFixed(6),
        lng: location.coords.longitude.toFixed(6),
        accuracy: Math.round(location.coords.accuracy)
      });
    } catch (error) {
      console.error('❌ Error obteniendo ubicación:', error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleOpenInMaps = () => {
    if (!mapState?.region) {
      Alert.alert('Error', 'No hay ubicación disponible para mostrar');
      return;
    }

    const { latitude, longitude } = mapState.region;
    
    Alert.alert(
      'Abrir en Mapas',
      '¿Con qué aplicación deseas ver el mapa?',
      [
        {
          text: 'Google Maps',
          onPress: async () => {
            try {
              const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
              const supported = await Linking.canOpenURL(url);
              if (supported) {
                await Linking.openURL(url);
              } else {
                Alert.alert('Error', 'No se puede abrir Google Maps');
              }
            } catch (error) {
              console.error('Error abriendo Google Maps:', error);
            }
          }
        },
        {
          text: 'Apple Maps',
          onPress: async () => {
            try {
              const url = `http://maps.apple.com/?q=${latitude},${longitude}`;
              const supported = await Linking.canOpenURL(url);
              if (supported) {
                await Linking.openURL(url);
              } else {
                Alert.alert('Error', 'No se puede abrir Apple Maps');
              }
            } catch (error) {
              console.error('Error abriendo Apple Maps:', error);
            }
          }
        },
        {
          text: 'Cancelar',
          style: 'cancel'
        }
      ]
    );
  };

  const formatCoordinate = (coord) => {
    return coord ? coord.toFixed(6) : 'N/A';
  };

  // Este componente es específicamente para fallback - no intentar cargar mapas nativos

  // Fallback para Expo Go
  return (
    <View style={[styles.container, style]}>
      <View style={styles.mapFallback}>
        {/* Header del mapa */}
        <View style={styles.mapHeader}>
          <Ionicons name="map-outline" size={24} color="#E60023" />
          <Text style={styles.mapTitle}>Vista de Mapa</Text>
          <TouchableOpacity 
            style={styles.openMapsButton}
            onPress={handleOpenInMaps}
          >
            <Ionicons name="open-outline" size={20} color="#2196F3" />
          </TouchableOpacity>
        </View>

        {/* Información de ubicación actual */}
        {isLoadingLocation ? (
          <View style={styles.loadingLocation}>
            <Ionicons name="location-outline" size={20} color="#666" />
            <Text style={styles.loadingText}>Obteniendo ubicación...</Text>
          </View>
        ) : currentLocation ? (
          <View style={styles.locationInfo}>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#4CAF50" />
              <Text style={styles.locationLabel}>Tu ubicación:</Text>
            </View>
            <Text style={styles.coordinates}>
              {formatCoordinate(currentLocation.latitude)}, {formatCoordinate(currentLocation.longitude)}
            </Text>
            {currentLocation.accuracy && (
              <Text style={styles.accuracy}>
                Precisión: ±{Math.round(currentLocation.accuracy)}m
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.noLocation}>
            <Ionicons name="location-outline" size={20} color="#666" />
            <Text style={styles.noLocationText}>Ubicación no disponible</Text>
          </View>
        )}

        {/* Información del destino */}
        {mapState?.region && (
          <View style={styles.destinationInfo}>
            <View style={styles.locationRow}>
              <Ionicons name="flag" size={16} color="#E60023" />
              <Text style={styles.locationLabel}>Destino:</Text>
            </View>
            <Text style={styles.coordinates}>
              {formatCoordinate(mapState.region.latitude)}, {formatCoordinate(mapState.region.longitude)}
            </Text>
          </View>
        )}

        {/* Marcadores */}
        {mapState?.markers && mapState.markers.length > 0 && (
          <View style={styles.markersInfo}>
            <Text style={styles.markersTitle}>
              📍 Puntos de interés ({mapState.markers.length})
            </Text>
            {mapState.markers.slice(0, 3).map((marker, index) => (
              <TouchableOpacity
                key={marker.id || index}
                style={styles.markerItem}
                onPress={() => onMarkerPress && onMarkerPress(marker)}
              >
                <View style={[styles.markerDot, { backgroundColor: marker.pinColor || '#E60023' }]} />
                <View style={styles.markerInfo}>
                  <Text style={styles.markerTitle}>{marker.title || `Punto ${index + 1}`}</Text>
                  {marker.description && (
                    <Text style={styles.markerDescription} numberOfLines={1}>
                      {marker.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            {mapState.markers.length > 3 && (
              <Text style={styles.moreMarkers}>
                +{mapState.markers.length - 3} más
              </Text>
            )}
          </View>
        )}

        {/* Botón para abrir en app de mapas externa */}
        <TouchableOpacity 
          style={styles.externalMapButton}
          onPress={handleOpenInMaps}
        >
          <Ionicons name="map" size={20} color="#FFF" />
          <Text style={styles.externalMapText}>Abrir en App de Mapas</Text>
        </TouchableOpacity>

        {/* Mensaje informativo */}
        <View style={styles.infoMessage}>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
          <Text style={styles.infoText}>
            Vista simplificada - Para mapas interactivos usa un development build
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  mapTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  openMapsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  loadingLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  locationInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  noLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  noLocationText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  destinationInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E60023',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationLabel: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  coordinates: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#666',
    marginLeft: 24,
  },
  accuracy: {
    fontSize: 12,
    color: '#999',
    marginLeft: 24,
    marginTop: 2,
  },
  markersInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  markersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  markerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  markerInfo: {
    flex: 1,
  },
  markerTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  markerDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  moreMarkers: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  externalMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E60023',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  externalMapText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    marginTop: 'auto',
  },
  infoText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#1976d2',
    flex: 1,
    lineHeight: 16,
  },
});

export default ExpoMapView;