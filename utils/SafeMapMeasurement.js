/**
 * FIX: Reemplazo seguro para mapRef.current.measure()
 * Proporciona alternativas compatibles con react-native-maps
 */

import React from 'react';

export class SafeMapMeasurement {
    
    /**
     * Reemplazo principal para mapRef.current.measure()
     * @param {Object} mapRef - Referencia del MapView
     * @param {Function} callback - Callback con (x, y, width, height, pageX, pageY)
     * @param {Object} fallbackDimensions - Dimensiones por defecto
     */
    static measureMap(mapRef, callback, fallbackDimensions = { width: 300, height: 400, x: 0, y: 0 }) {
        // Verificar que tenemos una referencia válida
        if (!mapRef?.current) {
            console.warn('⚠️ SafeMapMeasurement: mapRef is null, using fallback dimensions');
            callback(
                fallbackDimensions.x, 
                fallbackDimensions.y, 
                fallbackDimensions.width, 
                fallbackDimensions.height, 
                fallbackDimensions.x, 
                fallbackDimensions.y
            );
            return;
        }

        // Estrategia 1: Intentar usar método nativo (si existe)
        if (typeof mapRef.current.measure === 'function') {
            console.log('✅ Using native measure method');
            mapRef.current.measure(callback);
            return;
        }

        // Estrategia 2: Acceder al componente View subyacente
        try {
            if (mapRef.current._component?.measure) {
                console.log('✅ Using underlying View component measure');
                mapRef.current._component.measure(callback);
                return;
            }
        } catch (error) {
            console.log('⚠️ Could not access underlying View component:', error.message);
        }

        // Estrategia 3: Buscar en la jerarquía de componentes
        try {
            const possibleViewRefs = [
                mapRef.current._nativeTag,
                mapRef.current.getNode?.(),
                mapRef.current._root,
                mapRef.current._reactInternalFiber?.child?.stateNode
            ].filter(Boolean);

            for (const viewRef of possibleViewRefs) {
                if (viewRef?.measure && typeof viewRef.measure === 'function') {
                    console.log('✅ Using found View reference in hierarchy');
                    viewRef.measure(callback);
                    return;
                }
            }
        } catch (error) {
            console.log('⚠️ Could not find View in component hierarchy:', error.message);
        }

        // Estrategia 4: Usar estimación basada en pantalla
        console.log('⚠️ Using screen-based estimation for map dimensions');
        this.estimateMapDimensions(callback);
    }

    /**
     * Estimación de dimensiones basada en la pantalla
     */
    static estimateMapDimensions(callback) {
        const { Dimensions } = require('react-native');
        const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
        
        // Estimar dimensiones típicas del mapa (pantalla completa menos UI)
        const estimatedWidth = screenWidth;
        const estimatedHeight = screenHeight - 150; // Restar espacio de UI (header, buttons, etc.)
        
        console.log('📐 Estimated map dimensions:', { 
            width: estimatedWidth, 
            height: estimatedHeight, 
            screenWidth, 
            screenHeight 
        });
        
        callback(0, 100, estimatedWidth, estimatedHeight, 0, 100);
    }

    /**
     * Método alternativo usando onLayout
     * Retorna props para añadir al MapView
     */
    static createLayoutHandler(callback) {
        return {
            onLayout: (event) => {
                const { width, height, x, y } = event.nativeEvent.layout;
                console.log('📐 MapView onLayout dimensions:', { width, height, x, y });
                
                // Simular el formato de measure callback
                callback(x, y, width, height, x, y);
            }
        };
    }

    /**
     * Wrapper para casos donde se necesita medir múltiples veces
     */
    static createMeasurementCache() {
        let cachedDimensions = null;
        let layoutHandler = null;

        return {
            // Configurar el handler de layout
            setupLayoutHandler: (callback) => {
                layoutHandler = this.createLayoutHandler((x, y, width, height, pageX, pageY) => {
                    cachedDimensions = { x, y, width, height, pageX, pageY };
                    callback(x, y, width, height, pageX, pageY);
                });
                return layoutHandler;
            },

            // Obtener dimensiones (usar cache si está disponible)
            getMeasurements: (mapRef, callback, useCache = true) => {
                if (useCache && cachedDimensions) {
                    console.log('📐 Using cached map dimensions');
                    const { x, y, width, height, pageX, pageY } = cachedDimensions;
                    callback(x, y, width, height, pageX, pageY);
                    return;
                }

                this.measureMap(mapRef, callback);
            },

            // Limpiar cache
            clearCache: () => {
                cachedDimensions = null;
            }
        };
    }

    /**
     * Método específico para verificar si el mapa tiene dimensiones válidas
     */
    static validateMapDimensions(mapRef, callback) {
        this.measureMap(mapRef, (x, y, width, height, pageX, pageY) => {
            const isValid = width > 0 && height > 0;
            
            if (isValid) {
                console.log('✅ Map has valid dimensions:', { width, height });
            } else {
                console.error('❌ Map has invalid dimensions:', { width, height });
            }

            callback({
                isValid,
                dimensions: { x, y, width, height, pageX, pageY }
            });
        });
    }
}

// Hook para usar medición segura en componentes funcionales
export const useSafeMapMeasurement = (mapRef) => {
    const [dimensions, setDimensions] = React.useState(null);
    const measurementCache = React.useRef(SafeMapMeasurement.createMeasurementCache());

    const measureMap = React.useCallback((callback) => {
        measurementCache.current.getMeasurements(mapRef, (x, y, width, height, pageX, pageY) => {
            const newDimensions = { x, y, width, height, pageX, pageY };
            setDimensions(newDimensions);
            callback?.(x, y, width, height, pageX, pageY);
        });
    }, [mapRef]);

    const layoutProps = React.useMemo(() => {
        return measurementCache.current.setupLayoutHandler((x, y, width, height, pageX, pageY) => {
            setDimensions({ x, y, width, height, pageX, pageY });
        });
    }, []);

    return {
        dimensions,
        measureMap,
        layoutProps, // Para añadir al MapView: {...layoutProps}
        isValidDimensions: dimensions && dimensions.width > 0 && dimensions.height > 0
    };
};

export default SafeMapMeasurement;