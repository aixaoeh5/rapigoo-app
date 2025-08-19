# 📱 Checklist de Publicación - RapiGoo Delivery App

## 🤖 Google Play Store

### Permisos y Declaraciones Obligatorias

#### Ubicación en Background
- [ ] **Completar formulario de declaración de ubicación**
  - Ir a: Play Console > App Content > Sensitive app permissions
  - Seleccionar: "Location permissions"
  - Caso de uso: "Delivery tracking and navigation"
  
- [ ] **Video demostración requerido**
  - Duración: 30 segundos mínimo
  - Mostrar: Flujo completo de delivery con tracking
  - Incluir: Notificación de foreground service visible
  - URL del video: _________________

- [ ] **Justificación del uso**
  ```
  RapiGoo utiliza la ubicación en background exclusivamente para:
  1. Rastrear deliveries activos en tiempo real
  2. Optimizar rutas de entrega
  3. Notificar al cliente sobre el progreso
  4. Garantizar seguridad del repartidor
  
  La ubicación solo se usa durante entregas activas.
  ```

#### Foreground Service
- [ ] **Declaración de tipo de servicio**
  - Tipo: location
  - Manifest actualizado: ✅
  - Notificación persistente implementada: ✅

#### Datos y Privacidad
- [ ] **Política de Privacidad actualizada**
  - URL: https://rapigoo.com/privacy
  - Incluye: Uso de ubicación, almacenamiento, compartir datos
  - Idiomas: Español e Inglés

- [ ] **Cuestionario de seguridad de datos**
  - Recopilación de ubicación: Sí
  - Compartir con terceros: No
  - Encriptación en tránsito: Sí (HTTPS)
  - Eliminación de datos: A petición del usuario

### Configuración Técnica

- [ ] **Firma de la app**
  ```bash
  # Generar keystore de producción
  keytool -genkey -v -keystore rapigoo-release.keystore \
    -alias rapigoo -keyalg RSA -keysize 2048 -validity 10000
  
  # Obtener SHA-1 para API Keys
  keytool -list -v -keystore rapigoo-release.keystore -alias rapigoo
  ```

- [ ] **build.gradle configurado**
  ```gradle
  android {
      compileSdkVersion 34
      targetSdkVersion 34
      
      defaultConfig {
          minSdkVersion 21
          versionCode 1
          versionName "1.0.0"
      }
  }
  ```

- [ ] **Permisos en AndroidManifest.xml**
  ```xml
  ✅ ACCESS_FINE_LOCATION
  ✅ ACCESS_COARSE_LOCATION
  ✅ ACCESS_BACKGROUND_LOCATION
  ✅ FOREGROUND_SERVICE
  ✅ FOREGROUND_SERVICE_LOCATION
  ```

### Testing Pre-lanzamiento

- [ ] **Pre-launch report**
  - Sin crashes críticos
  - Sin problemas de seguridad
  - Performance aceptable

- [ ] **Prueba en dispositivos reales**
  - Android 10 (API 29): ___
  - Android 11 (API 30): ___
  - Android 12 (API 31): ___
  - Android 13 (API 33): ___
  - Android 14 (API 34): ___

## 🍎 App Store (iOS)

### Permisos y Privacidad

#### Ubicación
- [ ] **Info.plist configurado**
  ```xml
  ✅ NSLocationWhenInUseUsageDescription
  ✅ NSLocationAlwaysAndWhenInUseUsageDescription
  ✅ NSLocationAlwaysUsageDescription
  ```

- [ ] **Textos de permisos en español**
  - Claros y específicos
  - Mencionan beneficio para el usuario
  - No genéricos

#### App Privacy Details
- [ ] **Completar en App Store Connect**
  - Location: ✓ Precise Location
  - Usage: App Functionality
  - Linked to user: Yes
  - Used for tracking: No

### Configuración Técnica

