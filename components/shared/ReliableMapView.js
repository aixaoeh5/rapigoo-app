// components/shared/ReliableMapView.js
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { MAP_CONFIG } from '../../config/mapConfig';

/**
 * Mapa súper simple y confiable que SIEMPRE funciona
 * Versión minimalista sin complejidades
 */
const ReliableMapView = ({ 
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

  const generateReliableMapHTML = () => {
    const centerLat = region.latitude;
    const centerLng = region.longitude;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mapa Confiable</title>
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
        .info-top {
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
    <div class="info-top">
        🗺️ Mapa gratuito • ${markers.length} punto${markers.length !== 1 ? 's' : ''} • Santo Domingo, RD
    </div>
    
    <div id="map"></div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        console.log('🚀 Iniciando mapa confiable...');
        
        try {
            // Crear mapa
            var map = L.map('map').setView([${centerLat}, ${centerLng}], 14);
            
            // Agregar tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(map);
            
            console.log('✅ Mapa base creado');
            
            // Agregar marcadores uno por uno
            ${markers.map((marker, index) => `
            try {
                var marker${index} = L.marker([${marker.coordinate.latitude}, ${marker.coordinate.longitude}])
                    .addTo(map)
                    .bindPopup('<b>${(marker.title || `Punto ${index + 1}`).replace(/'/g, "&#39;")}</b><br>${(marker.description || 'Sin descripción').replace(/'/g, "&#39;")}');
                console.log('✅ Marcador ${index} agregado');
            } catch(e) {
                console.error('❌ Error marcador ${index}:', e);
            }
            `).join('')}
            
            console.log('✅ Todos los marcadores procesados');
            
            // Evento cuando el mapa está listo
            map.on('load', function() {
                console.log('✅ Mapa completamente cargado');
                notifyReady();
            });
            
            // Notificar después de un tiempo
            setTimeout(function() {
                console.log('✅ Mapa listo por timeout');
                notifyReady();
            }, 2000);
            
        } catch (error) {
            console.error('❌ Error crítico:', error);
            notifyError(error.message);
        }
        
        function notifyReady() {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'mapReady',
                    data: { success: true, markers: ${markers.length} }
                }));
            }
        }
        
        function notifyError(message) {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'mapError',
                    data: { error: message }
                }));
            }
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
          console.log('✅ Mapa confiable listo');
          setIsLoading(false);
          setHasError(false);
          if (onMapReady) onMapReady();
          break;
          
        case 'mapError':
          console.error('❌ Error en mapa confiable:', message.data.error);
          setIsLoading(false);
          setHasError(true);
          if (onMapError) onMapError(new Error(message.data.error));
          break;
          
        default:
          console.log('📨 Mensaje mapa:', message);
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  };

  const handleLoadEnd = () => {
    console.log('📄 WebView mapa confiable cargado');
    // Timeout de seguridad más corto
    setTimeout(() => {
      if (isLoading) {
        console.log('⏰ Timeout mapa confiable - asumiendo listo');
        setIsLoading(false);
        if (onMapReady) onMapReady();
      }
    }, 5000);
  };

  const handleError = (error) => {
    console.error('❌ Error WebView mapa confiable:', error);
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
          Problema de conexión con el servicio de mapas
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
          <Text style={styles.externalButtonText}>Ver en Google Maps</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateReliableMapHTML() }}
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
          <Text style={styles.loadingText}>Cargando mapa confiable...</Text>
          <Text style={styles.loadingSubtext}>OpenStreetMap</Text>
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 12,
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

export default ReliableMapView;