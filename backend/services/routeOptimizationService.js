// services/routeOptimizationService.js
const axios = require('axios');

class RouteOptimizationService {
  constructor() {
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
  }

  /**
   * Optimiza una ruta con múltiples waypoints usando Google Directions API
   * @param {Array} waypoints - Array de coordenadas [{lat, lng}, ...]
   * @param {Object} options - Opciones de optimización
   * @returns {Object} Ruta optimizada
   */
  async optimizeRoute(waypoints, options = {}) {
    try {
      if (!this.googleMapsApiKey) {
        console.warn('Google Maps API key not configured, using basic optimization');
        return this.basicOptimization(waypoints, options);
      }

      if (waypoints.length < 2) {
        throw new Error('Se requieren al menos 2 waypoints para optimizar la ruta');
      }

      const origin = waypoints[0];
      const destination = waypoints[waypoints.length - 1];
      const intermediateWaypoints = waypoints.slice(1, -1);

      const params = {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        key: this.googleMapsApiKey,
        mode: options.mode || 'driving',
        units: 'metric',
        language: 'es',
        optimize: options.optimize !== false, // Optimizar por defecto
        avoid: options.avoid || '', // tolls, highways, ferries
      };

      // Agregar waypoints intermedios si existen
      if (intermediateWaypoints.length > 0) {
        const waypointsStr = intermediateWaypoints
          .map(wp => `${wp.lat},${wp.lng}`)
          .join('|');
        
        params.waypoints = options.optimize !== false 
          ? `optimize:true|${waypointsStr}`
          : waypointsStr;
      }

      const response = await axios.get(this.baseUrl, { params });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Directions API error: ${response.data.status}`);
      }

      return this.parseGoogleDirectionsResponse(response.data, waypoints);

    } catch (error) {
      console.error('Error optimizing route:', error);
      
      // Fallback a optimización básica si falla la API de Google
      if (error.response?.status === 403 || error.response?.status === 429) {
        console.warn('Google API limit reached, using basic optimization');
        return this.basicOptimization(waypoints, options);
      }
      
      throw error;
    }
  }

  /**
   * Optimización básica sin API externa
   * Ordena los waypoints por proximidad (algoritmo del vecino más cercano)
   */
  basicOptimization(waypoints, options = {}) {
    if (waypoints.length < 2) {
      throw new Error('Se requieren al menos 2 waypoints');
    }

    let optimizedWaypoints = [...waypoints];
    let totalDistance = 0;
    let totalDuration = 0;

    // Si hay más de 2 waypoints, optimizar el orden
    if (waypoints.length > 2 && options.optimize !== false) {
      optimizedWaypoints = this.nearestNeighborOptimization(waypoints);
    }

    // Calcular distancias y duraciones
    const legs = [];
    for (let i = 0; i < optimizedWaypoints.length - 1; i++) {
      const start = optimizedWaypoints[i];
      const end = optimizedWaypoints[i + 1];
      
      const distance = this.calculateDistance(start.lat, start.lng, end.lat, end.lng);
      const duration = this.estimateDuration(distance, options.mode || 'driving');
      
      totalDistance += distance;
      totalDuration += duration;
      
      legs.push({
        start_location: start,
        end_location: end,
        distance: { value: Math.round(distance * 1000), text: `${distance.toFixed(1)} km` },
        duration: { value: Math.round(duration), text: this.formatDuration(duration) },
        steps: [{
          html_instructions: `Dirigirse hacia ${end.address || 'destino'}`,
          distance: { value: Math.round(distance * 1000), text: `${distance.toFixed(1)} km` },
          duration: { value: Math.round(duration), text: this.formatDuration(duration) }
        }]
      });
    }

    return {
      status: 'OK',
      routes: [{
        legs,
        overview_polyline: { points: '' }, // Sin polyline en optimización básica
        summary: 'Ruta optimizada básica',
        waypoint_order: optimizedWaypoints.map((_, index) => index),
        warnings: options.optimize === false ? [] : ['Ruta optimizada usando algoritmo básico']
      }],
      optimized: true,
      method: 'basic',
      totalDistance: Math.round(totalDistance * 1000), // en metros
      totalDuration: Math.round(totalDuration), // en segundos
      estimatedTime: this.formatDuration(totalDuration)
    };
  }

  /**
   * Algoritmo del vecino más cercano para optimización básica
   */
  nearestNeighborOptimization(waypoints) {
    if (waypoints.length <= 2) return waypoints;

    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];
    const intermediate = waypoints.slice(1, -1);
    
    const optimized = [start];
    const unvisited = [...intermediate];
    let current = start;

    // Encontrar el waypoint más cercano en cada iteración
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = this.calculateDistance(
        current.lat, current.lng,
        unvisited[0].lat, unvisited[0].lng
      );

      for (let i = 1; i < unvisited.length; i++) {
        const distance = this.calculateDistance(
          current.lat, current.lng,
          unvisited[i].lat, unvisited[i].lng
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      current = unvisited[nearestIndex];
      optimized.push(current);
      unvisited.splice(nearestIndex, 1);
    }

    optimized.push(end);
    return optimized;
  }

  /**
   * Parsea la respuesta de Google Directions API
   */
  parseGoogleDirectionsResponse(data, originalWaypoints) {
    const route = data.routes[0];
    
    return {
      status: data.status,
      routes: data.routes,
      optimized: true,
      method: 'google_directions_api',
      totalDistance: route.legs.reduce((sum, leg) => sum + leg.distance.value, 0),
      totalDuration: route.legs.reduce((sum, leg) => sum + leg.duration.value, 0),
      estimatedTime: this.formatDuration(
        route.legs.reduce((sum, leg) => sum + leg.duration.value, 0)
      ),
      waypoint_order: route.waypoint_order || [],
      overview_polyline: route.overview_polyline?.points || ''
    };
  }

  /**
   * Calcula la distancia entre dos puntos usando la fórmula de Haversine
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Estima la duración del viaje basada en la distancia y modo de transporte
   */
  estimateDuration(distanceKm, mode = 'driving') {
    const speeds = {
      driving: 40, // km/h promedio en ciudad
      walking: 5,  // km/h
      bicycling: 15, // km/h
      transit: 25   // km/h promedio
    };

    const speed = speeds[mode] || speeds.driving;
    return (distanceKm / speed) * 3600; // convertir horas a segundos
  }

  /**
   * Formatea la duración en segundos a texto legible
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    
    return `${minutes}min`;
  }

  /**
   * Convierte grados a radianes
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Obtiene la ruta más rápida entre dos puntos
   */
  async getFastestRoute(origin, destination, options = {}) {
    return this.optimizeRoute([origin, destination], {
      ...options,
      optimize: false // No optimizar orden para solo 2 puntos
    });
  }

  /**
   * Calcula múltiples rutas alternativas
   */
  async getAlternativeRoutes(origin, destination, options = {}) {
    try {
      if (!this.googleMapsApiKey) {
        return this.basicOptimization([origin, destination], options);
      }

      const params = {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        key: this.googleMapsApiKey,
        alternatives: true,
        mode: options.mode || 'driving',
        units: 'metric',
        language: 'es'
      };

      const response = await axios.get(this.baseUrl, { params });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Directions API error: ${response.data.status}`);
      }

      return this.parseGoogleDirectionsResponse(response.data, [origin, destination]);

    } catch (error) {
      console.error('Error getting alternative routes:', error);
      return this.basicOptimization([origin, destination], options);
    }
  }
}

module.exports = new RouteOptimizationService();