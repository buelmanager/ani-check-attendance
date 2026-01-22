// Run this script to add the initial admin to Firestore
// Usage: node scripts/setup-admin.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyByscDrn1u1V5Lbol-t7YwFgPEoBFWCxgE",
  authDomain: "art-academy-80ae5.firebaseapp.com",
  projectId: "art-academy-80ae5",
  storageBucket: "art-academy-80ae5.firebasestorage.app",
  messagingSenderId: "496950594898",
  appId: "1:496950594898:web:069336867debd98a43fe8b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function setupAdmin() {
  try {
    // Sign in with admin credentials
    const email = 'admin@aniwith.com';
    const password = '111111';

    console.log('Signing in as admin...');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log('Signed in successfully. UID:', user.uid);

    // Add admin document to Firestore
    console.log('Adding admin document to Firestore...');
    await setDoc(doc(db, 'admins', user.uid), {
      email: user.email,
      name: 'CheckMate Admin',
      role: 'superadmin',
      createdAt: serverTimestamp()
    });

    console.log('Admin setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

setupAdmin();