- [ ] **Capabilities habilitadas**
  - Background Modes > Location updates
  - Push Notifications (si aplica)

- [ ] **Bundle ID y provisioning**
  - Bundle ID: com.rapigoo.delivery
  - Provisioning profile: Distribution

- [ ] **API Key restrictions**
  - Bundle ID configurado en Google Cloud Console
  - APIs habilitadas: Maps SDK for iOS

### Review Guidelines

- [ ] **Preparación para revisión**
  - Demo account:
    - Email: reviewer@rapigoo.com
    - Password: AppleReview2024!
  - Notas para el revisor:
    ```
    La app requiere permisos de ubicación para funcionar correctamente.
    Use la cuenta demo proporcionada para probar el flujo de delivery.
    La ubicación en background solo se usa durante entregas activas.
    ```

- [ ] **Screenshots y preview**
  - iPhone 6.7": 3 screenshots
  - iPhone 6.5": 3 screenshots
  - iPhone 5.5": 3 screenshots
  - iPad Pro 12.9": 3 screenshots

## 📊 Métricas de Calidad

### Performance
- [ ] **Tiempo de carga inicial**: < 2 segundos
- [ ] **FPS con 50 markers**: ≥ 55 FPS
- [ ] **Uso de memoria**: < 150 MB
- [ ] **Tamaño del APK/IPA**: < 50 MB
- [ ] **Crash rate**: < 0.1%

### API Keys
- [ ] **Android key restringida**:
  - Package: com.rapigoo.delivery
  - SHA-1 Debug: _______________
  - SHA-1 Release: _____________
  
- [ ] **iOS key restringida**:
  - Bundle ID: com.rapigoo.delivery

### Monitoreo Post-lanzamiento
- [ ] **Analytics configurado**
- [ ] **Crash reporting activo**
- [ ] **Performance monitoring**
- [ ] **Alertas de cuota API**

## 🚀 Comandos de Build

### Android
```bash
# Build de producción
cd android
./gradlew assembleRelease

# Bundle para Play Store
./gradlew bundleRelease

# Con Expo/EAS
eas build --platform android --profile production
```

### iOS
```bash
# Build con Expo/EAS
eas build --platform ios --profile production

# Archive con Xcode
# 1. Open ios/RapiGoo.xcworkspace
# 2. Product > Archive
# 3. Distribute App
```

## ⚠️ Problemas Comunes y Soluciones

### Play Store

**Rechazo por ubicación en background**
- Solución: Asegurar video demo claro
- Justificación detallada del caso de uso
- Implementar alternativas sin background si es posible

**Rechazo por foreground service**
- Solución: Notificación debe ser informativa
- Incluir acciones útiles (pausar, detener)
- No puede ser dismissible durante uso

### App Store

**Rechazo por textos de permisos genéricos**
- Solución: Ser específico sobre el uso
- Mencionar beneficio directo al usuario
- Evitar términos técnicos

**Rechazo por ubicación Always**
- Solución: Ofrecer funcionalidad con WhenInUse primero
- Solicitar Always solo cuando sea necesario
- Explicar claramente la diferencia

## 📅 Timeline Estimado

| Fase | Duración | Tareas |
|------|----------|--------|
| Preparación | 2-3 días | Configuración, testing, screenshots |
| Envío | 1 día | Formularios, uploads, configuración |
| Revisión Google | 2-24 horas | Automática + manual si necesario |
| Revisión Apple | 24-48 horas | Manual review |
| Post-lanzamiento | Continuo | Monitoreo, actualizaciones |

## 📝 Notas Finales

- **Versión mínima Android**: API 21 (Android 5.0)
- **Versión mínima iOS**: 12.0
- **React Native**: 0.79.5
- **Expo SDK**: 53.0.0
- **Maps Library**: react-native-maps 1.20.1

---

✅ **Checklist completado por**: _______________
📅 **Fecha**: _______________
🏷️ **Versión**: 1.0.0