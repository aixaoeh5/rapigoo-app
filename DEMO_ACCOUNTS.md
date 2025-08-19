# 🎯 CUENTAS DE DEMOSTRACIÓN - RAPIGOO

## 📱 APLICACIÓN MÓVIL

### 1. CUENTA CLIENTE (Consumidor)
```
Email: cliente-test@rapigoo.com
Contraseña: 123456
```
**Información del perfil:**
- Nombre: Juan Pérez
- Teléfono: 809-555-0100
- Dirección: Calle Principal #123, Los Jardines, Santo Domingo
- Preferencias: Comida dominicana, sin gluten
- Método de pago preferido: Tarjeta

**Funcionalidades disponibles:**
- ✅ Buscar restaurantes por categoría
- ✅ Ver menú completo de "Restaurante El Sabroso"
- ✅ Agregar productos al carrito
- ✅ Realizar pedidos
- ✅ Ver historial de pedidos (2 pedidos de ejemplo)
- ✅ Dejar reseñas en pedidos completados
- ✅ Gestionar perfil y configuración
- ✅ Modo oscuro disponible
- ✅ Cambiar contraseña
- ✅ Métodos de pago

---

### 2. CUENTA COMERCIANTE
```
Email: mi-comerciante@rapigoo.com
Contraseña: 123456
```
**Información del negocio:**
- Nombre: Restaurante El Sabroso
- Propietaria: María Rodríguez
- RNC: 123456789
- Teléfono: 809-555-0200
- Dirección: Av. Winston Churchill #500, Plaza Comercial
- Horario: 8:00 AM - 10:00 PM
- Categoría: Restaurante
- Rating: ⭐ 4.5 (127 reseñas)

**Menú disponible (13 productos):**

**Platos Principales:**
- Mangú Tres Golpes - RD$285
- Pollo Guisado - RD$350
- Sancocho Dominicano - RD$450 (10% descuento)
- Bandeja Paisa Criolla - RD$425

**Acompañantes:**
- Tostones - RD$85
- Yuca Hervida - RD$75
- Ensalada Verde - RD$95

**Bebidas:**
- Morir Soñando - RD$85
- Jugo de Chinola - RD$65
- Mama Juana - RD$150

**Postres:**
- Flan de Coco - RD$120
- Habichuelas con Dulce - RD$95
- Bizcocho Dominicano - RD$135

**Funcionalidades disponibles:**
- ✅ Ver pedidos en tiempo real
- ✅ Gestionar menú y productos
- ✅ Actualizar disponibilidad
- ✅ Ver estadísticas de ventas
- ✅ Gestionar perfil del negocio
- ✅ Responder reseñas

---

### 3. CUENTA DELIVERY
```
Email: carlos-delivery@rapigoo.com
Contraseña: 123456
```
**Información del delivery:**
- Nombre: Carlos Delivery
- Teléfono: 809-555-0300
- Vehículo: Honda CB190R (Motocicleta)
- Placa: H123456
- Licencia: LIC789012
- Status: Aprobado y disponible
- Rating promedio: ⭐ 4.7 (45 entregas)
- Zona de trabajo: Santo Domingo centro (15km radio)
- Ubicación actual: Plaza de la Cultura

**Funcionalidades disponibles:**
- ✅ Ver pedidos disponibles para pickup
- ✅ Tomar pedidos asignados
- ✅ Navegación GPS a ubicación del comerciante
- ✅ Confirmar llegada al pickup (verificación de proximidad)
- ✅ Navegación GPS a ubicación del cliente
- ✅ Actualizar estado de entrega en tiempo real
- ✅ Ver historial de entregas
- ✅ Gestionar disponibilidad (disponible/no disponible)

---

## 💻 PANEL ADMINISTRATIVO WEB

### CUENTA ADMIN
```
URL: http://localhost:3001
Email: admin@rapigoo.com
Contraseña: 2507rapigoo
```
**Funcionalidades disponibles:**
- ✅ Ver estadísticas generales
- ✅ Gestionar comerciantes (aprobar/rechazar)
- ✅ Ver todos los pedidos del sistema
- ✅ Dashboard con métricas en tiempo real

---

## 🎮 FLUJO DE DEMOSTRACIÓN SUGERIDO

### Demo Cliente:
1. Iniciar sesión con cuenta cliente
2. Buscar "El Sabroso" o navegar por categoría "Restaurante"
3. Ver el menú completo con fotos
4. Agregar varios productos al carrito
5. Proceder al checkout
6. Ver historial de pedidos
7. Mostrar pedido entregado con reseña

### Demo Comerciante:
1. Iniciar sesión con cuenta comerciante
2. Ver dashboard con pedido activo (preparándose)
3. Cambiar estado del pedido
4. Ver historial de ventas
5. Editar disponibilidad de un producto
6. Ver perfil público del restaurante

### Demo Admin Web:
1. Acceder al dashboard web
2. Ver estadísticas generales
3. Revisar lista de comerciantes
4. Ver gestión de pedidos
5. Aprobar/rechazar comerciantes pendientes

---

## 📝 NOTAS IMPORTANTES

1. **Pedidos de ejemplo**: Hay 2 pedidos creados:
   - Uno completado hace 2 días (con reseña 5⭐)
   - Uno en preparación (tiempo real)

2. **Búsqueda**: El cliente puede buscar "Sabroso" o "El Sabroso" para encontrar el restaurante

3. **Imágenes**: Todos los productos tienen imágenes de ejemplo de Unsplash

4. **Pagos**: Configurados métodos efectivo y tarjeta

5. **Notificaciones**: Las preferencias están activadas para ordernar actualizaciones en tiempo real

---

## 🚀 COMANDOS ÚTILES

```bash
# Reiniciar backend
cd backend && npm start

# Reiniciar app móvil
npm start

# Reiniciar admin web
cd admin && npm start

# Recrear datos de demo
cd backend && node setupDemoAccounts.js
```

---

## 🔧 SOLUCIÓN DE PROBLEMAS

**Si el login no funciona:**
- Verificar que el backend esté corriendo en puerto 5000
- Verificar la IP en config/api.js

**Si no se ven los productos:**
- Ejecutar: `node setupDemoAccounts.js`
- Verificar que MongoDB esté activo

**Si el admin web da error:**
- Reiniciar el backend para aplicar nuevos endpoints
- Verificar que esté en puerto 3001