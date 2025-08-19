// components/shared/FreeMapView.js
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { MAP_CONFIG } from '../../config/mapConfig';

/**
 * Mapa gratuito sin API key usando OpenStreetMap
 * Alternativa confiable que siempre funciona
 */
const FreeMapView = ({ 
  mapState, 
  onMapReady, 
  onMapError,
  onMarkerPress,
  style = {},
  ...props 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef(null);

  const region = mapState?.region || MAP_CONFIG.defaultRegion;
  const markers = mapState?.markers || [];

  const generateFreeMapHTML = () => {
    const centerLat = region.latitude;
    const centerLng = region.longitude;
    
    // Generar marcadores para OpenStreetMap
    const markersJS = markers.map((marker, index) => {
      return `
        var marker${index} = L.marker([${marker.coordinate.latitude}, ${marker.coordinate.longitude}])
          .addTo(map)
          .bindPopup('<b>${marker.title || `Punto ${index + 1}`}</b><br>${marker.description || 'Sin descripción'}')
          .on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'markerPress',
              data: {
                id: '${marker.id || index}',
                title: '${marker.title || `Punto ${index + 1}`}',
                coordinate: {
                  latitude: ${marker.coordinate.latitude},
                  longitude: ${marker.coordinate.longitude}
                }
              }
            }));
          });`;
    }).join('\n');

    // Crear array de marcadores para fitBounds
    const markersList = markers.map((_, index) => `marker${index}`).join(', ');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mapa Gratuito</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body, html { 
            margin: 0; 
            padding: 0; 
            height: 100%; 
            font-family: Arial, sans-serif;
        }
        #map { 
            height: 100%; 
            width: 100%; 
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 1000;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .info-banner {
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            background: rgba(33, 150, 243, 0.9);
            color: white;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
            z-index: 1000;
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">
        <div>🗺️ Cargando mapa gratuito...</div>
        <div style="font-size: 12px; margin-top: 4px;">OpenStreetMap</div>
    </div>
    
    <div class="info-banner">
        📍 Mapa gratuito sin API Key • ${markers.length} marcador${markers.length !== 1 ? 'es' : ''}
    </div>
    
    <div id="map"></div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        try {
            console.log('🗺️ Inicializando mapa gratuito...');
            
            // Crear mapa con OpenStreetMap
            const map = L.map('map').setView([${centerLat}, ${centerLng}], 14);
            
            // Agregar capa de OpenStreetMap
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);
            
            // Agregar marcadores
            ${markersJS}
            
            // Ajustar vista si hay múltiples marcadores
            ${markers.length > 1 && markersList ? `
            try {
              const group = new L.featureGroup([${markersList}]);
              map.fitBounds(group.getBounds().pad(0.1));
            } catch(e) {
              console.log('No se pudo ajustar bounds:', e);
            }
            ` : ''}
            
            // Ocultar loading
            document.getElementById('loading').style.display = 'none';
            
            // Notificar que está listo
            setTimeout(() => {
                console.log('✅ Mapa gratuito listo');
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'mapReady',
                    data: { success: true, type: 'free' }
                }));
            }, 1000);
            
            // Manejar clics en el mapa
            map.on('click', function(e) {
                console.log('🗺️ Clic en mapa:', e.latlng);
            });
            
        } catch (error) {
            console.error('❌ Error inicializando mapa:', error);
            document.getElementById('loading').innerHTML = 
                '<div style="color: red;">❌ Error cargando mapa</div>' +
                '<div style="font-size: 12px; margin-top: 4px;">' + error.message + '</div>';
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapError',
                data: { error: error.message }
            }));
        }
    </script>
</body>
</html>`;
  };

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'mapReady':
          console.log('✅ Mapa gratuito listo');
          setIsLoading(false);
          setHasError(false);
          if (onMapReady) onMapReady();
          break;
          
        case 'mapError':
          console.error('❌ Error en mapa gratuito:', message.data.error);
          setIsLoading(false);
          setHasError(true);
          if (onMapError) onMapError(new Error(message.data.error));
          break;
          
        case 'markerPress':
          console.log('📍 Marcador presionado:', message.data.title);
          if (onMarkerPress) onMarkerPress(message.data);
          break;
          
        default:
          console.log('📨 Mensaje:', message);
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  };

  const handleLoadEnd = () => {
    // Timeout de seguridad
    setTimeout(() => {
      if (isLoading) {
        console.log('⏰ Timeout mapa gratuito');
        setIsLoading(false);
        if (onMapReady) onMapReady();
      }
    }, 8000);
  };

  const handleError = (error) => {
    console.error('❌ Error WebView mapa gratuito:', error);
    setIsLoading(false);
    setHasError(true);
    if (onMapError) onMapError(new Error('Error de conexión'));
  };

  const openInGoogleMaps = async () => {
    const lat = region.latitude;
    const lng = region.longitude;
    const url = `https://www.google.com/maps?q=${lat},${lng}&z=14`;
    
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se puede abrir Google Maps');
      }
    } catch (error) {
      console.error('Error abriendo Google Maps:', error);
    }
  };

  if (hasError) {
    return (
      <View style={[styles.errorContainer, style]}>
        <Ionicons name="map-outline" size={48} color="#ccc" />
        <Text style={styles.errorTitle}>Error cargando mapa</Text>
        <Text style={styles.errorMessage}>
          No se pudo conectar con el servicio de mapas
        </Text>
        
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setHasError(false);
            setIsLoading(true);
            if (webViewRef.current) {
              webViewRef.current.reload();
            }
          }}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.externalButton}
          onPress={openInGoogleMaps}
        >
          <Ionicons name="open-outline" size={20} color="#2196F3" />
          <Text style={styles.externalButtonText}>Abrir en Google Maps</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateFreeMapHTML() }}
        style={styles.webview}
        javaScriptEnabled={true}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        startInLoadingState={false}
        mixedContentMode="compatibility"
        originWhitelist={['*']}
        {...props}
      />
      
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Cargando mapa gratuito...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8f9fa',
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
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  externalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  externalButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default FreeMapView;