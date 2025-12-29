# Guía de Testing - Rapigoo App

Esta guía completa te ayudará a probar todas las funcionalidades implementadas en la aplicación Rapigoo y verificar que todo funcione correctamente.

## Tabla de Contenidos

1. [Preparación del Entorno](#preparación-del-entorno)
2. [Testing del Backend API](#testing-del-backend-api)
3. [Testing de WebSocket](#testing-de-websocket)
4. [Testing de Pagos](#testing-de-pagos)
5. [Testing de Base de Datos](#testing-de-base-de-datos)
6. [Testing Frontend/Mobile](#testing-frontendmobile)
7. [Testing de Performance](#testing-de-performance)
8. [Testing de Integración E2E](#testing-de-integración-e2e)
9. [Debugging y Logs](#debugging-y-logs)

## Preparación del Entorno

### 1. Verificar Servicios Requeridos

```bash
# Verificar MongoDB está corriendo
mongosh --eval "db.runCommand('ping')"

# Verificar Redis (si está configurado)
redis-cli ping

# Verificar variables de entorno
cat .env
```

### 2. Instalar y Ejecutar Backend

```bash
cd backend
npm install
npm run dev
```

Verificar que el servidor inicie sin errores en http://localhost:5000

### 3. Herramientas de Testing

- **Postman/Insomnia**: Para testing de API REST
- **WebSocket King**: Para testing de WebSocket
- **MongoDB Compass**: Para verificar datos
- **Browser DevTools**: Para debugging frontend

## Testing del Backend API

### 1. Endpoint Base

```bash
curl http://localhost:5000/
```

**Respuesta esperada:**
```json
{
  "message": "API Rapigoo",
  "version": "1.0.0",
  "status": "active"
}
```

### 2. Autenticación

#### Registro de Usuario
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Usuario Test",
    "email": "test@example.com",
    "password": "123456",
    "phone": "+1234567890"
  }'
```

#### Login de Usuario
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "123456"
  }'
```

**Guardar el token de la respuesta para las siguientes pruebas**

#### Verificar Perfil
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Comerciantes

#### Registro de Comerciante
```bash
curl -X POST http://localhost:5000/api/merchant/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Restaurante Test",
    "email": "restaurant@example.com",
    "password": "123456",
    "phone": "+1234567890",
    "businessName": "Mi Restaurante",
    "businessType": "restaurant",
    "address": {
      "street": "Calle Principal 123",
      "city": "Mi Ciudad",
      "state": "Mi Estado",
      "zipCode": "12345",
      "coordinates": {
        "lat": -34.6037,
        "lng": -58.3816
      }
    }
  }'
```

### 4. Servicios

#### Crear Servicio (requiere token de comerciante)
```bash
curl -X POST http://localhost:5000/api/services \
  -H "Authorization: Bearer MERCHANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pizza Margherita",
    "description": "Pizza clásica con tomate y mozzarella",
    "price": 15.99,
    "category": "food",
    "subcategory": "pizza",
    "isActive": true
  }'
```

#### Obtener Servicios
```bash
curl -X GET "http://localhost:5000/api/services?page=1&limit=10"
```

### 5. Búsqueda

#### Búsqueda de Servicios
```bash
curl -X GET "http://localhost:5000/api/search/services?q=pizza&category=food&page=1&limit=10"
```

#### Búsqueda de Comerciantes
```bash
curl -X GET "http://localhost:5000/api/search/merchants?q=restaurante&rating=4&page=1&limit=10"
```

### 6. Carrito de Compras

#### Agregar al Carrito
```bash
curl -X POST http://localhost:5000/api/cart/add \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "SERVICE_ID_HERE",
    "quantity": 2
  }'
```

#### Ver Carrito
```bash
curl -X GET http://localhost:5000/api/cart \
  -H "Authorization: Bearer USER_TOKEN"
```

### 7. Pedidos

#### Crear Pedido
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deliveryAddress": {
      "street": "Mi Dirección 456",
      "city": "Mi Ciudad",
      "coordinates": {
        "lat": -34.6037,
        "lng": -58.3816
      }
    },
    "paymentMethod": "card",
    "notes": "Sin cebolla por favor"
  }'
```

#### Obtener Pedidos del Usuario
```bash
curl -X GET http://localhost:5000/api/orders/my \
  -H "Authorization: Bearer USER_TOKEN"
```

### 8. Favoritos

#### Agregar a Favoritos
```bash
curl -X POST http://localhost:5000/api/favorites \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "service",
    "itemId": "SERVICE_ID_HERE"
  }'
```

#### Obtener Favoritos
```bash
curl -X GET http://localhost:5000/api/favorites \
  -H "Authorization: Bearer USER_TOKEN"
```

### 9. Pagos (requiere configuración de Stripe)

#### Crear Payment Intent
```bash
curl -X POST http://localhost:5000/api/payments/create-payment-intent \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID_HERE"
  }'
```

### 10. Reviews

#### Crear Review (después de entregar pedido)
```bash
curl -X POST http://localhost:5000/api/reviews \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ORDER_ID_HERE",
    "merchantRating": 5,
    "serviceRating": 4,
    "deliveryRating": 5,
    "generalComment": "Excelente servicio y comida deliciosa"
  }'
```

## Testing de WebSocket

### 1. Conexión Básica

Usar una herramienta como **WebSocket King** o código JavaScript:

```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'YOUR_JWT_TOKEN_HERE'
  }
});

