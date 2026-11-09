import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";

/**
 * Firebase web configuration for the BHHOOKH BOX Admin Dashboard.
 *
 * Values are injected from environment variables (.env.local — see
 * .env.local.example). Both the admin dashboard and the customer app
 * MUST point at the SAME Firebase project so they share one Firestore.
 *
 * NOTE: Firebase web config values are public identifiers by design —
 * access control is enforced by Firebase Authentication + Firestore
 * Security Rules, never by hiding these values.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.authDomain &&
      firebaseConfig.appId
  );
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let functionsInstance: Functions | null = null;

/** Lazily initialise the shared Firebase app (no side effects at import time). */
export function getFirebase(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
} {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Copy .env.local.example to .env.local and fill in your Firebase web app credentials."
    );
  }
  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    functionsInstance = getFunctions(app); // default region us-central1
  }
  return { app, auth: authInstance!, db: dbInstance!, functions: functionsInstance! };
}

/** Human-readable message for a callable-function failure. */
export function callableErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? "";
  const raw = (error as { message?: string }).message ?? "";
  if (code.startsWith("functions/")) {
    const detail = raw.replace(/^.*?:\s*/, "").trim();
    if (detail.length > 0 && detail.length <= 240) return detail;
  }
  if (code === "functions/unauthenticated") return "Your session expired — sign in again.";
  if (code === "functions/permission-denied") return "Your admin account is not authorised for this action.";
  if (code === "functions/unavailable" || code.includes("network")) return "Network error — check your connection and try again.";
  return "The server rejected this action. Please try again.";
}
