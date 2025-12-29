/**
 * FIX: Suite de pruebas E2E para optimizaciones de mapas
 * Ejecutar: npm run test:e2e maps.optimization
 */

import { device, element, by, expect as detoxExpect } from 'detox';

describe('Maps Optimization E2E Tests', () => {
    beforeAll(async () => {
        await device.launchApp({
            permissions: {
                location: 'always',
                notifications: 'YES'
            },
            launchArgs: {
                detoxPrintBusyIdleResources: 'YES'
            }
        });
    });

    beforeEach(async () => {
        await device.reloadReactNative();
    });

    describe('Performance Tests', () => {
        // FIX: Test de FPS con múltiples markers
        it('should maintain 55+ FPS with 50 markers', async () => {
            // Login como delivery
            await element(by.id('login-delivery-button')).tap();
            await element(by.id('email-input')).typeText('delivery@test.com');
            await element(by.id('password-input')).typeText('Test123!');
            await element(by.id('login-submit')).tap();
            
            // Esperar que el mapa cargue
            await detoxExpect(element(by.id('delivery-map'))).toBeVisible();
            await device.takeScreenshot('map-loaded');
            
            // Simular 50 markers
            await element(by.id('debug-add-markers-50')).tap();
            
            // Realizar gestos de pan y zoom
            await element(by.id('delivery-map')).swipe('left', 'fast');
            await element(by.id('delivery-map')).swipe('right', 'fast');
            await element(by.id('delivery-map')).pinch(1.5); // Zoom in
            await element(by.id('delivery-map')).pinch(0.5); // Zoom out
            
            // Verificar FPS counter
            await detoxExpect(element(by.id('fps-counter'))).toHaveText('FPS: 55+');
            await device.takeScreenshot('performance-50-markers');
        });

        // FIX: Test de clustering
        it('should activate clustering with 20+ markers', async () => {
            await element(by.id('debug-add-markers-25')).tap();
            
            // Verificar que los clusters aparecen
            await detoxExpect(element(by.text('25')).atIndex(0)).toBeVisible();
            
            // Zoom in para deshacer clusters
            await element(by.id('delivery-map')).pinch(2.0);
            
            // Verificar que los markers individuales aparecen
            await detoxExpect(element(by.id('marker-0'))).toBeVisible();
            await device.takeScreenshot('clustering-active');
        });

        // FIX: Test de debounce en región
        it('should debounce region changes', async () => {
            // Realizar múltiples cambios rápidos de región
            for (let i = 0; i < 5; i++) {
                await element(by.id('delivery-map')).swipe('left', 'fast', 0.2);
            }
            
            // Verificar que solo se ejecutó una llamada después del debounce
            await detoxExpect(element(by.id('region-change-count'))).toHaveText('1');
        });
    });

    describe('Permission Tests', () => {
        // FIX: Test de permisos de ubicación
        it('should request location permissions correctly', async () => {
            // Reiniciar app sin permisos
            await device.launchApp({
                permissions: { location: 'never' },
                newInstance: true
            });
            
            await element(by.id('login-delivery-button')).tap();
            
            // Verificar que aparece el diálogo de permisos
            await detoxExpect(element(by.text('RapiGoo necesita tu ubicación'))).toBeVisible();
            
            // Denegar permisos
            await element(by.text('Cancelar')).tap();
            
            // Verificar fallback a ubicación por defecto
            await detoxExpect(element(by.id('location-status'))).toHaveText('Usando ubicación aproximada');
        });

        // FIX: Test de GPS deshabilitado
        it('should handle disabled GPS gracefully', async () => {
            // Simular GPS deshabilitado
            await device.setLocation(null);
            
            await element(by.id('refresh-location')).tap();
            
            // Verificar mensaje de error
            await detoxExpect(element(by.text('GPS Deshabilitado'))).toBeVisible();
            
            // Verificar opción de ubicación por defecto
            await element(by.text('Usar ubicación aproximada')).tap();
            await detoxExpect(element(by.id('delivery-map'))).toBeVisible();
        });
    });

    describe('Network & Error Handling', () => {
        // FIX: Test con red pobre
        it('should handle poor network conditions', async () => {
            // Simular red lenta
            await device.setURLBlacklist(['.*maps.googleapis.com/maps/api/staticmap.*']);
            
            // Intentar cargar pedidos
            await element(by.id('load-orders-button')).tap();
            
            // Verificar timeout y retry
            await detoxExpect(element(by.id('loading-indicator'))).toBeVisible();
            await device.wait(3000);
            
            // Verificar mensaje de retry
            await detoxExpect(element(by.text('Reintentando...'))).toBeVisible();
            
            // Restaurar red
            await device.clearURLBlacklist();
        });

        // FIX: Test de recuperación de errores
        it('should recover from map loading errors', async () => {
            // Simular error de carga
            await device.launchApp({
                launchArgs: { simulateMapError: 'YES' }
            });
            
            // Verificar mensaje de error
            await detoxExpect(element(by.id('map-error-message'))).toBeVisible();
            
            // Reintentar carga
            await element(by.id('retry-map-load')).tap();
            
            // Verificar que el mapa se carga correctamente
            await detoxExpect(element(by.id('delivery-map'))).toBeVisible();
        });
    });

    describe('Background Tracking', () => {
        // FIX: Test de tracking en background
        it('should continue tracking in background', async () => {
            // Iniciar delivery
            await element(by.id('start-delivery-button')).tap();
            
            // Enviar app a background
            await device.sendToHome();
            await device.wait(5000);
            
            // Volver a la app
            await device.launchApp({ newInstance: false });
            
            // Verificar que el tracking continuó
            await detoxExpect(element(by.id('tracking-status'))).toHaveText('Activo');
            await detoxExpect(element(by.id('location-updates-count'))).not.toHaveText('0');
        });

        // FIX: Test de foreground service (Android)
        it('should show foreground notification on Android', async () => {
            if (device.getPlatform() === 'android') {
                await element(by.id('start-delivery-button')).tap();
                
                // Verificar notificación
                await device.openNotificationShade();
                await detoxExpect(element(by.text('RapiGoo Delivery'))).toBeVisible();
                await detoxExpect(element(by.text('Rastreando ubicación para entrega'))).toBeVisible();
                
                await device.pressBack();
            }
        });
    });

    describe('Memory & Performance', () => {
        // FIX: Test de memoria con uso prolongado
        it('should not leak memory with extended use', async () => {
            const initialMemory = await element(by.id('memory-usage')).getText();
            
            // Simular uso intensivo
            for (let i = 0; i < 10; i++) {
                // Añadir y quitar markers
                await element(by.id('debug-add-markers-50')).tap();
                await element(by.id('debug-clear-markers')).tap();
                
                // Cambiar región múltiples veces
                await element(by.id('delivery-map')).swipe('left', 'fast');
                await element(by.id('delivery-map')).swipe('right', 'fast');
            }
            
            const finalMemory = await element(by.id('memory-usage')).getText();
            
            // Verificar que la memoria no aumentó significativamente
            const memoryIncrease = parseInt(finalMemory) - parseInt(initialMemory);
            expect(memoryIncrease).toBeLessThan(50); // MB
        });

        // FIX: Test de rotación de pantalla
        it('should handle orientation changes without crashes', async () => {
            if (device.getPlatform() === 'ios') {
                await device.setOrientation('landscape');
                await detoxExpect(element(by.id('delivery-map'))).toBeVisible();
                
                await device.setOrientation('portrait');
                await detoxExpect(element(by.id('delivery-map'))).toBeVisible();
                
                // Verificar que los markers se mantienen
                await detoxExpect(element(by.id('marker-count'))).toHaveText('25');
            }
        });
    });

    describe('Stress Tests', () => {
        // FIX: Test con 200+ markers
        it('should handle 200+ markers with clustering', async () => {
            await element(by.id('debug-add-markers-200')).tap();
            
            // Verificar clustering activo
            await detoxExpect(element(by.id('cluster-count'))).not.toHaveText('0');
            
            // Realizar operaciones de zoom
            for (let i = 0; i < 3; i++) {
                await element(by.id('delivery-map')).pinch(1.5);
                await device.wait(500);
                await element(by.id('delivery-map')).pinch(0.5);
                await device.wait(500);
            }
            
            // Verificar que no hay crash
            await detoxExpect(element(by.id('delivery-map'))).toBeVisible();
            await device.takeScreenshot('stress-test-200-markers');
        });

        // FIX: Test de cambios rápidos de estado
        it('should handle rapid state changes', async () => {
            // Cambiar disponibilidad rápidamente
            for (let i = 0; i < 10; i++) {
                await element(by.id('availability-toggle')).tap();
                await device.wait(100);
            }
            
            // Verificar estado final consistente
            await detoxExpect(element(by.id('availability-status'))).toExist();
        });
    });

    afterAll(async () => {
        // Generar reporte de performance
        await element(by.id('generate-performance-report')).tap();
        await device.takeScreenshot('performance-report');
    });
});

