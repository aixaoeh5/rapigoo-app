/**
 * Herramienta de diagnóstico para refs de MapView
 * Ayuda a descartar hipótesis sobre APIs disponibles
 */

export const diagnoseMapRef = (mapRef, componentName = 'Unknown') => {
    console.log(`🔬 DIAGNOSTIC: Analyzing mapRef for ${componentName}`);
    
    if (!mapRef) {
        console.error(`❌ mapRef is null/undefined in ${componentName}`);
        return {
            isValid: false,
            error: 'mapRef_null',
            availableMethods: []
        };
    }

    if (!mapRef.current) {
        console.error(`❌ mapRef.current is null/undefined in ${componentName}`);
        return {
            isValid: false,
            error: 'mapRef_current_null',
            availableMethods: []
        };
    }

    // Investigar qué métodos están disponibles
    const ref = mapRef.current;
    const availableMethods = [];
    const commonMapMethods = [
        // react-native-maps métodos
        'animateToRegion',
        'animateToCoordinate', 
        'fitToElements',
        'fitToSuppliedMarkers',
        'fitToCoordinates',
        'getMapBoundaries',
        'setMapBoundaries',
        'coordinateForPoint',
        'pointForCoordinate',
        'getMarkersFrames',
        'setIndoorActiveLevelIndex',
        
        // React Native View métodos (NO deberían estar en MapView)
        'measure',
        'measureInWindow',
        'measureLayout',
        'setNativeProps',
        'focus',
        'blur'
    ];

    commonMapMethods.forEach(method => {
        if (typeof ref[method] === 'function') {
            availableMethods.push(method);
        }
    });

    // Obtener todos los métodos y propiedades
    const allKeys = Object.getOwnPropertyNames(ref);
    const allMethods = allKeys.filter(key => typeof ref[key] === 'function');
    
    console.log(`🔍 Available methods in ${componentName}:`, availableMethods);
    console.log(`🔍 All methods found:`, allMethods);
    console.log(`🔍 Ref constructor:`, ref.constructor.name);
    console.log(`🔍 Ref prototype:`, Object.getPrototypeOf(ref).constructor.name);

    // Verificar específicamente measure
    const hasMeasure = typeof ref.measure === 'function';
    console.log(`🎯 Has 'measure' method: ${hasMeasure}`);
    
    if (!hasMeasure) {
        console.log(`✅ CONFIRMED: 'measure' is NOT available on react-native-maps MapView`);
        console.log(`💡 SUGGESTION: Use onLayout callback or react-native-maps specific methods`);
    }

    return {
        isValid: true,
        hasMeasure,
        availableMethods,
        allMethods,
        refType: ref.constructor.name,
        prototypeChain: Object.getPrototypeOf(ref).constructor.name
    };
};

// Alternativas para obtener dimensiones del mapa
export const getMapDimensionsAlternatives = {
    
    // Opción 1: Usar onLayout (RECOMENDADO)
    useOnLayout: (callback) => ({
        onLayout: (event) => {
            const { width, height, x, y } = event.nativeEvent.layout;
            console.log('📐 MapView Layout from onLayout:', { width, height, x, y });
            callback({ width, height, x, y });
        }
    }),

    // Opción 2: Wrapper View con measure
    useWrapperView: (mapRef, callback) => {
        if (mapRef?.current?._component) {
            // Intentar acceder al View nativo subyacente
            mapRef.current._component.measure?.((x, y, width, height, pageX, pageY) => {
                console.log('📐 MapView Dimensions via wrapper:', { width, height, x, y, pageX, pageY });
                callback({ width, height, x, y, pageX, pageY });
            });
        }
    },

    // Opción 3: Usar react-native-maps métodos específicos
    useMapSpecificMethods: async (mapRef) => {
        if (!mapRef?.current) return null;

        try {
            // Obtener bounds del mapa
            const boundaries = await mapRef.current.getMapBoundaries();
            console.log('🗺️ Map Boundaries:', boundaries);
            
            return boundaries;
        } catch (error) {
            console.log('⚠️ getMapBoundaries not available:', error.message);
            return null;
        }
    }
};

// Hook para diagnóstico en tiempo real
export const useMapRefDiagnostic = (mapRef, componentName) => {
    React.useEffect(() => {
        if (mapRef?.current) {
            const diagnostic = diagnoseMapRef(mapRef, componentName);
            return diagnostic;
        }
    }, [mapRef?.current]);
};