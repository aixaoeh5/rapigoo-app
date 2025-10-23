# 📱 Guía de Instalación - Rapigoo App

## 📋 Prerrequisitos

Asegúrate de tener instalado:
- **Node.js** v18+ (recomendado v20)
- **npm** v9+ o **yarn**
- **MongoDB** v5+ (local o remoto)
- **Git**
- **Expo CLI**: `npm install -g expo-cli`
- **Android Studio** o **Xcode** (para desarrollo móvil)

## 🚀 Instalación Paso a Paso

### 1️⃣ **Clonar el Repositorio**

```bash
git clone [URL_DEL_REPOSITORIO]
cd rapigoo-app
```

### 2️⃣ **Backend (API Server)**

```bash
# Navegar al directorio del backend
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones (ver sección Configuración abajo)

# Iniciar MongoDB (si es local)
# En Windows:
mongod --dbpath C:\data\db
# En Mac/Linux:
sudo mongod --dbpath /data/db

# Crear usuarios demo (opcional)
node createDemoUsers.js

# Iniciar el servidor
npm start
# O para desarrollo con auto-reload:
npm run dev
```

El backend estará disponible en: `http://localhost:5000`

### 3️⃣ **App Móvil (React Native/Expo)**

```bash
# Volver al directorio raíz
cd ..

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tu IP local (ver sección Configuración)

# Iniciar Expo
npm start
# O directamente:
expo start --clear
```

Opciones para ejecutar la app:
- **Escanear QR** con Expo Go en tu dispositivo
- Presionar `a` para Android Emulator
- Presionar `i` para iOS Simulator
- Presionar `w` para Web Browser

### 4️⃣ **Admin Dashboard (React)**

```bash
# Navegar al directorio admin
cd admin

# Instalar dependencias
npm install

# Iniciar el dashboard
npm start
```

El dashboard estará disponible en: `http://localhost:3001`

## ⚙️ Configuración Importante

### **Backend (.env)**

Configuraciones mínimas requeridas:

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/rapigoo

# JWT (generar uno nuevo)
JWT_SECRET=tu-clave-secreta-super-segura-minimo-32-caracteres

# Puerto
PORT=5000

# Email (para notificaciones)
EMAIL_USER=tu-correo@gmail.com
EMAIL_PASS=tu-contraseña-de-aplicación

# Firebase (para push notifications)
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### **App Móvil (.env.local)**

```env
# IP de tu máquina local (NO localhost)
# En Windows: ipconfig
# En Mac/Linux: ifconfig o ip addr
EXPO_PUBLIC_API_HOST=192.168.1.100  # Cambiar por tu IP

# Puerto del backend
EXPO_PUBLIC_API_PORT=5000

# Desactivar alertas de error (desarrollo)
EXPO_PUBLIC_DISABLE_ERROR_ALERTS=true
```

### **Encontrar tu IP Local:**

**Windows:**
```cmd
ipconfig
# Buscar: IPv4 Address bajo "Wireless LAN adapter Wi-Fi"
```

**Mac/Linux:**
```bash
ifconfig | grep inet
# O más específico:
ip addr show | grep inet
```

## 🏃‍♂️ Ejecutar Todo Simultáneamente

Desde el directorio raíz:

```bash
# Instalar todas las dependencias de una vez
npm run install:all

# Luego abrir 3 terminales:

# Terminal 1 - Backend:
cd backend && npm start

# Terminal 2 - App Móvil:
npm start

# Terminal 3 - Admin Dashboard:
cd admin && npm start
```

## 👥 Usuarios de Prueba

Después de ejecutar `createDemoUsers.js`:

**Cliente:**
- Email: `cliente@demo.com`
- Password: `Demo123!`

**Comerciante:**
- Email: `comerciante@demo.com`
- Password: `Demo123!`

**Delivery:**
- Email: `delivery@demo.com`
- Password: `Demo123!`

**Admin:**
- Email: `admin@demo.com`
- Password: `Admin123!`

## 🐛 Solución de Problemas Comunes

### **Error: "Cannot connect to Metro"**
- Verifica que la IP en `.env.local` sea correcta
- Desactiva el firewall temporalmente
- Reinicia Expo con `expo start --clear`

### **Error: "MongoDB connection failed"**
- Asegúrate que MongoDB esté ejecutándose
- Verifica la URI en backend/.env
- Prueba con: `mongo` o `mongosh` en terminal

### **Error: "Network request failed"**
- La IP del backend debe ser accesible desde tu dispositivo
- Ambos dispositivos deben estar en la misma red WiFi
- En emulador Android usa: `10.0.2.2` en lugar de `localhost`

### **Error: "Module not found"**
```bash
# Limpiar e reinstalar
rm -rf node_modules package-lock.json
npm install
```

## 📱 Configuración para Dispositivo Físico

1. **Conectar dispositivo y PC a la misma red WiFi**
2. **Usar tu IP local (NO localhost)**
3. **Desactivar VPN si está activa**
4. **Para iOS:** Puede requerir configuración adicional en Xcode

## 🔧 Scripts Útiles

```bash
# Limpiar caché de Expo
expo start --clear

# Reinstalar todo desde cero
npm run clean

# Ver logs del backend
cd backend && npm run dev

# Ejecutar tests
npm test
```

## 📞 Soporte

Si encuentras problemas:
1. Revisa los logs en la consola
2. Verifica las configuraciones de IP y puertos
3. Asegúrate que todas las dependencias estén instaladas
4. Reinicia los servicios

---

¡Listo! Tu entorno de desarrollo Rapigoo debería estar funcionando 🎉