// FIX: Configuración de pruebas manuales
export const MANUAL_TEST_CHECKLIST = {
    performance: [
        '✓ Verificar FPS con 50+ markers durante pan/zoom',
        '✓ Confirmar activación de clustering con 20+ markers',
        '✓ Validar debounce de 350ms en cambios de región',
        '✓ Medir tiempo de carga inicial del mapa (< 2s)',
        '✓ Verificar uso de memoria < 150MB con uso normal'
    ],
    permissions: [
        '✓ Probar flujo completo de permisos en instalación limpia',
        '✓ Verificar textos en español de permisos',
        '✓ Confirmar funcionamiento con ubicación aproximada',
        '✓ Validar solicitud de permisos de background (Android)',
        '✓ Verificar comportamiento con GPS deshabilitado'
    ],
    network: [
        '✓ Probar con conexión 3G/Edge',
        '✓ Verificar timeouts y reintentos',
        '✓ Confirmar funcionamiento offline básico',
        '✓ Validar recuperación al restaurar conexión'
    ],
    background: [
        '✓ Verificar tracking continúa en background (5-15 min)',
        '✓ Confirmar notificación de foreground service (Android)',
        '✓ Validar consumo de batería < 5% por hora',
        '✓ Probar con app killer/optimizador de batería'
    ],
    stress: [
        '✓ Cargar 200+ pedidos/markers',
        '✓ Uso continuo por 30+ minutos',
        '✓ Cambios rápidos de orientación',
        '✓ Multitasking con otras apps pesadas'
    ]
};