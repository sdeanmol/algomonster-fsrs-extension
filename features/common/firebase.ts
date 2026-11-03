/**
 * @file Firebase Client SDK Initialization and Service Singletons
 * @module features/common/firebase
 * @context Shared across Extension contexts (Background, Dashboard, Popup)
 * @description Initializes Firebase App, Firebase Authentication, and Cloud Firestore clients
 * with non-fatal exception handling and fallback dummy stubs to ensure offline resilience.
 */

import { initializeApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { Logger } from '@common/logger';
import { DEFAULT_FIREBASE_CONFIG } from './constants';

/**
 * Firebase application configuration options loaded from defaults.
 */
const firebaseConfig: FirebaseOptions = DEFAULT_FIREBASE_CONFIG;

/** Initialized Firebase application instance or empty fallback object */
let app: FirebaseApp;
/** Initialized Firebase Authentication service or fallback object */
let auth: Auth;
/** Initialized Cloud Firestore database service or fallback object */
let db: Firestore;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  Logger.error('Firebase', `Failed to initialize Firebase app: ${errorMessage}`, { err });
  // Non-fatal Firebase initialization fallback
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
}

export { app, auth, db };
