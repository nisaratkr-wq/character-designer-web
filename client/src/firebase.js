import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDxexEzBaDZyNU-n5SDRF1U92qRDSRCE0A",
  authDomain: "login2026-4dc11.firebaseapp.com",
  projectId: "login2026-4dc11",
  storageBucket: "login2026-4dc11.firebasestorage.app",
  messagingSenderId: "1092273426569",
  appId: "1:1092273426569:web:94a773d56e035bccc9b658",
  measurementId: "G-5CB8L5ZVQW",
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

export const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;