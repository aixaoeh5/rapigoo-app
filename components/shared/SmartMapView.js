// components/shared/SmartMapView.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isMapConfigured } from '../../config/mapConfig';
import WebMapView from './WebMapView';
import ExpoMapView from './ExpoMapView';

/**
 * Componente de mapa inteligente que selecciona automáticamente
 * el mejor tipo de mapa disponible según las condiciones
 */
const SmartMapView = ({ 
  mapState, 
  onMapReady, 
  onMapError,
  onMarkerPress,
  style = {},
  preferredType = 'auto', // 'auto', 'web', 'native', 'expo'
  showDebugInfo = false,
  ...props 
}) => {
  const [selectedMapType, setSelectedMapType] = useState('loading');
  const [hasNativeMaps, setHasNativeMaps] = useState(false);

  useEffect(() => {
    determineMapType();
  }, [preferredType]);

  const determineMapType = async () => {
    try {
      // 1. Verificar preferencia explícita
      if (preferredType !== 'auto') {
        setSelectedMapType(preferredType);
        return;
      }

      // 2. Verificar si hay API Key configurada
      const hasApiKey = isMapConfigured();
      
      // 3. Verificar si React Native Maps está disponible
      let nativeAvailable = false;
      try {
        await import('react-native-maps');
        nativeAvailable = true;
        setHasNativeMaps(true);
      } catch (error) {
        nativeAvailable = false;
        setHasNativeMaps(false);
      }

      // 4. Lógica de selección automática
      if (hasApiKey && !nativeAvailable) {
        // Expo Go con API key -> usar WebMapView
        console.log('🗺️ SmartMapView: Usando WebMapView (Expo Go + API Key)');
        setSelectedMapType('web');
      } else if (hasApiKey && nativeAvailable) {
        // Development build con API key -> usar Native
        console.log('🗺️ SmartMapView: Usando Native Maps (Development build + API Key)');
        setSelectedMapType('native');
      } else {
        // Sin API key -> usar ExpoMapView fallback
        console.log('🗺️ SmartMapView: Usando ExpoMapView (Sin API Key)');
        setSelectedMapType('expo');
      }

    } catch (error) {
      console.error('Error determinando tipo de mapa:', error);
      setSelectedMapType('expo');
    }
  };

  const renderMap = () => {
    switch (selectedMapType) {
      case 'web':
        return (
          <WebMapView
            mapState={mapState}
            onMapReady={onMapReady}
            onMapError={onMapError}
            onMarkerPress={onMarkerPress}
            style={style}
            {...props}
          />
        );

      case 'native':
        try {
          const OptimizedMapView = require('./OptimizedMapView').default;
          return (
            <OptimizedMapView
              mapState={mapState}
              onMapReady={onMapReady}
              onMapError={onMapError}
              onMarkerPress={onMarkerPress}
              style={style}
              {...props}
            />
          );
        } catch (error) {
          console.log('⚠️ Error cargando mapa nativo, usando web');
          return (
            <WebMapView
              mapState={mapState}
              onMapReady={onMapReady}
              onMapError={onMapError}
              onMarkerPress={onMarkerPress}
              style={style}
              {...props}
            />
          );
        }

      case 'expo':
      default:
        return (
          <ExpoMapView
            mapState={mapState}
            onMapReady={onMapReady}
            onMapError={onMapError}
            onMarkerPress={onMarkerPress}
            style={style}
            {...props}
          />
        );
    }
  };

  if (selectedMapType === 'loading') {
    return (
      <View style={[styles.loadingContainer, style]}>
        <Text style={styles.loadingText}>Inicializando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {renderMap()}
      
      {showDebugInfo && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Tipo: {selectedMapType} | API: {isMapConfigured() ? '✅' : '❌'} | Native: {hasNativeMaps ? '✅' : '❌'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  debugInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
  },
});

export default SmartMapView;