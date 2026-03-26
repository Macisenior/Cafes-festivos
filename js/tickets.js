import { storage, auth, onAuthStateChanged } from "./firebase.js";
import { ref, uploadBytesResumable, getDownloadURL } 
from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

export async function subirTicket(file, grupoActivo) {

  if (!file) return null;

  try {
    // 🔐 esperar a auth
    if (!auth.currentUser) {
      await new Promise(resolve => {
        const unsub = onAuthStateChanged(auth, (user) => {
          if (user) {
            unsub();
            resolve();
          }
        });
      });
    }

    // 📸 nombre seguro
    const nombreSeguro = file.name.replace(/\s+/g, "_");

    const storageRef = ref(
      storage,
      `tickets/${grupoActivo}/${Date.now()}_${nombreSeguro}`
    );

    // 🚀 subida SIN problemas de CORS
    const uploadTask = uploadBytesResumable(storageRef, file);

    const url = await new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        null,
        (error) => reject(error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });

    console.log("📸 Ticket subido:", url);

    return url;

  } catch (err) {
    console.error("❌ Error subiendo ticket:", err);
    return null;
  }
}