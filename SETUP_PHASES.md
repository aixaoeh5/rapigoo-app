# 🚀 Fases de Configuración - Rapigoo App

Este documento describe paso a paso cómo configurar el proyecto para desarrollo.

## 📋 FASE 1: Configuración Básica (CRÍTICA - Sin esto nada funciona)

### 1.1 Variables de Entorno del Backend
```bash
# backend/.env
PORT=5000
MONGO_URI=mongodb+srv://christ1913:pinguino27@cluster0.gvxd2gm.mongodb.net/rapigoo_db?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=tu_jwt_secret_seguro_aqui

# Temporalmente dejar vacíos (ver Fase 2)
EMAIL_USER=
EMAIL_PASS=
```

### 1.2 Configuración de URLs de API
1. Encuentra tu IP local:
   ```bash
   # Windows
   ipconfig
   # Busca "IPv4 Address" (ej: 192.168.1.100)
   
   # Mac/Linux
   ifconfig | grep inet
   ```

2. Actualiza `/config/api.js`:
   ```javascript
   const API_CONFIG = {
     BASE_URL: 'http://TU-IP-LOCAL:5000/api', // Cambiar TU-IP-LOCAL
     ANDROID_EMULATOR_URL: 'http://10.0.2.2:5000/api',
     WEB_URL: 'http://localhost:5000/api',
     TIMEOUT: 10000
   };
   ```

### 1.3 Instalación de Dependencias
```bash
# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

### 1.4 Crear archivo .gitignore actualizado
Asegúrate de que estos archivos NO se suban a Git:
```
# backend/.gitignore
.env
firebase-service-account.json
node_modules/

