// components/shared/OptimizedMapView.js
import React, { useRef, useCallback, memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { performanceOptimizer } from '../../utils/PerformanceOptimizer';
import { getMapConfig, isMapConfigured } from '../../config/mapConfig';

/**
 * Componente MapView optimizado con manejo de errores y performance mejorada
 * Previene re-renders innecesarios y maneja estados de carga/error elegantemente
 */
const OptimizedMapView = memo(({
  mapState,
  onMapReady,
  onMapError,
  onMarkerPress,
  onRegionChange,
  showLoadingOverlay = true,
  showErrorFallback = true,
  style = {},
  ...mapViewProps
}) => {
  const mapRef = useRef(null);
  const [hasNativeMapSupport, setHasNativeMapSupport] = useState(false);
  const [MapViewComponent, setMapViewComponent] = useState(null);
  const [MarkerComponent, setMarkerComponent] = useState(null);

  // Aplicar optimizaciones de performance
  useEffect(() => {
    const optimizations = performanceOptimizer.constructor.getDeliveryMapOptimizations();
    console.log('📊 Aplicando optimizaciones de mapa:', optimizations);
    
    return () => {
      // Cleanup al desmontar
      console.log('🧹 Limpiando optimizaciones de mapa');
    };
  }, []);

  // Verificar soporte de mapas nativos y configuración
  useEffect(() => {
    checkNativeMapSupport();
  }, []);

  const checkNativeMapSupport = async () => {
    try {
      // Verificar si la configuración de mapas es válida
      const isConfigured = isMapConfigured();
      if (!isConfigured) {
        console.warn('⚠️ Google Maps API key no configurada');
      }

      const maps = await import('react-native-maps');
      setMapViewComponent(() => maps.default);
      setMarkerComponent(() => maps.Marker);
      setHasNativeMapSupport(true);
      console.log('✅ React Native Maps disponible', {
        configured: isConfigured,
        provider: 'google',
        apiKey: isConfigured ? 'Configurada' : 'Faltante'
      });

      // Probar renderizado de mapa después de un breve retraso
      setTimeout(() => {
        console.log('🔄 Mapa nativo listo para renderizar');
      }, 1000);

    } catch (error) {
      console.log('⚠️ React Native Maps no disponible, usando ExpoMapView', error.message);
      setHasNativeMapSupport(false);
    }
  };

  // Callback optimizado para cuando el mapa está listo
  const handleMapReady = useCallback(() => {
    console.log('✅ Mapa cargado correctamente');
    if (onMapReady) {
      onMapReady();
    }
  }, [onMapReady]);

  // Callback optimizado para errores del mapa
  const handleMapError = useCallback((error) => {
    console.error('❌ Error en el mapa:', error);
    if (onMapError) {
      onMapError(error);
    }
  }, [onMapError]);

  // Callback optimizado para presionar marcadores
  const handleMarkerPress = useCallback((marker, event) => {
    console.log('📍 Marcador presionado:', marker.id);
    if (onMarkerPress) {
      onMarkerPress(marker, event);
    }
  }, [onMarkerPress]);

  // Callback optimizado para cambios de región con debouncing
  const handleRegionChange = useCallback(
    performanceOptimizer.optimizeMapRegionUpdates((region) => {
      if (onRegionChange) {
        onRegionChange(region);
      }
    }, {
      debounceDelay: 300,
      maxUpdatesPerSecond: 3
    }),
    [onRegionChange]
  );

  // Renderizar pantalla de carga
  if (mapState.isLoading && showLoadingOverlay) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>
            {mapState.error || 'Cargando mapa...'}
          </Text>
        </View>
      </View>
    );
  }

  // Renderizar error si el mapa no puede cargar
  if (!mapState.isReady && showErrorFallback) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <View style={styles.errorContent}>
          <Ionicons name="map-outline" size={64} color="#ccc" />
          <Text style={styles.errorTitle}>Mapa No Disponible</Text>
          <Text style={styles.errorMessage}>
            {mapState.error || 'No se pueden cargar los datos del mapa'}
          </Text>
          {mapState.refreshMap && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={mapState.refreshMap}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // Optimizar marcadores basado en viewport y performance
  const optimizedMarkers = useCallback(() => {
    return performanceOptimizer.optimizeMarkerRendering(
      mapState.markers,
      null // viewport bounds se pueden agregar después
    );
  }, [mapState.markers]);

  // Si no hay soporte nativo de mapas, usar ExpoMapView
  if (!hasNativeMapSupport) {
    const ExpoMapView = require('./ExpoMapView').default;
    return (
      <ExpoMapView
        mapState={mapState}
        onMapReady={onMapReady}
        onMapError={onMapError}
        onMarkerPress={onMarkerPress}
        style={style}
        {...mapViewProps}
      />
    );
  }

  // Si aún no se han cargado los componentes nativos
  if (!MapViewComponent || !MarkerComponent) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Cargando componente de mapa...</Text>
        </View>
      </View>
    );
  }

  // Renderizar mapa principal con componentes nativos
  return (
    <View style={[styles.container, style]}>
      <MapViewComponent
        ref={mapRef}
        style={styles.map}
        region={mapState.region}
        provider="google"
        showsUserLocation={false} // Usamos nuestros propios marcadores
        showsMyLocationButton={false}
        showsCompass={true}
        showsTraffic={false}
        showsScale={true}
        loadingEnabled={true}
        loadingBackgroundColor="#f8f9fa"
        loadingIndicatorColor="#E60023"
        onMapReady={handleMapReady}
        onError={handleMapError}
        onRegionChange={handleRegionChange}
        onMapLoaded={() => {
          console.log('🗺️ Map tiles cargados');
        }}
        {...mapViewProps}
      >
        {/* Renderizar marcadores optimizadamente */}
        {optimizedMarkers().map((marker) => (
          <MarkerComponent
            key={marker.id}
            coordinate={marker.coordinate}
            title={marker.title}
            description={marker.description}
            pinColor={marker.pinColor}
            onPress={(event) => handleMarkerPress(marker, event)}
          />
        ))}
      </MapViewComponent>
      
      {/* Debug info solo en desarrollo con modo verbose */}
      {__DEV__ && global.VERBOSE_DEBUG && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Marcadores: {optimizedMarkers().length}/{mapState.markers.length} | 
            Estado: {mapState.isReady ? '✅' : '⏳'} | Nativo: ✅
          </Text>
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  // Optimización de re-renders: solo re-renderizar si cambió algo significativo
  const prevState = prevProps.mapState;
  const nextState = nextProps.mapState;
  
  // Verificar cambios en el estado del mapa
  if (prevState.isReady !== nextState.isReady ||
      prevState.isLoading !== nextState.isLoading ||
      prevState.error !== nextState.error) {
    return false; // Re-render necesario
  }
  
  // Verificar cambios en la región (solo significativos)
  if (prevState.region && nextState.region) {
    const regionChanged = 
      Math.abs(prevState.region.latitude - nextState.region.latitude) > 0.001 ||
      Math.abs(prevState.region.longitude - nextState.region.longitude) > 0.001 ||
      Math.abs(prevState.region.latitudeDelta - nextState.region.latitudeDelta) > 0.001 ||
      Math.abs(prevState.region.longitudeDelta - nextState.region.longitudeDelta) > 0.001;
    
    if (regionChanged) {
      return false; // Re-render necesario
    }
  } else if (prevState.region !== nextState.region) {
    return false; // Re-render necesario
  }
  
  // Verificar cambios en marcadores
  if (prevState.markers.length !== nextState.markers.length) {
    return false; // Re-render necesario
  }
  
  // Verificar cambios en coordenadas de marcadores
  const markersChanged = prevState.markers.some((prevMarker, index) => {
    const nextMarker = nextState.markers[index];
    if (!nextMarker) return true;
    
    return (
      prevMarker.id !== nextMarker.id ||
      Math.abs(prevMarker.coordinate.latitude - nextMarker.coordinate.latitude) > 0.00001 ||
      Math.abs(prevMarker.coordinate.longitude - nextMarker.coordinate.longitude) > 0.00001
    );
  });
  
  if (markersChanged) {
    return false; // Re-render necesario
  }
  
  // No hay cambios significativos, evitar re-render
  return true;
});

OptimizedMapView.displayName = 'OptimizedMapView';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  debugInfo: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default OptimizedMapView;