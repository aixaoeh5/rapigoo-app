// utils/coordinateValidator.js

/**
 * Utilidad para validación robusta de coordenadas GPS
 * Previene crashes por datos corruptos del backend
 */

export class CoordinateValidator {
  
  /**
   * Valida si un par de coordenadas es válido para usar en mapas
   * @param {Array|Object} coords - Coordenadas en formato [lng, lat] o {latitude, longitude}
   * @returns {boolean} - true si las coordenadas son válidas
   */
  static isValid(coords) {
    if (!coords) {
      console.warn('🗺️ Coordenadas nulas o undefined');
      return false;
    }

    let lat, lng;

    // Manejar diferentes formatos de coordenadas
    if (Array.isArray(coords)) {
      // Formato MongoDB: [longitude, latitude]
      if (coords.length !== 2) {
        console.warn('🗺️ Array de coordenadas debe tener exactamente 2 elementos:', coords);
        return false;
      }
      [lng, lat] = coords;
    } else if (typeof coords === 'object') {
      // Formato objeto: {latitude, longitude}
      lat = coords.latitude || coords.lat;
      lng = coords.longitude || coords.lng || coords.long;
    } else {
      console.warn('🗺️ Formato de coordenadas no reconocido:', typeof coords, coords);
      return false;
    }

    // Verificar que son números
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      console.warn('🗺️ Coordenadas deben ser números:', { lat: typeof lat, lng: typeof lng });
      return false;
    }

