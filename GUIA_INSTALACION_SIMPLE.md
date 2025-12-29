# 🚀 GUÍA DE INSTALACIÓN RAPIGOO - VERSIÓN SIMPLE

## ⚠️ ANTES DE EMPEZAR - INSTALAR PROGRAMAS NECESARIOS

### 1. Instalar Node.js
1. Ve a: https://nodejs.org
2. Descarga la versión **"LTS"** (el botón verde grande)
3. Instala dándole siguiente a todo
4. Reinicia tu computadora

### 2. Instalar Git
1. Ve a: https://git-scm.com/download
2. Descarga para tu sistema (Windows/Mac)
3. Instala dándole siguiente a todo

### 3. Instalar Visual Studio Code (para editar archivos)
1. Ve a: https://code.visualstudio.com
2. Descarga e instala

---

## 📥 PASO 1: DESCARGAR EL PROYECTO

1. **Crea una carpeta** en tu Escritorio llamada `rapigoo`
2. **Abre la Terminal/CMD:**
   - **Windows**: Presiona `Windows + R`, escribe `cmd` y Enter
   - **Mac**: Busca "Terminal" en Spotlight

3. **Copia y pega estos comandos** (uno por uno):
```bash
cd Desktop/rapigoo
git clone [URL_DEL_REPOSITORIO_QUE_TE_DIERON]
cd rapigoo-app
```

---

## 🔧 PASO 2: CONFIGURAR EL BACKEND (Servidor)

### A. Instalar dependencias
En la misma terminal, copia y pega:
```bash
cd backend
npm install
```
⏰ **Espera** hasta que termine (puede tardar 2-3 minutos)

### B. El archivo .env ya existe!
✅ **NO NECESITAS CREAR NADA** - El archivo `.env` ya está listo con la base de datos configurada

### C. Configuración - ¡YA ESTÁ LISTA!
✅ **BUENAS NOTICIAS: La base de datos ya está configurada**

El archivo `.env` ya tiene todo configurado:
- ✅ MongoDB Atlas ya conectado
- ✅ JWT Secret ya configurado
- ✅ Base de datos en la nube funcionando

**OPCIONAL - Solo si quieres enviar emails:**
1. **Abre Visual Studio Code**
2. Arrastra la carpeta `rapigoo-app` a Visual Studio Code
3. En el panel izquierdo, busca: `backend` → `.env`
4. **Solo si necesitas emails, cambia la línea 10:**

```env
# Línea 10 - SOLO SI NECESITAS EMAILS
EMAIL_PASS=tu_contraseña_de_aplicación_gmail
```

**CÓMO CREAR CONTRASEÑA DE APP EN GMAIL:*
1. Ve a: https://myaccount.google.com/security
2. Busca "Verificación en 2 pasos" y actívala
3. Busca "Contraseñas de aplicaciones"
4. Crea una nueva, ponle nombre "Rapigoo"
5. Copia la contraseña de 16 caracteres

5. **Guarda el archivo** con `Ctrl+S` (Windows) o `Cmd+S` (Mac)

### D. Crear usuarios de prueba
En la terminal:
```bash
node createDemoUsers.js
```

### E. Iniciar el servidor
```bash
npm start
```

✅ **ÉXITO SI VES:** `Server running on port 5000`

⚠️ **DEJA ESTA TERMINAL ABIERTA**

---

## 📱 PASO 3: CONFIGURAR LA APP MÓVIL

### A. Abrir NUEVA terminal
1. **Abre OTRA terminal nueva** (no cierres la anterior)
2. Ve a la carpeta del proyecto:
```bash
cd Desktop/rapigoo/rapigoo-app
```

### B. Instalar Expo
```bash
npm install -g expo-cli
```

### C. Instalar dependencias
```bash
npm install
```
⏰ **Espera** hasta que termine (puede tardar 3-5 minutos)

### D. Buscar tu IP local
**En Windows:**
1. En la terminal escribe:
```bash
ipconfig
```
2. Busca esta línea: `IPv4 Address. . . : 192.168.X.X`
3. **ANOTA ESE NÚMERO** (ejemplo: 192.168.1.105)

