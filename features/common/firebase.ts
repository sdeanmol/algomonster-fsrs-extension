import { initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// TODO: Replace with your actual Firebase config object from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForDevelopment1234567890",
  authDomain: "algorecall-fsrs-dev.firebaseapp.com",
  projectId: "algorecall-fsrs-dev",
  storageBucket: "algorecall-fsrs-dev.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { auth, db };
