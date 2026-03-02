import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } 
  from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
   // 🔥 CONFIG FIREBASE (ESTO FALTA)
  const firebaseConfig = {
    apiKey: "AIzaSyDaRSANoydVBrQUBNCGVSrr0kJzcR8ZAIo",
    authDomain: "gastos-de-grupo.firebaseapp.com",
    projectId: "gastos-de-grupo",
    storageBucket: "gastos-de-grupo.firebasestorage.app",
    messagingSenderId: "1047751444208",
    appId: "1:1047751444208:web:c90a49d3c574dfbaaf6435"
  };

  // 🔥 Firebase
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
 export { 
  auth, 
  db, 
  signInAnonymously, 
  onAuthStateChanged,
  onSnapshot
};