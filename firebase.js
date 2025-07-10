// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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

export { auth };
