# 🚀 Guía de Configuración - Backend Rapigoo

## Requisitos Previos

- Node.js v14 o superior
- MongoDB instalado localmente o cuenta en MongoDB Atlas
- Cuenta de Gmail para notificaciones
- Proyecto de Firebase configurado

## Instalación Paso a Paso

### 1. Clonar el Repositorio

```bash
git clone [URL_DEL_REPO]
cd rapigoo-app/backend
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

1. Copiar el archivo de ejemplo:
```bash
cp .env.example .env
```

2. Editar `.env` con tus valores:

```env
# Configuración del Servidor
PORT=5000
NODE_ENV=development

# Base de Datos
MONGO_URI=mongodb://localhost:27017/rapigoo_db

# Autenticación
JWT_SECRET=tu_secret_super_seguro_aqui

# Email (Gmail)
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password_de_gmail

# URLs del Frontend
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
```

### 4. Configurar Gmail para Notificaciones

1. Ve a tu cuenta de Google
2. Activa la verificación en 2 pasos
3. Genera un App Password:
   - Ve a: https://myaccount.google.com/apppasswords
   - Selecciona "Mail" y "Other"
   - Copia el password generado
   - Pégalo en `EMAIL_PASS` en tu `.env`

### 5. Configurar Firebase Admin

1. Ve a tu consola de Firebase
2. Project Settings → Service Accounts
3. Generate New Private Key
4. Guarda el archivo como `firebase-service-account.json` en la carpeta `backend/`
5. **IMPORTANTE**: Este archivo ya está en `.gitignore`, NO lo subas a git

### 6. Generar JWT Secret Seguro

```bash
node scripts/generateSecrets.js
```

Copia el JWT_SECRET generado y pégalo en tu `.env`

### 7. Iniciar MongoDB

Si usas MongoDB local:
```bash
mongod
```

Si usas MongoDB Atlas, asegúrate de:
- Tener tu IP en whitelist
- Usar la connection string correcta en `MONGO_URI`

### 8. Iniciar el Servidor

Modo desarrollo (con auto-reload):
```bash
npm run dev
```

Modo producción:
```bash
npm start
```

## Verificación de la Instalación

1. El servidor debe mostrar:
   - ✅ Conectado a MongoDB
   - ✅ Firebase Admin inicializado correctamente
   - 🚀 Servidor corriendo en el puerto 5000
   - 🔒 Modo: development

2. Prueba la API:
```bash
curl http://localhost:5000/
```

Deberías recibir:
```json
{
  "message": "API Rapigoo",
  "version": "1.0.0",
  "status": "active"
}
```

## Solución de Problemas Comunes

### Error: "Cannot connect to MongoDB"
- Verifica que MongoDB esté corriendo
- Revisa que `MONGO_URI` sea correcto
- Si usas MongoDB Atlas, verifica tu IP whitelist

### Error: "Firebase Admin no inicializado"
- Asegúrate de tener `firebase-service-account.json` en la carpeta backend
- Verifica que el archivo tenga el formato JSON correcto

### Error: "Email sending failed"
- Verifica que hayas generado un App Password (no uses tu contraseña normal)
- Asegúrate de que la verificación en 2 pasos esté activa
- Revisa que `EMAIL_USER` y `EMAIL_PASS` estén correctos

## Seguridad

⚠️ **NUNCA** subas a git:
- El archivo `.env`
- `firebase-service-account.json`
- Cualquier archivo con credenciales

✅ **SIEMPRE**:
- Usa secretos generados aleatoriamente
- Mantén actualizadas las dependencias
- Revisa los logs regularmente

## Scripts Disponibles

- `npm start` - Inicia el servidor
- `npm run dev` - Inicia con nodemon (desarrollo)
- `npm test` - Ejecuta tests (pendiente de implementar)
- `npm audit` - Revisa vulnerabilidades

## Estructura del Proyecto

```
backend/
├── controllers/      # Lógica de negocio
├── middleware/       # Validación, auth, etc.
├── models/          # Modelos de MongoDB
├── routes/          # Definición de endpoints
├── scripts/         # Utilidades
├── .env            # Variables de entorno (NO SUBIR)
├── .env.example    # Ejemplo de variables
├── .gitignore      # Archivos ignorados por git
├── firebaseAdmin.js # Configuración Firebase
├── package.json    # Dependencias
├── server.js       # Punto de entrada
└── SETUP.md        # Este archivo
```

## Próximos Pasos

1. Configurar tests con Jest
2. Implementar CI/CD
3. Configurar monitoring con Sentry
4. Preparar deployment a producción

---

¿Problemas? Abre un issue en el repositorio.