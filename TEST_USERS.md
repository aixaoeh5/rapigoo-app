# 👥 Usuarios de Prueba - Rapigoo App

Estos usuarios están listos para usar en la aplicación. **No necesitas registrarlos**, solo inicia sesión directamente.

## 📋 Lista de Usuarios

### 🛒 Cliente Normal
- **Email**: `cliente@test.com`
- **Contraseña**: `test123`
- **Rol**: Cliente
- **Teléfono**: +505 8888-1111
- **Estado**: Verificado y activo

**Funcionalidades que puede probar:**
- Navegación por categorías
- Ver perfiles de comerciantes
- Hacer pedidos
- Ver historial de pedidos
- Gestionar favoritos

---

### 🏪 Comerciante
- **Email**: `comerciante@test.com`
- **Contraseña**: `test123`
- **Rol**: Comerciante
- **Teléfono**: +505 8888-2222
- **Negocio**: Restaurante Test
- **Estado**: Aprobado y activo

**Funcionalidades que puede probar:**
- Panel de comerciante
- Gestionar servicios/productos
- Ver pedidos recibidos
- Gestionar perfil del negocio
- Estadísticas básicas

---

### 👨‍💼 Administrador
- **Email**: `admin@test.com`
- **Contraseña**: `admin123`
- **Rol**: Admin
- **Teléfono**: +505 8888-0000
- **Estado**: Activo

**Funcionalidades que puede probar:**
- Panel administrativo (si existe)
- Gestión de usuarios
- Moderación de contenido
- Estadísticas globales

---

## 🚀 Cómo usar los usuarios de prueba

### 1. Iniciar la app
```bash
npm run dev
```

### 2. Ir a la pantalla de login
- Abre la app en Expo Go
- Ve a la pantalla de login (no de registro)

### 3. Usar cualquier usuario
- Introduce el email y contraseña de arriba
- ¡Listo! Ya estás dentro de la app

## 🔧 Endpoints de API para desarrolladores

Si tienes el backend corriendo en modo desarrollo:

### Listar usuarios de prueba
```bash
GET http://localhost:5000/api/test/test-users
```

### Recrear usuarios de prueba
```bash
POST http://localhost:5000/api/test/create-test-users
```

### Verificar estado del sistema
```bash
GET http://localhost:5000/api/test/email-status
```

## 📝 Notas importantes

### ✅ Lo que SÍ funciona:
- Login inmediato (sin verificación por email)
- Navegación por la app según el rol
- Todas las funcionalidades básicas

### ⚠️ Roles disponibles:
- **cliente**: Usuario normal que hace pedidos
- **comerciante**: Usuario que vende productos/servicios  
- **admin**: Usuario administrador

### ❌ Roles NO disponibles:
- **delivery**: No existe en el modelo actual de la app

## 🔄 Recrear usuarios

Si por alguna razón necesitas recrear los usuarios:

```bash
# Desde el directorio del backend
node scripts/createTestUsers.js
```

O desde el frontend usando el endpoint:
```bash
curl -X POST http://localhost:5000/api/test/create-test-users
```

## 🧪 Para pruebas específicas

### Probar flujo de cliente:
1. Login con `cliente@test.com`
2. Navegar por categorías
3. Ver comerciantes disponibles
4. Simular pedidos

### Probar flujo de comerciante:
1. Login con `comerciante@test.com` 
2. Acceder al panel de comerciante
3. Gestionar productos/servicios
4. Ver dashboard

### Probar flujo de admin:
1. Login con `admin@test.com`
2. Acceder a funciones administrativas
3. Gestionar otros usuarios (si está implementado)

---

**💡 Tip**: Estos usuarios se recrean automáticamente cada vez que ejecutas el script, así que siempre tendrás datos limpios para testing.