**En Mac:**
1. En la terminal escribe:
```bash
ifconfig | grep "inet 192"
```
2. **ANOTA EL NÚMERO** que aparece (ejemplo: 192.168.1.105)

### E. Crear archivo de configuración
```bash
copy .env.example .env.local
```
En Mac usa: `cp .env.example .env.local`

### F. Editar configuración
1. En Visual Studio Code, busca: `.env.local` (en la raíz)
2. **EDITA ESTAS LÍNEAS:**

```env
# CAMBIA ESTA IP POR LA QUE ANOTASTE
EXPO_PUBLIC_API_HOST=192.168.1.105

# NO CAMBIAR (déjalo en 5000)
EXPO_PUBLIC_API_PORT=5000

# NO CAMBIAR (déjalo en true)
EXPO_PUBLIC_DISABLE_ERROR_ALERTS=true
```

3. **Guarda el archivo** con `Ctrl+S` o `Cmd+S`

### G. Iniciar la app
```bash
npm start
```

✅ **ÉXITO SI VES:** Un código QR grande en la terminal

---

## 📱 PASO 4: VER LA APP EN TU TELÉFONO

### En Android:
1. **Instala "Expo Go"** desde Play Store
2. Abre Expo Go
3. Escanea el código QR de la terminal

### En iPhone:
1. **Instala "Expo Go"** desde App Store
2. Abre la cámara normal del iPhone
3. Escanea el código QR
4. Toca la notificación para abrir en Expo Go

### En tu computadora:
- Presiona `W` en la terminal para abrir en navegador

---

## 🖥️ PASO 5: PANEL DE ADMINISTRACIÓN (Opcional)

### A. Abrir TERCERA terminal nueva
```bash
cd Desktop/rapigoo/rapigoo-app/admin
npm install
npm start
```

### B. Abrir en navegador
Se abrirá automáticamente en: http://localhost:3001

---

## 👤 USUARIOS PARA PROBAR

Después de crear los usuarios demo, puedes entrar con:

**Cliente Normal:**
- Email: `cliente@demo.com`
- Contraseña: `Demo123!`

**Dueño de Tienda:**
- Email: `comerciante@demo.com`
- Contraseña: `Demo123!`

**Repartidor:**
- Email: `delivery@demo.com`
- Contraseña: `Demo123!`

---

## ❌ PROBLEMAS COMUNES Y SOLUCIONES

### "No se puede conectar al servidor"
1. **Verifica que el backend esté corriendo** (debe decir "Server running on port 5000")
2. **Verifica tu IP** en .env.local sea correcta
3. **Tu teléfono y computadora deben estar en el mismo WiFi**

### "MongoDB connection failed"
1. **Verifica que el link de MongoDB Atlas esté correcto** en backend/.env
2. **Debe empezar con:** `mongodb+srv://`
3. **Verifica usuario y contraseña** en el link
4. Si no tienes el link, pídelo a quien te compartió el proyecto

### "command not found: npm"
1. **Reinstala Node.js** y reinicia la computadora

### "EACCES permission denied"
**En Mac/Linux**, agrega `sudo` antes del comando:
```bash
sudo npm install -g expo-cli
```

### La app no carga en el teléfono
1. **Desactiva el firewall** temporalmente
2. **Conecta ambos dispositivos al mismo WiFi**
3. **Reinicia Expo** con `Ctrl+C` y luego `npm start`

---

## 🎯 RESUMEN - PARA CORRER TODO:

**Necesitas 3 terminales abiertas:**

**Terminal 1 - Backend:**
```bash
cd Desktop/rapigoo/rapigoo-app/backend
npm start
```

**Terminal 2 - App:**
```bash
cd Desktop/rapigoo/rapigoo-app
npm start
```

**Terminal 3 - Admin (opcional):**
```bash
cd Desktop/rapigoo/rapigoo-app/admin
npm start
```

---

## 🆘 ¿NECESITAS AYUDA?

Si algo no funciona:
1. **Toma captura de pantalla del error**
2. **Verifica que seguiste todos los pasos**
3. **Reinicia tu computadora y vuelve a intentar**
4. **Asegúrate que todas las terminales estén abiertas**

---

🎉 **¡LISTO! Ya deberías poder ver la app funcionando**