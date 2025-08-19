# 🚀 Setup de Desarrollo Universal - Rapigoo

Esta guía funciona para **cualquier desarrollador** sin importar su sistema operativo o configuración de red.

## ✅ **Setup Automático (Recomendado)**

La app detecta automáticamente tu entorno y encuentra la IP correcta. **No necesitas configurar nada**.

### 1. Instalar dependencias
```bash
# Frontend
npm install

# Backend
cd backend
npm install
```

### 2. Iniciar backend
```bash
cd backend
npm start
```

### 3. Iniciar frontend
```bash
# En otra terminal, desde la raíz del proyecto
npm start
```

**¡Listo!** La app detectará automáticamente la IP de tu servidor.

---

## 🔧 **Configuración Manual (Solo si es necesario)**

Si la detección automática no funciona, puedes personalizar:

### 1. Crear archivo de configuración
```bash
cp .env.example .env.local
```

### 2. Editar `.env.local` según tu entorno:

#### **WSL (Windows)**
```bash
# Obtener tu IP de WSL
hostname -I

# En .env.local:
EXPO_PUBLIC_API_HOST=172.26.236.81  # Tu IP de WSL
```

#### **macOS**
```bash
# Obtener tu IP local
ifconfig | grep "inet " | grep -v 127.0.0.1

# En .env.local:
EXPO_PUBLIC_API_HOST=192.168.1.100  # Tu IP local
```

#### **Linux**
```bash
# Obtener tu IP local
ip route get 1 | head -1 | awk '{print $7}'

# En .env.local:
EXPO_PUBLIC_API_HOST=192.168.1.100  # Tu IP local
```

#### **Docker**
```bash
# En .env.local:
EXPO_PUBLIC_API_HOST=host.docker.internal
```

#### **Configuración completa (opcional)**
```bash
# .env.local
EXPO_PUBLIC_API_HOST=tu-ip-aqui
EXPO_PUBLIC_API_PORT=5000
EXPO_PUBLIC_API_TIMEOUT=15000
EXPO_PUBLIC_DEBUG_NETWORK=true
```

---

## 🛠 **Testing de Conectividad**

```bash
# Probar conectividad automáticamente
node test-network-connectivity.js

# Verificar backend manualmente
curl http://tu-ip:5000/api
```

---

## 📱 **Por Tipo de Dispositivo**

### **Emulador Android**
- ✅ **Automático**: Usa `10.0.2.2` automáticamente
- 🔧 **Manual**: `EXPO_PUBLIC_API_HOST=10.0.2.2`

### **Simulador iOS** 
- ✅ **Automático**: Usa `localhost` automáticamente
- 🔧 **Manual**: `EXPO_PUBLIC_API_HOST=localhost`

### **Dispositivo Físico**
- ✅ **Automático**: Detecta IP de Expo Dev Server
- 🔧 **Manual**: Usa tu IP local de red WiFi

### **Web Browser**
- ✅ **Automático**: Usa `localhost` automáticamente
- 🔧 **Manual**: `EXPO_PUBLIC_API_HOST=localhost`

---

## 🚨 **Solución de Problemas**

### Error: "Network Error" o "ECONNREFUSED"

1. **Verificar backend activo**:
   ```bash
   cd backend && npm start
   ```

2. **Probar conectividad**:
   ```bash
   node test-network-connectivity.js
   ```

3. **Verificar firewall** (Windows):
   - Permitir Node.js en Windows Firewall
   - Permitir puerto 5000

4. **Verificar red WiFi**:
   - Backend y móvil deben estar en la misma red WiFi

### Logs de debug
```bash
# Habilitar logs detallados
echo "EXPO_PUBLIC_DEBUG_NETWORK=true" >> .env.local
```

---

## 🎯 **Entornos Soportados**

| Entorno | IP Automática | Configuración Manual |
|---------|---------------|---------------------|
| WSL | ✅ Detecta IP WSL | `hostname -I` |
| macOS | ✅ Detecta IP WiFi | `ifconfig` |
| Linux | ✅ Detecta IP WiFi | `ip route` |
| Docker | ⚠️ Configurar manualmente | `host.docker.internal` |
| Android Emulator | ✅ `10.0.2.2` | N/A |
| iOS Simulator | ✅ `localhost` | N/A |
| Dispositivo físico | ✅ Detecta automáticamente | IP de red WiFi |

---

## 📝 **Notas para Colaboradores**

- ✅ **NO commitear** archivos `.env.local` (ya están en `.gitignore`)
- ✅ **Usar** `.env.example` como referencia
- ✅ **Documentar** configuraciones especiales en este archivo
- ✅ **Probar** en diferentes entornos antes de hacer PR

---

¿Problemas? Revisa los logs o crea un issue con:
1. Tu sistema operativo
2. Tipo de dispositivo (emulador/físico)
3. Logs de `node test-network-connectivity.js`