import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyByscDrn1u1V5Lbol-t7YwFgPEoBFWCxgE",
  authDomain: "art-academy-80ae5.firebaseapp.com",
  projectId: "art-academy-80ae5",
  storageBucket: "art-academy-80ae5.firebasestorage.app",
  messagingSenderId: "496950594898",
  appId: "1:496950594898:web:069336867debd98a43fe8b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence for PWA support
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not available in this browser');
  }
});

export default app;
