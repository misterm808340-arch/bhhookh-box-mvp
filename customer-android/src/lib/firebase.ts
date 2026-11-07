import 'react-native-url-polyfill/auto';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase configuration for the BHHOOKH BOX customer app.
 *
 * Values come from environment variables (.env — see .env.example). Both the
 * customer app and the admin dashboard MUST use the SAME Firebase project so
 * customer orders stream straight into the admin console.
 *
 * NOTE: Firebase web config values are public identifiers by design. Access
 * control is enforced by Firestore security rules (customers may CREATE
 * orders; only whitelisted admins may read/update them).
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function readFirebaseConfig(): FirebaseConfig | null {
  const config: FirebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  };
  if (!config.apiKey || !config.projectId || !config.authDomain || !config.appId) {
    return null;
  }
  return config;
}

let firestore: Firestore | null = null;

/** Lazily initialise (and memoise) the shared Firestore instance. */
export function getDb(): Firestore {
  if (firestore) return firestore;
  const config = readFirebaseConfig();
  if (!config) {
    throw new Error(
      'Firebase is not configured. Copy .env.example to .env and fill in your Firebase project credentials, then restart the app.'
    );
  }
  const app: FirebaseApp = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
  // Auto long-polling keeps Firestore working reliably inside Expo Go and on
  // networks that block WebSockets.
  firestore = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  return firestore;
}
