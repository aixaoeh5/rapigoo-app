// components/shared/WebMapView.js
import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAP_CONFIG } from '../../config/mapConfig';

/**
 * Componente de mapa web que funciona en Expo Go
 * Usa Google Maps embebido para mostrar mapas reales
 */
const WebMapView = ({ 
  mapState, 
  onMapReady, 
  onMapError,
  onMarkerPress,
  style = {},
  ...props 
}) => {
  const [isLoading, setIsLoading] = useState(true);

  const generateMapHTML = () => {
    const region = mapState?.region || MAP_CONFIG.defaultRegion;
    const markers = mapState?.markers || [];
    const apiKey = MAP_CONFIG.apiKey;

    // Generar marcadores JavaScript
    const markersJS = markers.map((marker, index) => {
      const color = marker.pinColor || '#E60023';
      // Convertir color hex a formato compatible
      const markerColor = color.replace('#', '');
      
      return `
        {
          position: { lat: ${marker.coordinate.latitude}, lng: ${marker.coordinate.longitude} },
          title: "${marker.title || `Marcador ${index + 1}`}",
          description: "${marker.description || ''}",
          color: "${markerColor}",
          id: "${marker.id || index}"
        }`;
    }).join(',');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta charset="UTF-8">
    <style>
        body, html { 
            margin: 0; 
            padding: 0; 
            height: 100%; 
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
        }
        #map { 
            height: 100%; 
            width: 100%; 
        }
        .info-window {
            padding: 8px;
            min-width: 150px;
        }
        .info-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 4px;
        }
        .info-description {
            color: #666;
            font-size: 12px;
        }
        #loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #666;
            z-index: 1000;
        }
        #error {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #e60023;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1001;
            display: none;
        }
    </style>
</head>
<body>
    <div id="loading">
        <div>🗺️ Cargando mapa...</div>
        <div style="font-size: 12px; margin-top: 8px;">Conectando con Google Maps</div>
    </div>
    
    <div id="error">
        <div>❌ Error cargando mapa</div>
        <div id="errorMessage" style="font-size: 12px; margin-top: 8px;"></div>
    </div>
    
    <div id="map"></div>
    
    <script>
        let map;
        let infoWindow;
        
        function showError(message) {
            console.error('Error:', message);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('errorMessage').textContent = message;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'mapError',
                data: { error: message }
            }));
        }
        
        function hideLoading() {
            document.getElementById('loading').style.display = 'none';
        }
        
        function initMap() {
            try {
                console.log('🗺️ Iniciando Google Maps...');
                hideLoading();
                
                // Centro del mapa
                const center = { lat: ${region.latitude}, lng: ${region.longitude} };
                
                // Crear mapa
                map = new google.maps.Map(document.getElementById("map"), {
                    zoom: 14,
                    center: center,
                    mapTypeId: 'roadmap',
                    styles: [
                        {
                            featureType: 'poi',
                            elementType: 'labels',
                            stylers: [{ visibility: 'on' }]
                        }
                    ],
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                });
                
                // Crear ventana de información
                infoWindow = new google.maps.InfoWindow();
                
                // Agregar marcadores
                const markers = [${markersJS}];
                
                markers.forEach((markerInfo, index) => {
                    const marker = new google.maps.Marker({
                        position: markerInfo.position,
                        map: map,
                        title: markerInfo.title,
                        icon: {
                            url: \`https://maps.google.com/mapfiles/ms/icons/\${markerInfo.color || 'red'}-dot.png\`,
                            scaledSize: new google.maps.Size(32, 32)
                        }
                    });
                    
                    // Click listener para marcadores
                    marker.addListener('click', () => {
                        const content = \`
                            <div class="info-window">
                                <div class="info-title">\${markerInfo.title}</div>
                                \${markerInfo.description ? \`<div class="info-description">\${markerInfo.description}</div>\` : ''}
                            </div>
                        \`;
                        
                        infoWindow.setContent(content);
                        infoWindow.open(map, marker);
                        
                        // Notificar a React Native
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'markerPress',
                            data: markerInfo
                        }));
                    });
                });
                
                // Ajustar vista si hay múltiples marcadores
                if (markers.length > 1) {
                    const bounds = new google.maps.LatLngBounds();
                    markers.forEach(markerInfo => {
                        bounds.extend(markerInfo.position);
                    });
                    map.fitBounds(bounds);
                    
                    // Establecer zoom mínimo
                    google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
                        if (map.getZoom() > 16) {
                            map.setZoom(16);
                        }
                    });
                }
                
                // Notificar que el mapa está listo
                setTimeout(() => {
                    console.log('✅ Mapa inicializado correctamente');
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'mapReady',
                        data: { success: true }
                    }));
                }, 1000);
                
            } catch (error) {
                console.error('❌ Error en initMap:', error);
                showError('Error inicializando mapa: ' + error.message);
            }
        }
        
        function handleError(error) {
            const message = error?.message || error || 'Error desconocido';
            console.error('❌ Error del mapa:', message);
            showError(message);
        }
        
        // Interceptar errores globales
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            console.error('❌ Error global:', msg, url, lineNo);
            handleError(error || { message: msg });
            return false;
        };
        
        // Verificar conexión antes de cargar
        console.log('🔍 Verificando API Key y conexión...');
        console.log('🔑 API Key:', '${apiKey}');
        console.log('📍 Centro:', ${region.latitude}, ${region.longitude});
        
    </script>
    <script 
        src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&v=weekly&libraries=geometry"
        onerror="showError('Error cargando Google Maps API - verifica conexión a internet y API key')"
        defer>
    </script>
</body>
</html>`;
  };

  const handleMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'mapReady':
          console.log('✅ Mapa web listo');
          setIsLoading(false);
          if (onMapReady) onMapReady();
          break;
          
        case 'mapError':
          console.error('❌ Error en mapa web:', message.data.error);
          setIsLoading(false);
          if (onMapError) onMapError(new Error(message.data.error));
          break;
          
        case 'markerPress':
          console.log('📍 Marcador presionado:', message.data.title);
          if (onMarkerPress) onMarkerPress(message.data);
          break;
          
        default:
          console.log('📨 Mensaje web:', message);
      }
    } catch (error) {
      console.error('Error procesando mensaje del mapa:', error);
    }
  };

  const handleLoadEnd = () => {
    console.log('📄 WebView carga completada');
    
    // Timeout más corto para desarrollo
    setTimeout(() => {
      if (isLoading) {
        console.log('⏰ Timeout cargando mapa web');
        setIsLoading(false);
        if (onMapError) {
          onMapError(new Error('Timeout cargando mapa - verifica conexión a internet'));
        }
      }
    }, 15000); // Aumentado a 15 segundos
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('❌ Error WebView:', nativeEvent);
    setIsLoading(false);
    if (onMapError) {
      onMapError(new Error(`Error de WebView: ${nativeEvent.description}`));
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        source={{ html: generateMapHTML() }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        onHttpError={handleError}
        mixedContentMode="compatibility"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        {...props}
      />
      
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#E60023" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default WebMapView;