socket.on('connect', () => {
  console.log('Conectado al servidor WebSocket');
});

socket.on('error', (error) => {
  console.error('Error de conexión:', error);
});
```

### 2. Testing de Chat

```javascript
// Unirse a un chat
socket.emit('join_chat', { chatId: 'CHAT_ID_HERE' });

// Enviar mensaje
socket.emit('send_message', {
  chatId: 'CHAT_ID_HERE',
  content: 'Hola, este es un mensaje de prueba',
  messageType: 'text'
});

// Escuchar mensajes nuevos
socket.on('new_message', (data) => {
  console.log('Nuevo mensaje:', data);
});

// Indicar que está escribiendo
socket.emit('typing_start', { chatId: 'CHAT_ID_HERE' });

// Parar de escribir
setTimeout(() => {
  socket.emit('typing_stop', { chatId: 'CHAT_ID_HERE' });
}, 3000);
```

### 3. Testing de Delivery Tracking

```javascript
// Unirse al tracking de delivery
socket.emit('join_delivery_tracking', { orderId: 'ORDER_ID_HERE' });

// Simular actualización de ubicación (como delivery person)
socket.emit('delivery_location_update', {
  orderId: 'ORDER_ID_HERE',
  location: {
    lat: -34.6037,
    lng: -58.3816
  },
  status: 'on_way'
});

// Escuchar actualizaciones
socket.on('delivery_location_updated', (data) => {
  console.log('Ubicación actualizada:', data);
});
```

## Testing de Pagos

### 1. Configurar Stripe Test Mode

En `.env`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### 2. Tarjetas de Prueba de Stripe

- **Visa exitosa**: 4242424242424242
- **Visa rechazada**: 4000000000000002
- **Requiere autenticación**: 4000002500003155

### 3. Webhook Testing

Instalar Stripe CLI:
```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

## Testing de Base de Datos

### 1. Verificar Colecciones

```javascript
// En MongoDB Compass o mongosh
use rapigoo

// Ver todas las colecciones
show collections

// Verificar usuarios
db.users.findOne()

// Verificar servicios
db.services.findOne()

// Verificar pedidos
db.orders.findOne()

// Verificar chats
db.chats.findOne()

// Verificar reviews
db.reviews.findOne()
```

### 2. Verificar Índices

```javascript
// Verificar índices de texto para búsqueda
db.services.getIndexes()
db.users.getIndexes()
db.reviews.getIndexes()
```

## Testing Frontend/Mobile

### 1. React Native (si tienes la app)

```bash
# Ejecutar en modo desarrollo
npx expo start

# Para iOS simulator
npx expo start --ios

# Para Android emulator
npx expo start --android
```

### 2. Verificaciones en la App

- [ ] Login/Registro funciona
- [ ] Búsqueda de servicios funciona
- [ ] Carrito se actualiza correctamente
- [ ] Proceso de checkout completo
- [ ] Notificaciones push funcionan
- [ ] Chat en tiempo real funciona
- [ ] Tracking de delivery funciona
- [ ] Reviews se pueden crear y ver

## Testing de Performance

### 1. Load Testing con Artillery

```bash
npm install -g artillery

# Crear archivo artillery-test.yml
artillery run artillery-test.yml
```

