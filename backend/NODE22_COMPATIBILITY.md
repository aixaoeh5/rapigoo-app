# ⚠️ Compatibilidad con Node.js 22+

## Problema Identificado

El backend tiene problemas de compatibilidad con Node.js 22 debido a cambios en cómo Node maneja las propiedades de los objetos `req` y `res` en Express.

### Errores encontrados:

1. **express-mongo-sanitize**: 
   - Error: `Cannot set property query of #<IncomingMessage> which has only a getter`
   - Causa: El middleware intenta modificar `req.query` que ahora es de solo lectura

2. **Middleware de performance**:
   - Error: `Cannot set headers after they are sent to the client`
   - Causa: Intenta establecer headers después de que la respuesta fue enviada

## Soluciones Aplicadas (Temporales)

### 1. Sanitización Manual
Reemplazamos `express-mongo-sanitize` con una implementación manual básica:

```javascript
app.use((req, res, next) => {
  const sanitizeObject = (obj) => {
    // Remover operadores MongoDB peligrosos
    // como $gt, $ne, etc.
  };
  
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  next();
});
```

### 2. Performance Headers
Agregamos verificación antes de establecer headers:

```javascript
if (!res.headersSent) {
  res.set({
    'X-Response-Time': duration,
    // otros headers
  });
}
```

### 3. Query Optimization
Temporalmente deshabilitado el middleware `optimizeQueries()` que modifica `req.query`.

## Soluciones Permanentes Recomendadas

### Opción 1: Downgrade de Node.js
```bash
# Usar Node.js 20 LTS (recomendado)
nvm install 20
nvm use 20
```

### Opción 2: Actualizar Dependencias
```bash
# Buscar versiones compatibles con Node.js 22
npm update express-mongo-sanitize
npm update express
```

### Opción 3: Usar Alternativas
- En lugar de `express-mongo-sanitize`, usar `mongo-sanitize` o implementación propia
- Usar middleware más modernos compatibles con Node.js 22

## Estado Actual

✅ **El backend funciona** con las soluciones temporales aplicadas
⚠️ **Seguridad**: La sanitización manual es básica pero funcional
📝 **TODO**: Implementar solución permanente antes de producción

## Verificación

Para verificar que todo funciona:
```bash
# Test de login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@test.com","password":"test123"}'
```

## Referencias

- [Node.js 22 Breaking Changes](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V22.md)
- [Express Compatibility Issues](https://github.com/expressjs/express/issues)
- [express-mongo-sanitize Issue #40](https://github.com/fiznool/express-mongo-sanitize/issues/40)