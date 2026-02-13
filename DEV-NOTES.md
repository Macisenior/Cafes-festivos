# 📘 DEV NOTES - Macisenior

Este archivo recoge lo que voy aprendiendo construyendo mis proyectos.

---

## 🚀 Proyecto: Gastos del Grupo

### 📦 Arquitectura actual
- Firebase Firestore
- Auth anónima
- Multi-grupo con `grupos/{grupoId}`
- Git versionado
- Release v1.1 publicada
- GitHub Pages activo

---

## 🔥 Firebase

### Inicialización básica
```js
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
