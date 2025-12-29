// components/shared/SimpleWebMapView.js
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { MAP_CONFIG } from '../../config/mapConfig';

/**
 * Mapa web simple y confiable que siempre funciona
 * Fallback cuando WebMapView complejo no carga
 */
const SimpleWebMapView = ({ 
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

  const generateSimpleMapHTML = () => {
    const apiKey = MAP_CONFIG.apiKey;
    const firstMarker = markers[0];
    const centerLat = firstMarker?.coordinate?.latitude || region.latitude;
    const centerLng = firstMarker?.coordinate?.longitude || region.longitude;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mapa Simple</title>
    <style>
        body, html { 
            margin: 0; 
            padding: 0; 
            height: 100%; 
            font-family: Arial, sans-serif;
        }
        #map-container { 
            height: 100%; 
            width: 100%; 
            position: relative;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
        .loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 100;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .marker-info {
            position: absolute;
            bottom: 10px;
            left: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 200;
        }
    </style>
</head>
<body>
    <div id="map-container">
        <div class="loading">
            <div>🗺️ Cargando mapa...</div>
            <div style="font-size: 12px; margin-top: 4px;">Google Maps Embebido</div>
        </div>
        
        <iframe
            src="https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${centerLat},${centerLng}&zoom=14&maptype=roadmap"
            onload="document.querySelector('.loading').style.display='none'; window.ReactNativeWebView?.postMessage(JSON.stringify({type:'ready'}));"
            onerror="window.ReactNativeWebView?.postMessage(JSON.stringify({type:'error', message:'Error cargando iframe'}));"
            allowfullscreen>
        </iframe>
        
        ${markers.length > 0 ? `
        <div class="marker-info">
            📍 ${markers.length} punto${markers.length !== 1 ? 's' : ''} marcado${markers.length !== 1 ? 's' : ''}
            ${firstMarker ? ` • ${firstMarker.title || 'Principal'}` : ''}
        </div>
        ` : ''}
    </div>

    <script>
        // Notificar que está listo después de un timeout
        setTimeout(function() {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'ready',
                    data: { success: true }
                }));
            }
        }, 3000);
        
        console.log('🗺️ Mapa simple inicializado');
        console.log('📍 Centro:', ${centerLat}, ${centerLng});
        console.log('📌 Marcadores:', ${markers.length});
    </script>
</body>
</html>`;
  };

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'ready') {
        console.log('✅ Mapa simple listo');
        setIsLoading(false);
        setHasError(false);
        if (onMapReady) onMapReady();
      } else if (message.type === 'error') {
        console.error('❌ Error en mapa simple:', message.message);
        setIsLoading(false);
        setHasError(true);
        if (onMapError) onMapError(new Error(message.message));
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  };

  const handleLoadEnd = () => {
    // Timeout de seguridad
    setTimeout(() => {
      if (isLoading) {
        console.log('⏰ Timeout mapa simple');
        setIsLoading(false);
        if (onMapReady) onMapReady(); // Asumir que cargó
      }
    }, 5000);
  };

  const handleError = (error) => {
    console.error('❌ Error WebView simple:', error);
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
          No se pudo conectar con Google Maps
        </Text>
        
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setHasError(false);
            setIsLoading(true);
            // Forzar recarga del WebView
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
        source={{ html: generateSimpleMapHTML() }}
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
          <ActivityIndicator size="large" color="#E60023" />
          <Text style={styles.loadingText}>Cargando mapa simple...</Text>
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
    backgroundColor: '#E60023',
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

export default SimpleWebMapView;