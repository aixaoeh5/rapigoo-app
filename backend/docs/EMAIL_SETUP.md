# 📧 Configuración del Sistema de Emails

## 🔄 Modos de funcionamiento

El sistema de emails tiene dos modos:

### 🔧 Modo Desarrollo (Por defecto)
- Los códigos se muestran en la **consola del servidor**
- No se envían emails reales
- Perfecto para desarrollo local
- Se activa con `NODE_ENV=development`

### 🚀 Modo Producción
- Envía emails reales usando Gmail
- Requiere configuración de App Password
- Para ambiente de producción

## 📋 Configuración paso a paso

### Para desarrollo (No requiere configuración)

El modo desarrollo está activado por defecto. Los códigos aparecerán así:

```
============================================================
📧 EMAIL SIMULADO (MODO DESARROLLO)
============================================================
Para: usuario@example.com
Asunto: 🔐 Código de verificación - Rapigoo
🔑 CÓDIGO DE VERIFICACIÓN: 1234
Contenido HTML: [contenido del email]
============================================================
```

### Para producción (Emails reales)

#### Paso 1: Preparar cuenta de Gmail

1. **Asegurar verificación en 2 pasos**:
   - Ve a https://myaccount.google.com/security
   - Busca "Verificación en 2 pasos"
   - Actívala si no está activa

2. **Generar App Password**:
   - Ve a https://myaccount.google.com/apppasswords
   - Selecciona "Mail" como app
   - Selecciona "Other" como dispositivo
   - Nombra: "Rapigoo Backend"
   - **Copia el código de 16 caracteres**

#### Paso 2: Configurar variables de entorno

En `backend/.env`:

```bash
# Cambiar a modo producción
NODE_ENV=production

# Configurar email
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=abcdefghijklmnop  # App Password de 16 caracteres (sin espacios)
```

#### Paso 3: Verificar configuración

```bash
# Reiniciar el servidor
cd backend
npm start

# Deberías ver:
# 📧 Email Service inicializado:
#    Modo: PRODUCCIÓN
#    Email config: SÍ
```

## 🧪 Cómo probar el sistema

### En desarrollo:

1. Registra un usuario nuevo
2. Ve a la consola del servidor
3. Copia el código que aparece
4. Úsalo en la app

### En producción:

1. Registra un usuario con tu email real
2. Revisa tu bandeja de entrada
3. Usa el código recibido

## 🔍 Troubleshooting

### "Email not sending" en producción

1. **Verifica el App Password**:
   - Debe ser de 16 caracteres
   - Sin espacios ni guiones
   - Generado desde Google

2. **Verifica las variables**:
   ```bash
   echo $EMAIL_USER
   echo $EMAIL_PASS
   ```

3. **Revisa los logs del servidor**:
   ```bash
   cd backend
   npm start
   # Busca errores en la inicialización
   ```

### "Verificación en 2 pasos no activa"

1. Ve a https://myaccount.google.com/security
2. Busca "Verificación en 2 pasos"
3. Sigue el proceso de activación
4. Luego genera el App Password

### Códigos no aparecen en consola

1. Verifica que `NODE_ENV=development`
2. Reinicia el servidor backend
3. Los códigos aparecen al hacer registro/recuperación

## 📊 Estados del servicio

El servicio muestra su estado al iniciar:

```bash
# Desarrollo sin configuración
📧 Email Service inicializado:
   Modo: DESARROLLO
   Email config: NO

# Desarrollo con configuración (se usa desarrollo igual)
📧 Email Service inicializado:
   Modo: DESARROLLO  
   Email config: SÍ

# Producción configurada
📧 Email Service inicializado:
   Modo: PRODUCCIÓN
   Email config: SÍ
```

## 🔄 Cambiar entre modos

### Activar modo desarrollo:
```bash
# En backend/.env
NODE_ENV=development
# Comentar EMAIL_USER y EMAIL_PASS
```

### Activar modo producción:
```bash
# En backend/.env
NODE_ENV=production
EMAIL_USER=tu-email@gmail.com
EMAIL_PASS=tu-app-password
```

Recuerda reiniciar el servidor después de cambiar las variables.

## 📝 Tipos de emails

El sistema envía estos tipos de emails:

1. **Verificación de registro**: Código para activar cuenta nueva
2. **Recuperación de contraseña**: Código para resetear contraseña
3. **Reenvío de códigos**: Cuando el usuario solicita reenvío

Todos usan plantillas HTML responsivas con el branding de Rapigoo.