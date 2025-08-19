# 🔍 Instrucciones de Debug para Error de Red

## 1. Herramienta de Debug Integrada

He agregado una herramienta de debug completa en la app. Para usarla:

1. **Abre la app en tu dispositivo/emulador**
2. **En la pantalla de login, verás un botón rojo** `🔍 Network Debug Tool`
3. **Presiona el botón** para abrir la herramienta de debug

## 2. ¿Qué hace la herramienta?

La herramienta de debug te mostrará:

### 📱 Device Info
- Platform (iOS/Android)
- Si es dispositivo físico o emulador
- IP detectada por Expo
- URL de API configurada

### 🌐 Network Tests
Presiona "Run Network Tests" para probar múltiples URLs:
- Localhost
- Android emulator (10.0.2.2)
- WSL IP (172.26.236.81)
- Tu IP local detectada automáticamente

### 🔐 Test Login
Una vez que encuentres una URL que funcione (✅), presiona "Test Login" para probar el endpoint de autenticación.

### 📡 Test Axios Client
Prueba el cliente Axios configurado en la app.

## 3. Servidor Backend

### Opción A: Servidor Quick (Recomendado para debug)
```bash
cd backend
node server-quick.js
```

Este servidor:
- ✅ Inicia rápidamente
- ✅ No requiere MongoDB
- ✅ Acepta conexiones de cualquier origen
- ✅ Muestra todos los logs de peticiones

### Opción B: Servidor Principal
```bash
cd backend
npm start
```

## 4. Interpretación de Resultados

### Si todos los tests fallan (❌):

**Problema:** El dispositivo no puede alcanzar el servidor

**Soluciones:**
1. **Verifica que el servidor esté corriendo**
   ```bash
   curl http://localhost:5000/api/health
   ```

2. **Si usas dispositivo físico:**
   - Asegúrate de estar en la misma red WiFi
   - Desactiva el firewall temporalmente
   - En Windows: `Windows Defender Firewall > Allow an app`

3. **Si usas WSL:**
   - La IP de WSL puede cambiar. Verifica con:
   ```bash
   hostname -I
   ```

### Si algunos tests pasan (✅):

**Solución:** Usa la URL que funciona para hacer login

## 5. Logs Detallados

La app ahora muestra logs detallados en la consola:

```
📱 Expo Host IP detectada: 192.168.1.100
🔍 Probando URL: http://192.168.1.100:5000/api
✅ URL disponible: http://192.168.1.100:5000/api
📡 API Request: POST http://192.168.1.100:5000/api/auth/login
```

## 6. Configuración Manual (si es necesario)

Si encuentras una IP que funciona pero la app no la detecta automáticamente:

1. Edita `config/apiConfig.js`
2. Agrega tu IP al array:
```javascript
const KNOWN_SERVER_IPS = [
  '172.26.236.81', // WSL
  '192.168.1.XXX', // Tu IP aquí
];
```

## 7. Troubleshooting Común

### Error: "Network Error"
- El servidor no es alcanzable
- Verifica firewall y red

### Error: "ECONNREFUSED"
- El servidor no está corriendo
- Ejecuta `node server-quick.js`

### Error: "Timeout"
- La red es muy lenta
- El servidor está sobrecargado

### Error en Android Emulator
- Usa `10.0.2.2` en lugar de `localhost`

### Error en iOS Simulator
- Usa `localhost` o `127.0.0.1`

### Error en Dispositivo Físico
- Debe estar en la misma red WiFi
- La IP del servidor debe ser la IP local de tu máquina

## 8. Comando de Verificación Rápida

Desde tu computadora, verifica que el servidor responde:

```bash
# Desde la misma máquina
curl http://localhost:5000/api/health

# Desde otro dispositivo en la red (reemplaza la IP)
curl http://192.168.1.XXX:5000/api/health
```

## 9. Credenciales de Prueba

- Email: `test@example.com`
- Password: `password123`

## 10. Si Todo Falla

1. **Reinicia todo:**
   ```bash
   # Para el servidor
   Ctrl+C
   node server-quick.js
   
   # En la app
   expo start -c
   ```

2. **Verifica los puertos:**
   ```bash
   # Linux/Mac
   lsof -i :5000
   
   # Windows
   netstat -an | findstr :5000
   ```

3. **Prueba con Postman o curl primero** para asegurarte de que el servidor funciona independientemente de la app.

---

💡 **Tip:** Una vez que encuentres la configuración que funciona, anótala para referencia futura.