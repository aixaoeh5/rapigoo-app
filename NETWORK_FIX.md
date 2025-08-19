# Solución para Error de Red en la App Móvil

## Problema
La app móvil muestra el error: `Network Error` al intentar hacer login.

## Solución Implementada

### 1. Backend Mejorado
- Se implementó retry logic con backoff exponencial en `backend/controllers/authController.js`
- El servidor ahora escucha en todas las interfaces (`0.0.0.0:5000`)
- CORS configurado para permitir todas las conexiones en desarrollo

### 2. Configuración de API Mejorada
- Nuevo archivo: `config/apiConfig.js` con detección inteligente de IP
- API client mejorado: `api/apiClient.js` con reintentos automáticos

### 3. Servidor de Prueba Rápido
Para pruebas inmediatas, usa el servidor simplificado:
```bash
cd backend
node server-quick.js
```

## Pasos para Solucionar el Problema

### Opción 1: Usar el Servidor Principal (Recomendado)
```bash
cd backend
npm start
```

### Opción 2: Usar el Servidor Quick (Para Pruebas)
```bash
cd backend
node server-quick.js
```

### En la App Móvil

1. **Si usas un dispositivo físico Android:**
   - Asegúrate de que tu teléfono y tu computadora estén en la misma red WiFi
   - La app detectará automáticamente la IP correcta

2. **Si usas un emulador Android:**
   - La app usará automáticamente `10.0.2.2:5000`

3. **Si usas iOS Simulator:**
   - La app usará automáticamente `localhost:5000`

4. **Si nada funciona:**
   - Edita `config/apiConfig.js`
   - Actualiza `KNOWN_SERVER_IPS` con tu IP local:
   ```javascript
   const KNOWN_SERVER_IPS = [
     '172.26.236.81', // WSL IP
     '192.168.1.XXX', // Tu IP local (reemplaza XXX)
   ];
   ```

## Verificación

### 1. Verificar que el servidor está corriendo:
```bash
curl http://localhost:5000/api/health
```

### 2. Probar login desde terminal:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 3. Ver logs del servidor:
El servidor mostrará todas las peticiones recibidas en la consola.

## Credenciales de Prueba
- Email: `test@example.com`
- Password: `password123`

## Troubleshooting

### Si el error persiste:

1. **Verifica la IP de tu máquina:**
   - Windows (PowerShell): `ipconfig`
   - Linux/Mac: `ifconfig` o `ip addr`
   - WSL: `hostname -I`

2. **Actualiza la IP en la app:**
   - Edita `config/apiConfig.js`
   - Agrega tu IP a `KNOWN_SERVER_IPS`

3. **Verifica el firewall:**
   - Asegúrate de que el puerto 5000 esté abierto
   - Windows: Puede que necesites agregar una regla de firewall
   - Linux: `sudo ufw allow 5000`

4. **Reinicia la app:**
   - Cierra completamente Expo Go
   - Ejecuta `expo start -c` para limpiar cache
   - Vuelve a abrir la app

## Logs de Depuración

La app ahora incluye logs detallados:
- `📱 Expo Host IP detectada: X.X.X.X` - IP detectada automáticamente
- `🔍 Probando URL: http://X.X.X.X:5000/api` - Intentos de conexión
- `✅ URL disponible` o `❌ URL no disponible` - Resultado de pruebas
- `📡 API Request:` - Detalles de cada petición

## Contacto
Si el problema persiste después de seguir estos pasos, verifica:
1. Los logs del servidor (`npm start` en backend/)
2. Los logs de la app (consola de Expo)
3. La conectividad de red entre dispositivo y servidor