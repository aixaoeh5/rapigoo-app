/**
 * Detecta automáticamente la IP local del desarrollador
 * Funciona en Windows, Mac y Linux
 */

const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  // Prioridades de búsqueda
  const priorities = ['Wi-Fi', 'Ethernet', 'eth0', 'en0', 'wlan0'];
  
  // Buscar por prioridad
  for (const priority of priorities) {
    if (interfaces[priority]) {
      const ipv4 = interfaces[priority].find(
        iface => iface.family === 'IPv4' && !iface.internal
      );
      if (ipv4) return ipv4.address;
    }
  }
  
  // Si no encuentra por nombre, buscar cualquier IPv4 no internal
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  // Fallback a localhost
  console.warn('⚠️  No se pudo detectar IP local, usando localhost');
  return 'localhost';
}

// Para uso en React Native
if (typeof module !== 'undefined' && module.exports) {
  module.exports = getLocalIP;
}

// Imprimir la IP detectada si se ejecuta directamente
if (require.main === module) {
  console.log('🌐 IP Local detectada:', getLocalIP());
}