# .gitignore (raíz)
.env
.env.local
config/api.js
```

### ✅ Verificación Fase 1:
- [ ] Backend inicia sin errores: `cd backend && npm start`
- [ ] Frontend inicia sin errores: `npm start`
- [ ] Puedes ver la pantalla de bienvenida en Expo Go

---

## 📧 FASE 2: Sistema de Emails (IMPORTANTE - Sin esto no hay registro/recuperación)

### Opción A: Gmail con App Password (Recomendado)
1. Ve a https://myaccount.google.com/security
2. Activa "Verificación en 2 pasos"
3. Ve a https://myaccount.google.com/apppasswords
4. Genera contraseña para "Mail"
5. Actualiza `backend/.env`:
   ```
   EMAIL_USER=tu-email@gmail.com
   EMAIL_PASS=abcd-efgh-ijkl-mnop  # Sin espacios
   ```

### Opción B: Modo Desarrollo (Sin emails reales)
Crea `backend/config/development.js`:
```javascript
module.exports = {
  EMAIL_MODE: 'console', // 'real' para producción
  SHOW_VERIFICATION_CODES: true
};
```

Modifica `backend/controllers/authController.js` para modo desarrollo:
```javascript
// En forgotPassword y register
if (process.env.NODE_ENV === 'development') {
  console.log(`📧 CÓDIGO DE VERIFICACIÓN: ${code}`);
  return res.json({ 
    success: true, 
    message: 'Código enviado', 
    ...(process.env.SHOW_CODES && { code }) 
  });
}
```

### ✅ Verificación Fase 2:
- [ ] Puedes registrar un usuario nuevo
- [ ] Recibes código de verificación (email o consola)
- [ ] Puedes recuperar contraseña

---

## 🔐 FASE 3: Autenticación Social (OPCIONAL - Para login con Google/Facebook)

### 3.1 Google OAuth
1. Ve a https://console.cloud.google.com
2. Crea un nuevo proyecto
3. Habilita "Google+ API"
4. Crea credenciales OAuth 2.0:
   - Web Client ID
   - Android Client ID (SHA-1 de tu app)
   - iOS Client ID (Bundle ID)

5. Actualiza `components/shared/SocialLogin.js`:
   ```javascript
   const [request, response, promptAsync] = Google.useAuthRequest({
     expoClientId: 'tu-expo-client-id.apps.googleusercontent.com',
     iosClientId: 'tu-ios-client-id.apps.googleusercontent.com',
     androidClientId: 'tu-android-client-id.apps.googleusercontent.com',
     webClientId: 'tu-web-client-id.apps.googleusercontent.com',
   });
   ```

### 3.2 Firebase Configuration
1. Ve a https://console.firebase.google.com
2. Descarga `google-services.json` (Android)
3. Descarga `GoogleService-Info.plist` (iOS)
4. Coloca en las carpetas correspondientes

### ✅ Verificación Fase 3:
- [ ] Login con Google funciona
- [ ] Se crea usuario en MongoDB al hacer login social

---

## 🔔 FASE 4: Notificaciones Push (OPCIONAL - Para pedidos en tiempo real)

### 4.1 Firebase Admin SDK
1. En Firebase Console, ve a Configuración > Cuentas de servicio
2. Genera nueva clave privada
3. Guarda como `backend/firebase-service-account.json`
4. Actualiza `backend/firebaseAdmin.js`:
   ```javascript
   const serviceAccount = require('./firebase-service-account.json');
   ```

### 4.2 Expo Push Notifications
```bash
expo install expo-notifications expo-device
```

### ✅ Verificación Fase 4:
- [ ] Puedes enviar notificación de prueba
- [ ] Usuario recibe notificación al crear pedido

---

## 🗺️ FASE 5: Servicios de Ubicación (OPCIONAL - Para delivery)

### 5.1 Google Maps API
1. Habilita Maps SDK en Google Cloud Console
2. Crea API Key
3. Actualiza `app.json`:
   ```json
   "android": {
     "config": {
       "googleMaps": {
         "apiKey": "TU-API-KEY"
       }
     }
   }
   ```

### ✅ Verificación Fase 5:
- [ ] Mapa se muestra correctamente
- [ ] Puede obtener ubicación actual

---

## 🛠️ FASE 6: Herramientas de Desarrollo (RECOMENDADO)

### 6.1 Scripts de NPM
Agrega a `package.json`:
```json
"scripts": {
  "dev": "concurrently \"npm run backend\" \"npm run expo\"",
  "backend": "cd backend && npm start",
  "expo": "expo start",
  "setup": "npm install && cd backend && npm install"
}
```

### 6.2 Variables de Entorno para Frontend
Instala dotenv:
```bash
npm install dotenv
```

Crea `.env`:
```
API_URL=http://192.168.1.100:5000/api
GOOGLE_MAPS_KEY=tu-api-key
```

### ✅ Verificación Fase 6:
- [ ] `npm run dev` inicia todo
- [ ] Variables de entorno funcionan

---

## 📝 Checklist para Nuevos Desarrolladores

### Día 1 - Setup Básico:
- [ ] Clonar repositorio
- [ ] Completar FASE 1
- [ ] Completar FASE 2 (al menos modo desarrollo)
- [ ] Crear cuenta de prueba
- [ ] Verificar navegación básica

### Día 2 - Features Avanzadas:
- [ ] FASE 3 si necesitas login social
- [ ] FASE 4 si trabajas con notificaciones
- [ ] FASE 5 si trabajas con mapas

### Documentación Adicional:
- `backend/README.api.md` - Endpoints de la API
- `ROADMAP_MVP_RAPIGOO.md` - Features planeadas
- `backend/TESTING.md` - Cómo ejecutar tests

---

## 🚨 Problemas Comunes

### "Cannot connect to backend"
- Verifica tu IP local
- Asegúrate que el backend esté corriendo
- Firewall puede bloquear puerto 5000

### "Email not sending"
- Verifica App Password de Gmail
- Usa modo desarrollo temporalmente

### "Google login not working"
- En Expo Go, Google OAuth tiene limitaciones
- Necesitas un build de desarrollo

### "Metro bundler issues"
```bash
npx expo start -c  # Clear cache
```

---

## 📞 Soporte

- Issues: https://github.com/tu-repo/issues
- Documentación: Ver carpeta `/docs`
- Slack/Discord del equipo: [URL aquí]