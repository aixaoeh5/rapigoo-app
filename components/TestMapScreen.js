// components/TestMapScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ExpoMapView from './shared/ExpoMapView';
import WebMapView from './shared/WebMapView';
import SimpleWebMapView from './shared/SimpleWebMapView';
import ReliableMapView from './shared/ReliableMapView';
import SafeAreaView from './shared/SafeAreaView';
import { getMapConfig, isMapConfigured } from '../config/mapConfig';

const TestMapScreen = () => {
  const navigation = useNavigation();
  const [mapState, setMapState] = useState({
    isReady: true,
    isLoading: false,
    error: null,
    region: {
      latitude: 18.4861,  // Santo Domingo
      longitude: -69.9312,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
    markers: [
      {
        id: 'pickup',
        coordinate: {
          latitude: 18.4861,
          longitude: -69.9312,
        },
        title: 'Punto de Recogida',
        description: 'Restaurante Demo',
        pinColor: '#FF9800',
        type: 'pickup'
      },
      {
        id: 'delivery',
        coordinate: {
          latitude: 18.4900,
          longitude: -69.9200,
        },
        title: 'Punto de Entrega',
        description: 'Cliente Demo',
        pinColor: '#4CAF50',
        type: 'delivery'
      }
    ]
  });

  const [nativeMapComponent, setNativeMapComponent] = useState(null);
  const [hasNativeMaps, setHasNativeMaps] = useState(false);
  const [mapType, setMapType] = useState('free'); // 'free', 'simple', 'web', 'expo', 'native'
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    checkNativeMapSupport();
  }, []);

  const checkNativeMapSupport = async () => {
    try {
      console.log('🔍 Verificando soporte de React Native Maps...');
      const maps = await import('react-native-maps');
      setNativeMapComponent(() => maps.default);
      setHasNativeMaps(true);
      console.log('✅ React Native Maps disponible');
      
      const isConfigured = isMapConfigured();
      console.log(`🔑 API Key configurada: ${isConfigured}`);
      
      setTestResults([
        { test: 'React Native Maps', status: 'success', message: 'Componente disponible' },
        { test: 'API Key', status: isConfigured ? 'success' : 'error', message: isConfigured ? 'Configurada' : 'Faltante' }
      ]);
    } catch (error) {
      console.log('❌ React Native Maps no disponible:', error.message);
      setHasNativeMaps(false);
      setTestResults([
        { test: 'React Native Maps', status: 'error', message: error.message }
      ]);
    }
  };

  const handleMapReady = () => {
    console.log('✅ Mapa de prueba listo');
  };

  const handleMapError = (error) => {
    console.error('❌ Error en mapa de prueba:', error);
  };

  const handleMarkerPress = (marker) => {
    console.log('📍 Marcador presionado:', marker.title);
  };

  const addRandomMarker = () => {
    const newMarker = {
      id: `marker_${Date.now()}`,
      coordinate: {
        latitude: 18.4861 + (Math.random() - 0.5) * 0.02,
        longitude: -69.9312 + (Math.random() - 0.5) * 0.02,
      },
      title: `Marcador ${mapState.markers.length + 1}`,
      description: 'Marcador de prueba',
      pinColor: '#E60023',
      type: 'test'
    };

    setMapState(prev => ({
      ...prev,
      markers: [...prev.markers, newMarker]
    }));
  };

  const clearMarkers = () => {
    setMapState(prev => ({
      ...prev,
      markers: []
    }));
  };

  const renderNativeMap = () => {
    if (!hasNativeMaps || !nativeMapComponent) {
      return (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={48} color="#ccc" />
          <Text style={styles.placeholderText}>React Native Maps no disponible</Text>
        </View>
      );
    }

    const NativeMapView = nativeMapComponent;
    const config = getMapConfig();

    return (
      <NativeMapView
        style={styles.map}
        initialRegion={config.initialRegion}
        provider="google"
        onMapReady={() => {
          console.log('✅ Mapa nativo listo');
          Alert.alert('Éxito', 'Mapa nativo cargado correctamente');
        }}
        onError={(error) => {
          console.error('❌ Error mapa nativo:', error);
          Alert.alert('Error', `Error en mapa nativo: ${error.message}`);
        }}
      >
        {mapState.markers.map((marker) => (
          <NativeMapView.Marker
            key={marker.id}
            coordinate={marker.coordinate}
            title={marker.title}
            description={marker.description}
            pinColor={marker.pinColor}
            onPress={() => handleMarkerPress(marker)}
          />
        ))}
      </NativeMapView>
    );
  };

  return (
    <SafeAreaView>
      <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Test de Mapa</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={checkNativeMapSupport}
        >
          <Ionicons name="refresh" size={20} color="#E60023" />
        </TouchableOpacity>
      </View>

      {/* Selector de mapa */}
      <View style={styles.mapSelectorGrid}>
        <TouchableOpacity
          style={[styles.selectorButton, mapType === 'free' && styles.selectorButtonActive]}
          onPress={() => setMapType('free')}
        >
          <Text style={[styles.selectorText, mapType === 'free' && styles.selectorTextActive]}>
            Free Map
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectorButton, mapType === 'simple' && styles.selectorButtonActive]}
          onPress={() => setMapType('simple')}
        >
          <Text style={[styles.selectorText, mapType === 'simple' && styles.selectorTextActive]}>
            Simple
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectorButton, mapType === 'web' && styles.selectorButtonActive]}
          onPress={() => setMapType('web')}
        >
          <Text style={[styles.selectorText, mapType === 'web' && styles.selectorTextActive]}>
            Google
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectorButton, mapType === 'expo' && styles.selectorButtonActive]}
          onPress={() => setMapType('expo')}
        >
          <Text style={[styles.selectorText, mapType === 'expo' && styles.selectorTextActive]}>
            Info
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectorButton, mapType === 'native' && styles.selectorButtonActive]}
          onPress={() => {
            if (hasNativeMaps) {
              setMapType('native');
            } else {
              Alert.alert('No disponible', 'React Native Maps no está disponible en Expo Go');
            }
          }}
        >
          <Text style={[styles.selectorText, mapType === 'native' && styles.selectorTextActive]}>
            Native
          </Text>
        </TouchableOpacity>
      </View>

      {/* Resultados de pruebas */}
      <View style={styles.testSection}>
        <Text style={styles.sectionTitle}>Estado de Configuración</Text>
        {testResults.map((result, index) => (
          <View key={index} style={[styles.testResult, styles[`test${result.status.charAt(0).toUpperCase() + result.status.slice(1)}`]]}>
            <Ionicons 
              name={result.status === 'success' ? 'checkmark-circle' : 'close-circle'} 
              size={20} 
              color={result.status === 'success' ? '#4CAF50' : '#f44336'} 
            />
            <View style={styles.testContent}>
              <Text style={styles.testName}>{result.test}</Text>
              <Text style={styles.testMessage}>{result.message}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Mapa */}
      <View style={styles.mapContainer}>
        <Text style={styles.mapTitle}>
          {mapType === 'free' ? '🆓 Mapa Gratuito (OpenStreetMap)' :
           mapType === 'simple' ? 'Google Maps Simple (Con API Key)' :
           mapType === 'web' ? 'Google Maps Web (Con API Key)' : 
           mapType === 'native' ? 'Google Maps Nativo' : 'Vista de Información'} 
        </Text>
        {mapType === 'free' ? (
          <ReliableMapView
            mapState={mapState}
            onMapReady={handleMapReady}
            onMapError={handleMapError}
            onMarkerPress={handleMarkerPress}
            style={styles.map}
          />
        ) : mapType === 'simple' ? (
          <SimpleWebMapView
            mapState={mapState}
            onMapReady={handleMapReady}
            onMapError={handleMapError}
            onMarkerPress={handleMarkerPress}
            style={styles.map}
          />
        ) : mapType === 'web' ? (
          <WebMapView
            mapState={mapState}
            onMapReady={handleMapReady}
            onMapError={handleMapError}
            onMarkerPress={handleMarkerPress}
            style={styles.map}
          />
        ) : mapType === 'native' ? (
          renderNativeMap()
        ) : (
          <ExpoMapView
            mapState={mapState}
            onMapReady={handleMapReady}
            onMapError={handleMapError}
            onMarkerPress={handleMarkerPress}
            style={styles.map}
          />
        )}
      </View>

      {/* Controles */}
      <View style={styles.controls}>
        <Text style={styles.controlsTitle}>Controles de Prueba</Text>
        
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#4CAF50' }]}
            onPress={addRandomMarker}
          >
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.controlButtonText}>Agregar Marcador</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: '#f44336' }]}
            onPress={clearMarkers}
          >
            <Ionicons name="trash" size={20} color="#FFF" />
            <Text style={styles.controlButtonText}>Limpiar</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: '#2196F3', width: '100%' }]}
          onPress={() => {
            Alert.alert(
              'Información de Debug',
              `React Native Maps: ${hasNativeMaps ? 'Disponible' : 'No disponible'}\n` +
              `API Key: ${isMapConfigured() ? 'Configurada' : 'Faltante'}\n` +
              `Modo actual: ${mapType}\n` +
              `Marcadores: ${mapState.markers.length}`
            );
          }}
        >
          <Ionicons name="information-circle" size={20} color="#FFF" />
          <Text style={styles.controlButtonText}>Mostrar Info</Text>
        </TouchableOpacity>

        <View style={styles.infoPanel}>
          <Text style={styles.infoTitle}>Estado del Mapa:</Text>
          <Text style={styles.infoText}>
            📍 Marcadores: {mapState.markers.length}
          </Text>
          <Text style={styles.infoText}>
            🗺️ Región: {mapState.region.latitude.toFixed(4)}, {mapState.region.longitude.toFixed(4)}
          </Text>
          <Text style={styles.infoText}>
            ✅ Estado: {mapState.isReady ? 'Listo' : 'Cargando'}
          </Text>
          <Text style={styles.infoText}>
            🔧 Modo: {mapType === 'free' ? 'Mapa Gratuito' : mapType === 'simple' ? 'Google Simple' : mapType === 'web' ? 'Google Web' : mapType === 'native' ? 'Google Nativo' : 'Vista Info'}
          </Text>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  mapSelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  selectorButton: {
    minWidth: '23%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  selectorButtonActive: {
    backgroundColor: '#E60023',
  },
  selectorText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  selectorTextActive: {
    color: '#fff',
  },
  testSection: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  testResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  testSuccess: {
    backgroundColor: '#e8f5e8',
  },
  testError: {
    backgroundColor: '#ffeaea',
  },
  testContent: {
    marginLeft: 12,
    flex: 1,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  testMessage: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  mapContainer: {
    height: 300,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: '#fff',
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  controls: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  controlButtonText: {
    marginLeft: 8,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  infoPanel: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});

export default TestMapScreen;