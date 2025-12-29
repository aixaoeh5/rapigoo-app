import { PerformanceObserver, performance } from 'react-native-performance';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * FIX: Monitor de performance para mapas con métricas críticas
 */
class MapPerformanceMonitor {
    constructor() {
        this.metrics = {
            mapLoadTime: null,
            markerRenderTime: [],
            regionChangeTime: [],
            clusteringTime: [],
            fps: [],
            memoryUsage: [],
            batteryDrain: null,
        };
        
        this.sessionStartTime = Date.now();
        this.markerCount = 0;
        this.errorCount = 0;
        this.thresholds = {
            TTI_TARGET: 2000, // 2 segundos Time To Interactive
            FPS_MIN: 55, // FPS mínimo aceptable
            FPS_P95: 58, // FPS percentil 95
            BATTERY_DRAIN_MAX: 5, // % máximo por hora
            MEMORY_MAX_MB: 150, // MB máximo de memoria
        };
    }

    // FIX: Medir tiempo de carga inicial del mapa
    startMapLoad() {
        performance.mark('map-load-start');
    }

    endMapLoad() {
        performance.mark('map-load-end');
        performance.measure('map-load-time', 'map-load-start', 'map-load-end');
        
        const measure = performance.getEntriesByName('map-load-time')[0];
        this.metrics.mapLoadTime = measure?.duration || 0;
        
        this.logMetric('map_load_time', this.metrics.mapLoadTime);
        
        // FIX: Alertar si supera threshold
        if (this.metrics.mapLoadTime > this.thresholds.TTI_TARGET) {
            this.logWarning('Map load time exceeded threshold', {
                actual: this.metrics.mapLoadTime,
                threshold: this.thresholds.TTI_TARGET
            });
        }
    }

    // FIX: Medir rendimiento de markers
    measureMarkerRender(count) {
        const startTime = performance.now();
        
        return () => {
            const renderTime = performance.now() - startTime;
            this.metrics.markerRenderTime.push({
                count,
                time: renderTime,
                timestamp: Date.now()
            });
            
            this.logMetric('marker_render_time', renderTime, { count });
            
            // FIX: Alertar si el render es lento
            const timePerMarker = renderTime / count;
            if (timePerMarker > 10) { // 10ms por marker máximo
                this.logWarning('Slow marker rendering detected', {
                    totalTime: renderTime,
                    markerCount: count,
                    timePerMarker
                });
            }
        };
    }

    // FIX: Medir FPS durante pan/zoom
    measureFPS(callback) {
        let frameCount = 0;
        let lastTime = performance.now();
        const fpsHistory = [];
        
        const measureFrame = () => {
            const currentTime = performance.now();
            const deltaTime = currentTime - lastTime;
            
            if (deltaTime >= 1000) { // Cada segundo
                const fps = Math.round((frameCount * 1000) / deltaTime);
                fpsHistory.push(fps);
                this.metrics.fps.push({
                    value: fps,
                    timestamp: Date.now()
                });
                
                // FIX: Verificar FPS mínimo
                if (fps < this.thresholds.FPS_MIN) {
                    this.logWarning('Low FPS detected', {
                        fps,
                        threshold: this.thresholds.FPS_MIN
                    });
                }
                
                frameCount = 0;
                lastTime = currentTime;
                
                // Calcular percentil 95
                if (fpsHistory.length >= 10) {
                    const p95 = this.calculatePercentile(fpsHistory, 95);
                    this.logMetric('fps_p95', p95);
                    fpsHistory.length = 0; // Reset
                }
            }
            
            frameCount++;
            
            if (callback) {
                requestAnimationFrame(measureFrame);
            }
        };
        
        requestAnimationFrame(measureFrame);
        
        return () => {
            callback = null; // Stop measuring
        };
    }

    // FIX: Medir tiempo de cambio de región
    measureRegionChange() {
        const startTime = performance.now();
        
        return () => {
            const changeTime = performance.now() - startTime;
            this.metrics.regionChangeTime.push({
                time: changeTime,
                timestamp: Date.now()
            });
            
            this.logMetric('region_change_time', changeTime);
        };
    }

    // FIX: Medir tiempo de clustering
    measureClustering(markerCount) {
        const startTime = performance.now();
        
        return () => {
            const clusterTime = performance.now() - startTime;
            this.metrics.clusteringTime.push({
                time: clusterTime,
                markerCount,
                timestamp: Date.now()
            });
            
            this.logMetric('clustering_time', clusterTime, { markerCount });
        };
    }

