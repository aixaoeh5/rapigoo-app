import React, { useState, useEffect, memo } from 'react';
import { Marker } from 'react-native-maps';
import { View, Text, StyleSheet } from 'react-native';

// FIX: Componente optimizado para markers con control de tracksViewChanges
const OptimizedMapMarker = memo(({
    coordinate,
    title,
    description,
    pinColor = 'red',
    isActive = false,
    onPress,
    customView = null,
    forceUpdate = false
}) => {
    // FIX: Control dinámico de tracksViewChanges solo cuando es necesario
    const [tracksViewChanges, setTracksViewChanges] = useState(false);
    
    useEffect(() => {
        // FIX: Activar tracking solo durante animaciones o cambios de contenido
        if (forceUpdate || isActive) {
            setTracksViewChanges(true);
            // FIX: Desactivar después de que el render se complete
            const timeout = setTimeout(() => {
                setTracksViewChanges(false);
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [forceUpdate, isActive]);

    // FIX: Para markers estáticos, nunca activar tracksViewChanges
    const shouldTrackViews = customView ? tracksViewChanges : false;

    return (
        <Marker
            coordinate={coordinate}
            title={title}
            description={description}
            pinColor={pinColor}
            onPress={onPress}
            tracksViewChanges={shouldTrackViews} // FIX: Control dinámico
            anchor={{ x: 0.5, y: 1 }}
            calloutAnchor={{ x: 0.5, y: 0 }}
        >
            {customView && (
                <View style={styles.customMarker}>
                    {customView}
                </View>
            )}
        </Marker>
    );
}, (prevProps, nextProps) => {
    // FIX: Optimización con memo para evitar re-renders innecesarios
    return (
        prevProps.coordinate.latitude === nextProps.coordinate.latitude &&
        prevProps.coordinate.longitude === nextProps.coordinate.longitude &&
        prevProps.title === nextProps.title &&
        prevProps.description === nextProps.description &&
        prevProps.pinColor === nextProps.pinColor &&
        prevProps.isActive === nextProps.isActive &&
        prevProps.forceUpdate === nextProps.forceUpdate
    );
});

const styles = StyleSheet.create({
    customMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    }
});

export default OptimizedMapMarker;