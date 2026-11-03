import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { Logger } from '@common/logger';
import { DEFAULT_FIREBASE_CONFIG } from './constants';

// TODO: Replace with your actual Firebase config object from the Firebase Console
const firebaseConfig: FirebaseOptions = DEFAULT_FIREBASE_CONFIG;

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
  Logger.error('Firebase', `Failed to initialize Firebase app: ${errorMessage}`, { err });
  // Comment: Non-fatal Firebase initialization fallback
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
}

export { app, auth, db };
