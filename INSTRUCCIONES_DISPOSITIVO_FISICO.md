# 📱 Configuración para Dispositivo Físico (Windows)

## Tu Configuración Actual

- ✅ **Sistema**: Windows con WSL
- ✅ **Dispositivo**: Físico (no emulador)  
- ✅ **IP detectada**: `10.0.0.198`
- ✅ **Servidor**: Corriendo en WSL port 5000
- ✅ **API configurada**: `http://10.0.0.198:5000/api`

## 🚨 PROBLEMA ACTUAL

El servidor corre en WSL (IP: 172.26.236.81) pero tu dispositivo necesita acceder por la IP de Windows (10.0.0.198). Necesitas hacer "port forwarding".

## ✅ SOLUCIÓN RÁPIDA

### Opción 1: Port Forwarding (Recomendado)

1. **Abre PowerShell como Administrador**:
   - Windows Key + X → "Windows PowerShell (Admin)"

2. **Ejecuta este comando** (copia y pega):
```powershell
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=10.0.0.198 connectport=5000 connectaddress=172.26.236.81
```

3. **Verifica que se agregó**:
```powershell
netsh interface portproxy show all
```

4. **Configura Windows Firewall**:
```powershell
New-NetFirewallRule -DisplayName "WSL Server" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

### Opción 2: ngrok (Más fácil)

1. **Instala ngrok**:
   - Descarga desde: https://ngrok.com/download
   - O con npm: `npm install -g ngrok`

2. **Ejecuta en una terminal nueva**:
```bash
ngrok http 5000
```

3. **Verás algo así**:
```
Forwarding: https://abc123.ngrok.io -> http://localhost:5000
```

4. **Actualiza** `api/simpleApiClient.js` línea 5:
```javascript
const API_BASE_URL = 'https://abc123.ngrok.io/api';
```

## 🧪 VERIFICACIÓN

### 1. Prueba desde tu computadora:
```bash
curl http://10.0.0.198:5000
```

### 2. Prueba desde tu teléfono:
- Abre el navegador en tu teléfono
- Ve a: `http://10.0.0.198:5000`
- Deberías ver: `{"message":"API Rapigoo (Quick Server)"...}`

### 3. En la app:
- Reinicia Expo: `expo start -c`
- En los logs deberías ver: `📍 API configurada en: http://10.0.0.198:5000/api`
- Intenta hacer login

## 🔧 Troubleshooting

### Si el port forwarding no funciona:

1. **Elimina la regla anterior**:
```powershell
netsh interface portproxy delete v4tov4 listenport=5000 listenaddress=10.0.0.198
```

2. **Vuelve a agregar**:
```powershell
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=10.0.0.198 connectport=5000 connectaddress=172.26.236.81
```

### Si el firewall bloquea:

1. **Verifica reglas de firewall**:
```powershell
Get-NetFirewallRule -DisplayName "*WSL*" | Select DisplayName, Enabled, Direction
```

2. **O desactiva Windows Firewall temporalmente**:
   - Panel de Control → Sistema y Seguridad → Windows Defender Firewall
   - Desactivar para red privada

### Si tu IP cambió:

1. **Verifica IP actual**:
```powershell
ipconfig | findstr IPv4
```

2. **Actualiza** `api/simpleApiClient.js` con la nueva IP

## 📋 STATUS ACTUAL

- ✅ Servidor corriendo en WSL
- ✅ API client configurado con tu IP
- ⏳ Pendiente: Port forwarding o ngrok
- ⏳ Pendiente: Prueba desde dispositivo

## 🎯 PRÓXIMOS PASOS

1. **Ejecuta el port forwarding** (PowerShell como admin)
2. **Reinicia Expo**: `expo start -c`
3. **Prueba login** en la app
4. **Si funciona**: ¡Listo! ✅
5. **Si no funciona**: Usa ngrok (Opción 2)

---

💡 **Tip**: Una vez que funcione, guarda estos comandos para uso futuro.