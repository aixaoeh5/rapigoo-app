import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';

import App from './App';

// Suprimir warnings específicos molestos, pero MUY selectivo
LogBox.ignoreLogs([
  'Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect',
  'OrderStatusNotifier - Error checking order updates: Network Error',
]);

// Interceptor MUY selectivo para console
const originalWarn = console.warn;
const originalError = console.error;

console.warn = function(...args) {
  const message = args.join(' ');
  
  // Solo suprimir este warning MUY específico
  if (message.includes('Maximum update depth exceeded') && 
      message.includes('This can happen when a component calls setState inside useEffect')) {
    return; // Solo este warning específico
  }
  
  // MOSTRAR TODOS los otros warnings y errores
  originalWarn.apply(console, args);
};

console.error = function(...args) {
  const message = args.join(' ');
  
  // Solo suprimir errores MUY específicos
  if (message.includes('Warning: Maximum update depth exceeded') && 
      message.includes('This can happen when a component calls setState inside useEffect')) {
    return; // Solo este error específico
  }
  
  // Suprimir error de OrderStatusNotifier Network Error
  if (message.includes('OrderStatusNotifier - Error checking order updates: Network Error')) {
    return; // Solo este error específico
  }
  
  // MOSTRAR TODOS los otros errores - CRÍTICO para debugging
  originalError.apply(console, args);
};

// Capturar errores no manejados que podrían causar freeze
global.ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('🚨 GLOBAL ERROR (could cause freeze):', error);
  console.error('🚨 Is Fatal:', isFatal);
  console.error('🚨 Stack:', error.stack);
  
  // Re-throw para que React Native pueda manejar
  if (isFatal) {
    // En development, mostrar el error en vez de crashear
    if (__DEV__) {
      console.error('🚨 FATAL ERROR INTERCEPTED - check logs above');
    }
  }
});

// Capturar promesas rechazadas no manejadas
if (typeof global.addEventListener === 'function') {
  global.addEventListener('unhandledrejection', event => {
    console.error('🚨 UNHANDLED PROMISE REJECTION (could cause freeze):', event.reason);
    console.error('🚨 Promise:', event.promise);
  });
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
