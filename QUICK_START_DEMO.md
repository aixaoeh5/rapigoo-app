# 🚀 QUICK START - DEMO READY IN 5 MINUTES

## Step 1: Start Backend (1 minute)
```bash
cd backend
node server-quick.js
```
**Wait for**: `🚀 Quick Server corriendo en http://0.0.0.0:5000`

## Step 2: Setup Port Forwarding (1 minute)
**Windows PowerShell (as Administrator):**
```powershell
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=10.0.0.198 connectport=5000 connectaddress=172.26.236.81
```

## Step 3: Create Demo Data (1 minute)
```bash
node resetDemo.js
```

## Step 4: Start App (1 minute)
```bash
expo start -c
```

## Step 5: Test Login (1 minute)
**On your device, test one login:**
- Email: `delivery@demo.com`
- Password: `demo123`

**If login works** ✅ → Demo is ready!
**If login fails** ❌ → Check network debug tool

---

## 🎬 DEMO ACCOUNTS
- **Customer**: cliente@demo.com / demo123
- **Merchant**: comerciante@demo.com / demo123  
- **Delivery**: delivery@demo.com / demo123

## 🆘 EMERGENCY MODE
If nothing works, the app has **mock mode** that will activate automatically and show demo data without backend connection.

## ⚡ QUICK RESET
Between demos, run:
```bash
node resetDemo.js
```

**Demo is now ready!** 🎉