    // Verificar que no son NaN o Infinity
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('🗺️ Coordenadas contienen valores no finitos:', { lat, lng });
      return false;
    }

    // Verificar rangos válidos
    if (lat < -90 || lat > 90) {
      console.warn('🗺️ Latitud fuera del rango válido (-90 a 90):', lat);
      return false;
    }

    if (lng < -180 || lng > 180) {
      console.warn('🗺️ Longitud fuera del rango válido (-180 a 180):', lng);
      return false;
    }

    // Verificar que no son exactamente [0, 0] (posible error)
    if (lat === 0 && lng === 0) {
      console.warn('🗺️ Coordenadas [0, 0] detectadas - posible error de datos');
      return false;
    }

    return true;
  }

  /**
   * Normaliza coordenadas a formato estándar {latitude, longitude}
   * @param {Array|Object} coords - Coordenadas en cualquier formato
   * @returns {Object|null} - Coordenadas normalizadas o null si inválidas
   */
  static normalize(coords) {
    if (!this.isValid(coords)) {
      return null;
    }

    let lat, lng;

    if (Array.isArray(coords)) {
      [lng, lat] = coords; // MongoDB format
    } else {
      lat = coords.latitude || coords.lat;
      lng = coords.longitude || coords.lng || coords.long;
    }

    return {
      latitude: lat,
      longitude: lng
    };
  }

  /**
   * Convierte coordenadas al formato de MongoDB [longitude, latitude]
   * @param {Array|Object} coords - Coordenadas en cualquier formato
   * @returns {Array|null} - Array [lng, lat] o null si inválidas
   */
  static toMongoFormat(coords) {
    const normalized = this.normalize(coords);
    if (!normalized) {
      return null;
    }

    return [normalized.longitude, normalized.latitude];
  }

  /**
   * Valida y limpia un array de coordenadas
   * @param {Array} coordsArray - Array de coordenadas
   * @returns {Array} - Array filtrado con solo coordenadas válidas
   */
  static filterValid(coordsArray) {
    if (!Array.isArray(coordsArray)) {
      console.warn('🗺️ Se esperaba un array de coordenadas:', typeof coordsArray);
      return [];
    }

    return coordsArray
      .filter(coords => this.isValid(coords))
      .map(coords => this.normalize(coords));
  }

  /**
   * Valida coordenadas específicamente para República Dominicana
   * @param {Array|Object} coords - Coordenadas a validar
   * @returns {boolean} - true si están dentro del área de RD
   */
  static isValidForDR(coords) {
    if (!this.isValid(coords)) {
      return false;
    }

    const normalized = this.normalize(coords);
    const { latitude, longitude } = normalized;

    // Límites aproximados de República Dominicana
    const DR_BOUNDS = {
      north: 19.9,    // Norte
      south: 17.4,    // Sur  
      east: -68.3,    // Este
      west: -72.0     // Oeste
    };

    const isInBounds = 
      latitude >= DR_BOUNDS.south && 
      latitude <= DR_BOUNDS.north &&
      longitude >= DR_BOUNDS.west && 
      longitude <= DR_BOUNDS.east;

    if (!isInBounds) {
      console.warn('🗺️ Coordenadas fuera de República Dominicana:', normalized);
    }

    return isInBounds;
  }

  /**
   * Obtiene coordenadas por defecto para República Dominicana (Santo Domingo)
   * @returns {Object} - Coordenadas por defecto
   */
  static getDefaultDRCoords() {
    return {
      latitude: 18.4861,   // Santo Domingo
      longitude: -69.9312  // Santo Domingo
    };
  }

  /**
   * Intenta reparar coordenadas corruptas
   * @param {any} coords - Coordenadas posiblemente corruptas
   * @returns {Object|null} - Coordenadas reparadas o null
   */
  static attemptRepair(coords) {
    if (this.isValid(coords)) {
      return this.normalize(coords);
    }

    console.log('🔧 Intentando reparar coordenadas:', coords);

    // Intentar extraer números de strings
    if (typeof coords === 'string') {
      try {
        const parsed = JSON.parse(coords);
        if (this.isValid(parsed)) {
          return this.normalize(parsed);
        }
      } catch (e) {
        // Intentar extraer números con regex
        const numbers = coords.match(/-?\d+\.?\d*/g);
        if (numbers && numbers.length >= 2) {
          const lat = parseFloat(numbers[0]);
          const lng = parseFloat(numbers[1]);
          const repaired = { latitude: lat, longitude: lng };
          if (this.isValid(repaired)) {
            console.log('✅ Coordenadas reparadas desde string:', repaired);
            return repaired;
          }
        }
      }
    }

    // Intentar reparar arrays con elementos faltantes
    if (Array.isArray(coords)) {
      const cleanCoords = coords
        .filter(val => typeof val === 'number' && Number.isFinite(val))
        .slice(0, 2);
      
      if (cleanCoords.length === 2) {
        const [lng, lat] = cleanCoords;
        const repaired = { latitude: lat, longitude: lng };
        if (this.isValid(repaired)) {
          console.log('✅ Coordenadas reparadas desde array:', repaired);
          return repaired;
        }
      }
    }

    // Intentar reparar objetos con propiedades mal nombradas
    if (typeof coords === 'object' && coords !== null) {
      const possibleLat = coords.latitude || coords.lat || coords.y || coords.Latitude;
      const possibleLng = coords.longitude || coords.lng || coords.long || coords.x || coords.Longitude;
      
      if (typeof possibleLat === 'number' && typeof possibleLng === 'number') {
        const repaired = { latitude: possibleLat, longitude: possibleLng };
        if (this.isValid(repaired)) {
          console.log('✅ Coordenadas reparadas desde objeto:', repaired);
          return repaired;
        }
      }
    }

    console.warn('❌ No se pudieron reparar las coordenadas:', coords);
    return null;
  }

  /**
   * Valida y obtiene coordenadas seguras con fallback
   * @param {any} coords - Coordenadas a validar
   * @param {Object} fallback - Coordenadas de fallback
   * @returns {Object} - Coordenadas válidas garantizadas
   */
  static getSafeCoords(coords, fallback = null) {
    // Intentar usar las coordenadas proporcionadas
    const normalized = this.normalize(coords);
    if (normalized) {
      return normalized;
    }

    // Intentar reparar
    const repaired = this.attemptRepair(coords);
    if (repaired) {
      return repaired;
    }

    // Usar fallback proporcionado
    if (fallback && this.isValid(fallback)) {
      console.log('⚠️ Usando coordenadas de fallback:', fallback);
      return this.normalize(fallback);
    }

    // Usar coordenadas por defecto de RD
    console.log('⚠️ Usando coordenadas por defecto de Santo Domingo');
    return this.getDefaultDRCoords();
  }

  /**
   * Calcula la distancia entre dos coordenadas usando la fórmula de Haversine
   * @param {Object} coords1 - Primera coordenada
   * @param {Object} coords2 - Segunda coordenada
   * @returns {number|null} - Distancia en metros o null si coordenadas inválidas
   */
  static calculateDistance(coords1, coords2) {
    const c1 = this.normalize(coords1);
    const c2 = this.normalize(coords2);
    
    if (!c1 || !c2) {
      console.warn('🗺️ No se puede calcular distancia con coordenadas inválidas');
      return null;
    }

    const R = 6371000; // Radio de la Tierra en metros
    const lat1Rad = c1.latitude * Math.PI / 180;
    const lat2Rad = c2.latitude * Math.PI / 180;
    const deltaLat = (c2.latitude - c1.latitude) * Math.PI / 180;
    const deltaLng = (c2.longitude - c1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distancia en metros
  }

  /**
   * Verifica si una ubicación está dentro de un radio específico de otra
   * @param {Object} center - Coordenadas del centro
   * @param {Object} point - Coordenadas del punto a verificar
   * @param {number} radiusMeters - Radio en metros
   * @returns {boolean|null} - true/false o null si coordenadas inválidas
   */
  static isWithinRadius(center, point, radiusMeters = 100) {
    const distance = this.calculateDistance(center, point);
    if (distance === null) {
      return null;
    }
    return distance <= radiusMeters;
  }
}

// Funciones de conveniencia para mantener compatibilidad
export const validateCoordinates = (coords) => CoordinateValidator.isValid(coords);
export const normalizeCoordinates = (coords) => CoordinateValidator.normalize(coords);
export const getSafeCoordinates = (coords, fallback) => CoordinateValidator.getSafeCoords(coords, fallback);

export default CoordinateValidator;