# 🔑 Guía para Obtener API Key de Google Maps

## 📋 SITUACIÓN ACTUAL

Tu API key actual: `AIzaSyDqE-L2_sObvQVl5gWlJaRVF2rIzH5Ztkg`

**Estado**: ❌ **INVÁLIDA/RESTRINGIDA** para tu proyecto
- ✅ Funciona para Maps JavaScript API básico  
- ❌ No funciona para Geocoding API
- ❌ No funciona para Places API  
- ❌ Posiblemente restringida por dominio/aplicación

## 🆓 SOLUCIÓN INMEDIATA: MAPA GRATUITO

**¡Ya implementé una solución que funciona SIN API key!**

1. Ve a: **Dashboard → Probar Mapa**
2. Selecciona: **"Free Map"** 
3. ¡Verás mapas reales usando OpenStreetMap!

**✅ Ventajas del mapa gratuito**:
- Sin límites de uso
- Sin costos
- Funciona inmediatamente  
- Marcadores interactivos
- Buena calidad de mapas

## 🔑 CÓMO OBTENER TU PROPIA API KEY (OPCIONAL)

### Paso 1: Crear Proyecto en Google Cloud Console

1. Ve a: https://console.cloud.google.com/
2. Crea una **nueva cuenta Google** o usa la existente
3. Crear **Nuevo Proyecto**:
   - Nombre: "RapigooApp"
   - Ubicación: Organización (si tienes)

### Paso 2: Habilitar APIs Necesarias

En tu proyecto, habilita estas APIs:
- ✅ **Maps JavaScript API** 
- ✅ **Maps Embed API**
- ✅ **Geocoding API** (opcional)
- ✅ **Places API** (opcional)

### Paso 3: Crear API Key

1. Ve a **Credenciales** → **Crear Credenciales** → **Clave de API**
2. Se creará tu API key (ej: `AIzaSy...`)
3. **¡IMPORTANTE!**: Para desarrollo, NO pongas restricciones inicialmente

### Paso 4: Configurar en la App

Reemplaza la API key en `/config/mapConfig.js`:

```javascript
export const MAP_CONFIG = {
  // Tu nueva API key aquí
  apiKey: 'TU_NUEVA_API_KEY_AQUI',
  // ...resto de la configuración
};
```

### Paso 5: Restricciones (Producción)

**Solo para producción**, agrega restricciones:
- **Restricciones de aplicación**: 
  - Android: `SHA-1` de tu certificado
  - iOS: Bundle ID de tu app
- **Restricciones de API**: Selecciona las APIs que vas a usar

## 💰 COSTOS DE GOOGLE MAPS API

### Límites Gratuitos (por mes):
- **Maps JavaScript API**: 28,000 cargas gratuitas
- **Geocoding API**: 40,000 requests gratuitas  
- **Places API**: Varía según el tipo

### Después del límite gratuito:
- **Maps JavaScript API**: ~$7 USD por 1,000 cargas adicionales
- **Geocoding API**: ~$5 USD por 1,000 requests

## 🤔 ¿QUÉ RECOMIENDO?

### Para Desarrollo/Pruebas:
✅ **USA EL MAPA GRATUITO** - Ya está implementado y funciona perfectamente

### Para Producción:
1. **Evalúa si necesitas Google Maps específicamente**
2. **Considera el mapa gratuito** si cumple tus necesidades
3. **Solo si necesitas funciones específicas de Google** (Street View, lugares comerciales, etc.), entonces obtén API key

## 🛠️ CONFIGURACIÓN RÁPIDA

Si decides usar API key propia:

```bash
# 1. Editar configuración
nano config/mapConfig.js

# 2. Cambiar la API key
apiKey: 'TU_NUEVA_API_KEY',

# 3. Reiniciar app
npm start
```

## ✅ RESULTADO

**CON MAPA GRATUITO**: ¡Ya tienes mapas funcionando perfectamente!
**CON API KEY PROPIA**: Tendrás acceso a todas las funciones de Google Maps

---

## 🎯 RECOMENDACIÓN FINAL

**Usa el "Free Map" que ya implementé**. Es:
- ✅ Gratuito para siempre
- ✅ No requiere configuración 
- ✅ Excelente calidad
- ✅ Ya está funcionando en tu app

Solo obtén API key de Google si necesitas funciones muy específicas que solo Google Maps ofrece.