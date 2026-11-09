import * as admin from "firebase-admin";
import "firebase-admin/firestore";
import "firebase-admin/auth";
import type { App } from "firebase-admin/app";

/**
 * Firebase Admin SDK singleton for the trusted backend (§12/§13).
 *
 * Runs ONLY on the server (Next.js API routes on Vercel). Credentials come
 * from the FIREBASE_SERVICE_ACCOUNT environment variable — the full service
 * account JSON as a single-line string, set in the Vercel project settings.
 * It is NEVER committed to the repository and NEVER shipped to any client.
 *
 * On Firebase Hosting/Cloud Functions (Blaze path) the same code falls back
 * to Application Default Credentials when the env var is absent.
 */

let app: App | null = null;

export function getAdminApp(): App {
  if (app) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim().startsWith("{")) {
    try {
      const credentials = JSON.parse(raw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      const privateKey = (credentials.private_key ?? "").replace(/\\n/g, "\n");
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
          privateKey,
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
      });
      return app;
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is set but could not be parsed as service-account JSON."
      );
    }
  }

  // Fallback: Application Default Credentials (Cloud Functions / firebase CLI).
  app = admin.initializeApp();
  return app;
}

export function getAdminDb(): admin.firestore.Firestore {
  return admin.firestore(getAdminApp());
}

export function getAdminAuth(): admin.auth.Auth {
  return admin.auth(getAdminApp());
}