    // FIX: Monitorear uso de memoria
    measureMemory() {
        if (global.performance && global.performance.memory) {
            const memoryInfo = {
                usedJSHeapSize: global.performance.memory.usedJSHeapSize / 1048576, // Convert to MB
                totalJSHeapSize: global.performance.memory.totalJSHeapSize / 1048576,
                jsHeapSizeLimit: global.performance.memory.jsHeapSizeLimit / 1048576,
                timestamp: Date.now()
            };
            
            this.metrics.memoryUsage.push(memoryInfo);
            this.logMetric('memory_usage_mb', memoryInfo.usedJSHeapSize);
            
            // FIX: Alertar si memoria excesiva
            if (memoryInfo.usedJSHeapSize > this.thresholds.MEMORY_MAX_MB) {
                this.logWarning('High memory usage detected', {
                    usage: memoryInfo.usedJSHeapSize,
                    threshold: this.thresholds.MEMORY_MAX_MB
                });
            }
        }
    }

    // FIX: Registrar error de mapa
    logMapError(error, context = {}) {
        this.errorCount++;
        const errorData = {
            message: error.message || error,
            stack: error.stack,
            context,
            timestamp: Date.now(),
            sessionDuration: Date.now() - this.sessionStartTime
        };
        
        console.error('🗺️ Map Error:', errorData);
        this.sendTelemetry('map_error', errorData);
    }

    // FIX: Logging de métricas
    logMetric(name, value, metadata = {}) {
        const metric = {
            name,
            value,
            metadata,
            timestamp: Date.now()
        };
        
        console.log(`📊 [MapMetric] ${name}: ${value}`, metadata);
        this.sendTelemetry('map_metric', metric);
    }

    // FIX: Logging de advertencias
    logWarning(message, details = {}) {
        console.warn(`⚠️ [MapWarning] ${message}`, details);
        this.sendTelemetry('map_warning', { message, details });
    }

    // FIX: Calcular percentil
    calculatePercentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    // FIX: Generar reporte de sesión
    generateSessionReport() {
        const report = {
            sessionDuration: Date.now() - this.sessionStartTime,
            mapLoadTime: this.metrics.mapLoadTime,
            avgMarkerRenderTime: this.calculateAverage(
                this.metrics.markerRenderTime.map(m => m.time)
            ),
            avgRegionChangeTime: this.calculateAverage(
                this.metrics.regionChangeTime.map(m => m.time)
            ),
            avgFPS: this.calculateAverage(
                this.metrics.fps.map(f => f.value)
            ),
            p95FPS: this.calculatePercentile(
                this.metrics.fps.map(f => f.value),
                95
            ),
            avgMemoryUsage: this.calculateAverage(
                this.metrics.memoryUsage.map(m => m.usedJSHeapSize)
            ),
            errorCount: this.errorCount,
            timestamp: Date.now()
        };
        
        console.log('📈 Map Performance Report:', report);
        this.persistReport(report);
        
        return report;
    }

    // FIX: Calcular promedio
    calculateAverage(values) {
        if (!values || values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    // FIX: Persistir reporte
    async persistReport(report) {
        try {
            const reports = await AsyncStorage.getItem('map_performance_reports');
            const existingReports = reports ? JSON.parse(reports) : [];
            existingReports.push(report);
            
            // Mantener solo los últimos 10 reportes
            if (existingReports.length > 10) {
                existingReports.shift();
            }
            
            await AsyncStorage.setItem(
                'map_performance_reports',
                JSON.stringify(existingReports)
            );
        } catch (error) {
            console.error('Error persisting performance report:', error);
        }
    }

    // FIX: Enviar telemetría (implementar según tu backend)
    sendTelemetry(eventType, data) {
        // TODO: Implementar envío a tu servicio de analytics
        // Por ejemplo: Analytics.track(eventType, data);
    }

    // FIX: Limpiar recursos
    cleanup() {
        this.metrics = {
            mapLoadTime: null,
            markerRenderTime: [],
            regionChangeTime: [],
            clusteringTime: [],
            fps: [],
            memoryUsage: [],
            batteryDrain: null,
        };
    }
}

// FIX: Singleton instance
const mapPerformanceMonitor = new MapPerformanceMonitor();

export default mapPerformanceMonitor;