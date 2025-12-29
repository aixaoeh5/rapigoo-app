import { useCallback, useRef, useMemo } from 'react';

// FIX: Hook personalizado para debounce de región con guards
export const useMapRegionDebounce = (callback, delay = 300) => {
    const timeoutRef = useRef(null);
    const lastRegionRef = useRef(null);
    const isMountedRef = useRef(true);

    // FIX: Función para verificar si la región cambió significativamente
    const hasRegionChangedSignificantly = (newRegion, oldRegion, threshold = 0.001) => {
        if (!oldRegion) return true;
        
        const latDiff = Math.abs(newRegion.latitude - oldRegion.latitude);
        const lonDiff = Math.abs(newRegion.longitude - oldRegion.longitude);
        const latDeltaDiff = Math.abs(newRegion.latitudeDelta - oldRegion.latitudeDelta);
        const lonDeltaDiff = Math.abs(newRegion.longitudeDelta - oldRegion.longitudeDelta);
        
        return latDiff > threshold || 
               lonDiff > threshold || 
               latDeltaDiff > threshold * 10 || 
               lonDeltaDiff > threshold * 10;
    };

    const debouncedCallback = useMemo(() => {
        return (region, details = {}) => {
            // FIX: Guard para evitar bucles - solo procesar gestos del usuario
            if (!details?.isGesture) {
                console.log('⚠️ Cambio de región programático ignorado');
                return;
            }

            // FIX: Verificar si el componente sigue montado
            if (!isMountedRef.current) return;

            // FIX: Verificar si la región cambió significativamente
            if (!hasRegionChangedSignificantly(region, lastRegionRef.current)) {
                console.log('⚠️ Cambio de región insignificante ignorado');
                return;
            }

            // Limpiar timeout anterior
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // FIX: Establecer nuevo timeout con debounce
            timeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    lastRegionRef.current = region;
                    callback(region, details);
                }
            }, delay);
        };
    }, [callback, delay]);

    // FIX: Cleanup function
    const cleanup = useCallback(() => {
        isMountedRef.current = false;
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    return { debouncedCallback, cleanup };
};

// FIX: Hook para prevenir bucles de actualización
export const useMapLoopPrevention = () => {
    const updateCountRef = useRef(0);
    const resetTimeoutRef = useRef(null);
    const MAX_UPDATES_PER_SECOND = 5;

    const checkAndPreventLoop = useCallback(() => {
        updateCountRef.current++;

        // FIX: Reset contador cada segundo
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
        }
        
        resetTimeoutRef.current = setTimeout(() => {
            updateCountRef.current = 0;
        }, 1000);

        // FIX: Prevenir bucle si hay demasiadas actualizaciones
        if (updateCountRef.current > MAX_UPDATES_PER_SECOND) {
            console.error('❌ Posible bucle detectado - bloqueando actualizaciones');
            return false;
        }

        return true;
    }, []);

    const cleanup = useCallback(() => {
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
        }
    }, []);

    return { checkAndPreventLoop, cleanup };
};