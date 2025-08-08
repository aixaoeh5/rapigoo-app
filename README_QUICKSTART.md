# 🚀 Rapigoo App - Inicio Rápido

## ⚡ Configuración automática para cualquier desarrollador

### 1️⃣ Clonar el proyecto
```bash
git clone [url-del-repo]
cd rapigoo-app
```

### 2️⃣ Configuración automática
```bash
npm run setup  # Configura todo automáticamente
```
El script detecta automáticamente tu IP y configura el proyecto.

### 3️⃣ Iniciar la aplicación
```bash
npm run dev  # Inicia backend + frontend automáticamente
```

### 4️⃣ Acceder a la app
- **📱 Expo Go**: Escanea el QR (IP detectada automáticamente)
- **🌐 Web**: Presiona 'w' en la terminal
- **📱 Android**: Presiona 'a' (requiere emulador)

## 🎯 Para desarrolladores que llegan por primera vez

**NO necesitas configurar IPs manualmente**. El sistema detecta automáticamente:
- Tu IP local para dispositivos físicos
- `10.0.2.2` para emulador Android
- `localhost` para desarrollo web

## 📱 Credenciales de prueba

### Usuario normal:
- Email: test@example.com
- Password: test123

### Comerciante:
- Email: merchant@example.com
- Password: test123

## 🛠️ Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run setup` | Configuración inicial automática |
| `npm run dev` | Inicia backend + frontend |
| `npm run install:all` | Instala todas las dependencias |
| `npm run clean` | Limpia y reinstala todo |
| `npm test` | Ejecuta tests |

## ⚠️ Problemas comunes

### "Cannot connect to backend"
```bash
# Encuentra tu IP local
ipconfig  # Windows
ifconfig # Mac/Linux

# Actualiza config/api.js con tu IP
```

### "Email not sending"
- Lee SETUP_PHASES.md → Fase 2
- O usa modo desarrollo (códigos en consola)

### "Expo login required"
```bash
npx expo login
# O usa: npm run expo -- --offline
```

## 📚 Documentación completa

- **SETUP_PHASES.md** - Configuración detallada por fases
- **backend/README.api.md** - Documentación de la API
- **ROADMAP_MVP_RAPIGOO.md** - Features y roadmap

## 🆘 ¿Necesitas ayuda?

1. Revisa los logs de la consola
2. Verifica que el backend esté corriendo
3. Asegúrate de usar la IP correcta
4. Crea un issue en GitHub

---

**Tip**: Usa `npm run dev` para iniciar todo de una vez 🎉