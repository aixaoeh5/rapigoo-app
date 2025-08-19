# 🎬 RAPIGOO DEMO SCRIPT

## Pre-Demo Setup (5 minutes before demo)

### 1. Start Backend Server
```bash
cd backend
node server-quick.js
```
**Wait for**: `🚀 Quick Server corriendo en http://0.0.0.0:5000`

### 2. Create Demo Accounts & Order
```bash
# Create test accounts
node createDemoAccounts.js

# Create demo order ready for delivery
node createDemoOrder.js
```

### 3. Configure Port Forwarding (Windows)
```powershell
# Run as Administrator
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=10.0.0.198 connectport=5000 connectaddress=172.26.236.81
```

### 4. Start Mobile App
```bash
expo start -c
```

---

## DEMO FLOW (15-20 minutes)

### **PHASE 1: Customer Orders (5 minutes)**

**Device 1 - Customer Flow:**

1. **Login as Customer**
   - Email: `cliente@demo.com`
   - Password: `demo123`
   - ✅ **Expected**: Navigate to Home screen

2. **Browse Restaurants**
   - Tap "Restaurants" or browse category
   - ✅ **Expected**: See "Restaurante La Demo"

3. **Select Restaurant & Add Items**
   - Tap "Restaurante La Demo"
   - Add "Pizza Margherita" to cart
   - ✅ **Expected**: Cart shows 1 item, total ~$15.49

4. **Complete Order**
   - Tap "Checkout"
   - Confirm delivery address
   - Select "Cash" payment
   - Tap "Place Order"
   - ✅ **Expected**: Order confirmation screen

**Fallback**: If customer flow fails, say "In a real app, the customer would now place the order" and skip to merchant.

---

### **PHASE 2: Merchant Manages Order (3 minutes)**

**Device 2 - Merchant Flow:**

1. **Login as Merchant**
   - Email: `comerciante@demo.com`
   - Password: `demo123`
   - ✅ **Expected**: Navigate to Merchant Dashboard

2. **View New Order**
   - ✅ **Expected**: See new order notification or pending order
   - Tap on the order to view details

3. **Accept Order**
   - Tap "Accept Order"
   - ✅ **Expected**: Order status changes to "Preparing"

4. **Mark as Ready**
   - Wait 30 seconds (simulate cooking)
   - Tap "Mark as Ready"
   - ✅ **Expected**: Order status changes to "Ready for Pickup"

**Fallback**: If merchant dashboard fails, manually explain "The merchant receives the order and marks it ready for delivery"

---

### **PHASE 3: Delivery Picks Up & Delivers (7 minutes)**

**Device 3 - Delivery Flow:**

1. **Login as Delivery**
   - Email: `delivery@demo.com`
   - Password: `demo123`
   - ✅ **Expected**: Navigate to Delivery Dashboard

2. **View Available Orders**
   - ✅ **Expected**: See order from "Restaurante La Demo"
   - Order should show customer details and delivery address

3. **Accept Delivery**
   - Tap "Accept Delivery"
   - ✅ **Expected**: Order assigned to delivery driver

4. **Navigate to Restaurant**
   - Tap "Navigate to Restaurant"
   - ✅ **Expected**: Show route or mock navigation

5. **Mark as Picked Up**
   - Tap "Picked Up from Restaurant"
   - ✅ **Expected**: Status changes to "In Transit"

6. **Navigate to Customer**
   - Tap "Navigate to Customer"
   - ✅ **Expected**: Show route to delivery address

7. **Complete Delivery**
   - Tap "Delivered" 
   - ✅ **Expected**: Delivery marked complete

**Fallback**: If delivery flow fails, show the mock location service and explain the GPS tracking.

---

## Emergency Fallbacks

### If Network Completely Fails:
1. **Show prepared screenshots** of each flow step
2. **Explain**: "This demo shows how the three user types interact"
3. **Use mock mode**: All API calls return demo data

### If App Crashes:
1. **Restart Expo**: `expo start -c`
2. **Reset demo state**: Clear AsyncStorage
3. **Use backup device** with pre-loaded state

### If Specific Features Fail:
- **Login issues**: Use mock authentication
- **Order creation**: Show pre-created demo order
- **Maps/Navigation**: Use static map images
- **Real-time updates**: Manually progress states

---

## Demo Reset (Between Presentations)

```bash
# Reset demo state
cd backend
node -e "
const mongoose = require('mongoose');
const Order = require('./models/Order');
require('dotenv').config();

async function reset() {
  await mongoose.connect(process.env.MONGO_URI);
  await Order.deleteMany({ customer: 'demo-customer-1' });
  console.log('✅ Demo reset');
  process.exit(0);
}
reset();
"

# Recreate demo order
node createDemoOrder.js
```

---

## Key Demo Points to Emphasize

1. **Three User Types**: Clear role separation
2. **Real-time Updates**: Orders flow between users
3. **Location Tracking**: GPS integration for deliveries  
4. **Mobile-First**: Native app experience
5. **Scalability**: System handles multiple orders/drivers

## Success Metrics
- ✅ All three user types can login
- ✅ Order flows from customer → merchant → delivery
- ✅ Status updates work in real-time
- ✅ Basic navigation/maps functionality works
- ✅ Demo completes without crashes

**Total Demo Time**: 15-20 minutes + 5 minutes Q&A