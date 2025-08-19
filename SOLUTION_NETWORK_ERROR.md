# 🚨 SOLUCIÓN DEFINITIVA: Error de Red

## Diagnóstico
Tu app no puede conectarse al servidor porque:
- ❌ `http://172.26.236.81:5000` (WSL IP) - No accesible desde el emulador
- ❌ `http://10.0.2.2:5000` (Android Emulator localhost) - No funciona con WSL
- ❌ `http://localhost:5000` - No funciona en React Native

## Solución Rápida

### Opción 1: Usar Cliente API Simple (RECOMENDADO)

Ya he configurado un cliente simple. Solo necesitas:

1. **Editar el archivo** `api/simpleApiClient.js`
2. **Cambiar la línea 5** según tu entorno:

```javascript
// Si usas Android Emulator:
const API_BASE_URL = 'http://10.0.2.2:5000/api';

// Si usas dispositivo físico Android/iOS:
const API_BASE_URL = 'http://TU_IP_LOCAL:5000/api';

// Si usas iOS Simulator:
const API_BASE_URL = 'http://localhost:5000/api';
```

3. **Para encontrar tu IP local** (solo si usas dispositivo físico):
   - Windows: `ipconfig` (busca IPv4 Address)
   - Mac/Linux: `ifconfig` o `ip addr`
   - Ejemplo: `http://192.168.1.100:5000/api`

4. **Reinicia la app**:
```bash
# Ctrl+C para detener
expo start -c
```

### Opción 2: Usar ngrok (Acceso desde cualquier lugar)

1. **Instala ngrok**:
```bash
# Descarga desde https://ngrok.com/download
# O con npm:
npm install -g ngrok
```

2. **Expón tu servidor**:
```bash
# En una terminal nueva:
ngrok http 5000
```

3. **Obtendrás una URL pública** como:
```
Forwarding: https://abc123.ngrok.io -> http://localhost:5000
```

4. **Actualiza** `api/simpleApiClient.js`:
```javascript
const API_BASE_URL = 'https://abc123.ngrok.io/api';
```

### Opción 3: Ejecutar servidor fuera de WSL

Si estás en Windows con WSL:

1. **Instala Node.js en Windows** (no en WSL)
2. **Copia el backend a Windows**:
```bash
cp -r backend /mnt/c/Users/TU_USUARIO/Desktop/backend-windows
```

3. **Ejecuta desde PowerShell**:
```powershell
cd C:\Users\TU_USUARIO\Desktop\backend-windows
node server-quick.js
```

4. **Usa** `http://10.0.2.2:5000/api` en el emulador

## Verificación

### 1. Confirma que el servidor está corriendo:
```bash
curl http://localhost:5000
# Deberías ver: {"message":"API Rapigoo (Quick Server)"...}
```

### 2. En la app, revisa los logs:
Deberías ver:
```
📍 API configurada en: http://10.0.2.2:5000/api
📤 POST http://10.0.2.2:5000/api/auth/login
✅ 200 /auth/login
```

### 3. Si aún falla, prueba la herramienta de debug:
- En la pantalla de login, presiona el botón rojo "🔍 Network Debug Tool"
- Ejecuta "Run Network Tests"
- Mira cuál URL funciona (✅)

## Configuración Actual

El servidor está corriendo correctamente en:
- `http://localhost:5000` ✅
- `http://172.26.236.81:5000` ✅

Pero React Native no puede acceder a estas URLs desde el emulador Android.

## TL;DR - Solución más rápida:

```javascript
// En api/simpleApiClient.js, línea 5:
const API_BASE_URL = 'http://10.0.2.2:5000/api';
```

Luego reinicia Expo:
```bash
expo start -c
```

## Si nada funciona:

1. **Verifica que no tengas un proxy configurado**:
   - Settings > Network > Proxy en el emulador Android
   
2. **Reinicia el emulador Android**:
   - Close emulator
   - Cold boot desde AVD Manager

3. **Usa un dispositivo físico**:
   - Conecta tu teléfono por USB
   - Activa USB debugging
   - Usa tu IP local en `simpleApiClient.js`

---

💡 **Nota**: Una vez que funcione, puedes volver al cliente dinámico descomentando la línea original en `api/auth.js`