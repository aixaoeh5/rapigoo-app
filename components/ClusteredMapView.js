import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
import MapView from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import OptimizedMapMarker from './OptimizedMapMarker';
import { useMapRegionDebounce, useMapLoopPrevention } from '../hooks/useMapRegionDebounce';

// FIX: Componente de mapa con clustering optimizado
const RapigooClusteredMap = ({
    children,
    markers = [],
    onRegionChange,
    onRegionChangeComplete,
    initialRegion,
    clusteringEnabled = true,
    clusterThreshold = 20, // FIX: Activar clustering con 20+ markers
    ...mapProps
}) => {
    const mapRef = useRef(null);
    const { checkAndPreventLoop, cleanup: cleanupLoopPrevention } = useMapLoopPrevention();
    
    // FIX: Debounce para onRegionChangeComplete
    const { debouncedCallback, cleanup: cleanupDebounce } = useMapRegionDebounce(
        useCallback((region, details) => {
            // FIX: Verificar bucles antes de propagar
            if (checkAndPreventLoop()) {
                onRegionChangeComplete?.(region, details);
            }
        }, [onRegionChangeComplete, checkAndPreventLoop]),
        350 // FIX: 350ms de debounce para balance entre responsividad y performance
    );

    // FIX: Configuración optimizada de clustering
    const clusteringOptions = useMemo(() => ({
        radius: Platform.select({ ios: 60, android: 50 }), // FIX: Radio adaptativo por plataforma
        maxZoom: 14, // FIX: Nivel máximo de zoom para clustering
        minZoom: 1,
        minPoints: 2, // FIX: Mínimo 2 puntos para formar cluster
        extent: 512,
        nodeSize: 64,
        // FIX: Algoritmo de clustering Supercluster optimizado
        algorithm: 'supercluster',
    }), []);

    // FIX: Renderizado optimizado de clusters
    const renderCluster = useCallback((cluster, onPress) => {
        const { id, geometry, properties } = cluster;
        const count = properties.point_count;
        
        return (
            <OptimizedMapMarker
                key={`cluster-${id}`}
                coordinate={{
                    latitude: geometry.coordinates[1],
                    longitude: geometry.coordinates[0],
                }}
                onPress={onPress}
                customView={
                    <View style={styles.cluster}>
                        <Text style={styles.clusterText}>{count}</Text>
                    </View>
                }
                forceUpdate={false} // FIX: Clusters estáticos no necesitan tracking
            />
        );
    }, []);

    // FIX: Renderizado optimizado de markers individuales
    const renderMarker = useCallback((data) => {
        return (
            <OptimizedMapMarker
                key={data.id || `marker-${data.coordinate.latitude}-${data.coordinate.longitude}`}
                coordinate={data.coordinate}
                title={data.title}
                description={data.description}
                pinColor={data.pinColor}
                onPress={data.onPress}
                isActive={data.isActive}
                customView={data.customView}
                forceUpdate={data.forceUpdate}
            />
        );
    }, []);

    // FIX: Cleanup en desmontaje
    useEffect(() => {
        return () => {
            cleanupDebounce();
            cleanupLoopPrevention();
        };
    }, [cleanupDebounce, cleanupLoopPrevention]);

    // FIX: Decisión dinámica de clustering basada en cantidad de markers
    const shouldUseCluster = clusteringEnabled && markers.length >= clusterThreshold;

    // FIX: Componente de mapa a usar según clustering
    const MapComponent = shouldUseCluster ? ClusteredMapView : MapView;

    // FIX: Props específicos para clustering
    const clusterProps = shouldUseCluster ? {
        clustering: true,
        clusterColor: '#FF6B6B',
        clusterTextColor: '#FFFFFF',
        clusterFontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
        layoutAnimationConf: null, // FIX: Desactivar animaciones de layout para mejor performance
        animationEnabled: false, // FIX: Desactivar animaciones en Android
        preserveClusterPressBehavior: true,
        spiralEnabled: false, // FIX: Desactivar spiral para simplicidad
        superClusterRef: mapRef,
        renderCluster,
        ...clusteringOptions,
    } : {};

    return (
        <MapComponent
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={initialRegion}
            onRegionChange={onRegionChange}
            onRegionChangeComplete={debouncedCallback}
            showsUserLocation={true}
            showsMyLocationButton={true}
            showsCompass={true}
            showsScale={false}
            loadingEnabled={true}
            moveOnMarkerPress={false}
            // FIX: Optimizaciones de rendimiento
            pitchEnabled={false} // FIX: Desactivar pitch para mejor performance
            rotateEnabled={false} // FIX: Desactivar rotación si no es necesaria
            scrollEnabled={true}
            zoomEnabled={true}
            // FIX: Límites de zoom para prevenir problemas de rendimiento
            minZoomLevel={5}
            maxZoomLevel={18}
            {...clusterProps}
            {...mapProps}
        >
            {shouldUseCluster ? 
                markers.map(renderMarker) : 
                markers.map(renderMarker)
            }
            {children}
        </MapComponent>
    );
};

const styles = StyleSheet.create({
    cluster: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FF6B6B',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        // FIX: Sombra para mejor visibilidad
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
    clusterText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
});

export default RapigooClusteredMap;