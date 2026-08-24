import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Cấu hình Firebase chính xác của dự án ban-le-app
const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyCCXhV0MaHspSc8hXoLu9t3euZ3VcK7VTU",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "ban-le-app.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "ban-le-app",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "ban-le-app.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    "287663475777",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:287663475777:web:83cc5a04c22195dbe1cac0",
};

// Khởi tạo Firebase App (Singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Luôn trả về true vì đã có config thật
export function isFirebaseConfigured(): boolean {
  return true;
}

export { app, db };
