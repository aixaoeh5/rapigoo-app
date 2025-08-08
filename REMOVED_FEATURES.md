# 🗑️ Funcionalidades Removidas

Este documento registra las funcionalidades que se removieron del proyecto y por qué.

## 📅 2025-01-02 - Login Social con Google

### ❌ Removido:
- `components/shared/SocialLogin.js` - Componente completo eliminado
- Botón "Continuar con Google" en LoginScreen
- Botón "Continuar con Google" en RegisterScreen  
- Botón "Continuar con Google" en LoginComercianteScreen

### 🤔 Razón:
- **Complejidad innecesaria para desarrollo**: Requiere configurar Client IDs específicos
- **Dependencia de configuración externa**: Necesita proyecto Firebase configurado correctamente
- **No crítico para funcionalidad**: La app funciona perfectamente con email/contraseña
- **Simplifica onboarding**: Nuevos desarrolladores pueden trabajar inmediatamente

### ✅ Funcionalidades que SÍ funcionan:
- Login con email/contraseña
- Registro con email/contraseña  
- Recuperación de contraseña
- Verificación por email (modo desarrollo)
- Navegación completa de la app

### 🔄 Cómo restaurar en el futuro:

Si necesitas restaurar el login social:

1. **Restaurar archivo SocialLogin.js**:
```javascript
// Crear components/shared/SocialLogin.js
// Ver git history para el código original
```

2. **Descomentar en pantallas**:
```javascript
// En LoginScreen.js, RegisterScreen.js, LoginComercianteScreen.js
import SocialLogin from './shared/SocialLogin';

// Descomentar:
// <SocialLogin />
```

3. **Configurar Client IDs**:
- Ir a Firebase Console: https://console.firebase.google.com/project/my-app-8379e
- Obtener Web Client ID correcto
- Configurar Android/iOS Client IDs
- Actualizar credenciales en SocialLogin.js

### 📦 Dependencias que quedaron:
- `expo-auth-session` - Se puede usar para otros OAuth (Facebook, Apple)
- `expo-facebook` - Para login con Facebook si se necesita
- `expo-apple-authentication` - Para login con Apple si se necesita
- `firebase` - Usado para otras funcionalidades (notificaciones, etc.)

Estas dependencias NO afectan el funcionamiento actual de la app.

## 🎯 Beneficios de la remoción:

1. **Experiencia de desarrollo más simple**
2. **Menos configuración requerida**
3. **Menos puntos de falla**
4. **Foco en funcionalidades core del negocio**
5. **Onboarding más rápido para nuevos desarrolladores**

## 📝 Estado actual del sistema de autenticación:

- ✅ **Email/Contraseña**: Completamente funcional
- ✅ **Registro**: Con verificación por email (modo desarrollo)
- ✅ **Recuperación**: Con códigos en consola (modo desarrollo)
- ✅ **JWT Tokens**: Sistema de autenticación robusto
- ✅ **Roles**: Usuario normal, comerciante, delivery
- ❌ **OAuth Social**: Removido temporalmente