import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// TODO: Replace with your actual Firebase config object from the Firebase Console
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDummyKeyForDevelopment1234567890",
  authDomain: "algorecall-fsrs-dev.firebaseapp.com",
  projectId: "algorecall-fsrs-dev",
  storageBucket: "algorecall-fsrs-dev.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase with exception handling
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const logger = (globalThis as unknown as { Logger?: { error: (m: string, s: string, d?: unknown) => void } }).Logger;
  if (logger) logger.error('Firebase', `Failed to initialize Firebase app: ${errorMessage}`, { err });
  // Comment: Non-fatal Firebase initialization fallback
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
}

export { app, auth, db };