Ejemplo de `artillery-test.yml`:
```yaml
config:
  target: 'http://localhost:5000'
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "API Basic Test"
    requests:
      - get:
          url: "/"
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "123456"
```

### 2. Memory y CPU Monitoring

```bash
# Instalar herramientas de monitoreo
npm install -g clinic

# Ejecutar con monitoreo
clinic doctor -- node server.js
```

## Testing de Integración E2E

### 1. Flujo Completo de Usuario

1. **Registro**: Usuario se registra
2. **Login**: Usuario hace login
3. **Búsqueda**: Busca servicios
4. **Carrito**: Agrega servicios al carrito
5. **Checkout**: Realiza pedido
6. **Pago**: Procesa pago
7. **Chat**: Inicia chat con comerciante
8. **Tracking**: Rastrea delivery
9. **Review**: Deja review después de recibir

### 2. Flujo Completo de Comerciante

1. **Registro**: Comerciante se registra
2. **Perfil**: Completa perfil de negocio
3. **Servicios**: Crea servicios
4. **Pedidos**: Recibe y gestiona pedidos
5. **Chat**: Comunica con clientes
6. **Reviews**: Responde a reviews

## Debugging y Logs

### 1. Logs del Servidor

```bash
# Ver logs en tiempo real
tail -f server.log

# Ver logs de errores
grep -i error server.log

# Ver logs de una fecha específica
grep "2024-01-15" server.log
```

### 2. Debug de Base de Datos

```javascript
// Habilitar logs de MongoDB
mongoose.set('debug', true);

// Ver queries ejecutadas
db.setLogLevel(1)
```

### 3. Debug de WebSocket

```javascript
// En el frontend, habilitar debug
localStorage.debug = 'socket.io-client:*';

// En el backend
DEBUG=socket.io:* node server.js
```

## Checklist de Testing

### Backend API ✅
- [ ] Servidor inicia sin errores
- [ ] Endpoints de autenticación funcionan
- [ ] CRUD de servicios funciona
- [ ] Sistema de búsqueda funciona
- [ ] Carrito de compras funciona
- [ ] Sistema de pedidos funciona
- [ ] Favoritos funcionan
- [ ] Reviews funcionan
- [ ] Rate limiting funciona
- [ ] Validación de datos funciona

### WebSocket ✅
- [ ] Conexión establecida correctamente
- [ ] Autenticación WebSocket funciona
- [ ] Chat en tiempo real funciona
- [ ] Delivery tracking funciona
- [ ] Notificaciones push funcionan

### Base de Datos ✅
- [ ] Conexión a MongoDB establecida
- [ ] Índices creados correctamente
- [ ] Queries funcionan eficientemente
- [ ] Validaciones de esquema funcionan

### Pagos ✅
- [ ] Stripe configurado correctamente
- [ ] Payment Intents se crean
- [ ] Webhooks funcionan
- [ ] Refunds funcionan

### Performance ✅
- [ ] Respuestas rápidas (< 500ms)
- [ ] Manejo de carga adecuado
- [ ] Memory leaks no detectados
- [ ] CPU usage estable

### Seguridad ✅
- [ ] JWT tokens funcionan
- [ ] Rate limiting activo
- [ ] Sanitización de datos
- [ ] CORS configurado
- [ ] Headers de seguridad presentes

## Comandos Rápidos de Testing

```bash
# Testing completo del backend
npm test

# Testing específico de rutas
npm run test:routes

# Testing de integración
npm run test:integration

# Coverage report
npm run test:coverage

# Linting
npm run lint

# Type checking (si usas TypeScript)
npm run type-check
```

## Troubleshooting Común

### Problema: "Cannot connect to MongoDB"
**Solución**: Verificar que MongoDB esté corriendo y la URL sea correcta

### Problema: "JWT token invalid"
**Solución**: Verificar que JWT_SECRET esté configurado y el token no haya expirado

### Problema: "WebSocket connection failed"
**Solución**: Verificar CORS y que el cliente esté enviando el token correcto

### Problema: "Stripe webhook signature invalid"
**Solución**: Verificar que STRIPE_WEBHOOK_SECRET sea correcto

### Problema: "Rate limit exceeded"
**Solución**: Esperar o ajustar configuración de rate limiting en desarrollo

---

Esta guía cubre todos los aspectos importantes del testing. Asegúrate de probar cada funcionalidad paso a paso y documentar cualquier problema que encuentres.