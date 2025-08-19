// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAJpQ9qqo1Gm-EiBYWmiIZXtcZmxx0cQbI",
  authDomain: "my-app-8379e.firebaseapp.com",
  projectId: "my-app-8379e",
  storageBucket: "my-app-8379e.appspot.com", 
  messagingSenderId: "284589313996",
  appId: "1:284589313996:web:f9359ba73c35616651d769"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Inicializar messaging solo si está soportado (web)
let messaging = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}

export { auth, messaging, app };
