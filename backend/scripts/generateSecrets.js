const crypto = require('crypto');

// Generar un JWT Secret seguro
const generateJWTSecret = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Generar una contraseña aleatoria segura
const generatePassword = () => {
  const length = 32;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  
  return password;
};

console.log('🔐 Generando secretos seguros para tu aplicación...\n');

console.log('JWT_SECRET:');
console.log(generateJWTSecret());
console.log('\n');

console.log('Contraseña segura sugerida:');
console.log(generatePassword());
console.log('\n');

console.log('⚠️  IMPORTANTE:');
console.log('1. Copia estos valores a tu archivo .env');
console.log('2. NUNCA compartas estos valores');
console.log('3. NUNCA los subas a git');
console.log('4. Cambia la contraseña del email inmediatamente');
console.log('5. Genera un App Password en Gmail para EMAIL_PASS');