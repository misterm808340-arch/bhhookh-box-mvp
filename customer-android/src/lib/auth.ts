import {
  createUserWithEmailAndPassword,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDb, readFirebaseConfig } from './firebase';

/**
 * Firebase Authentication (Email / Password) for the BHHOOKH BOX customer app.
 *
 * Session persistence: Firebase Auth state is stored in AsyncStorage, so a
 * signed-in customer stays signed in across app restarts until they tap
 * Logout (or sign out elsewhere).
 *
 * Email verification: every new account MUST verify its email address before
 * the dashboard unlocks. `resendVerificationEmail` re-sends the link.
 */

/** The memoised Auth instance (initialised with AsyncStorage persistence). */
let authInstance: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  // getDb() guarantees the Firebase app is initialised with the .env config.
  const app: FirebaseApp =
    getApps().length > 0 ? getApps()[0]! : initializeApp(readConfigOrThrow());
  try {
    // First initialisation — wire React Native (AsyncStorage) persistence so
    // the session survives app restarts.
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth throws "auth/already-initialized" on hot reload — reuse.
    authInstance = getAuth(app);
  }
  return authInstance;
}

/** Local helper — mirrors readFirebaseConfig() and fails loudly. */
function readConfigOrThrow() {
  const config = readFirebaseConfig();
  if (!config) throw new Error('Firebase is not configured.');
  return config;
}

export { onAuthStateChanged };

/** Customer profile document stored in Firestore `users/{uid}`. */
export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  /** Always 'customer' in this app — drivers/admins use their own surfaces. */
  role: 'customer';
  createdAt?: number | null;
}

/** Reads (or creates) the Firestore profile for an authenticated user. */
export async function fetchUserProfile(user: User): Promise<UserProfile | null> {
  const db = getDb();
  const snapshot = await getDoc(doc(db, 'users', user.uid));
  if (snapshot.exists()) {
    const data = snapshot.data();
    return {
      uid: user.uid,
      name: typeof data.name === 'string' ? data.name : (user.displayName ?? 'Customer'),
      email: typeof data.email === 'string' ? data.email : (user.email ?? ''),
      phone: typeof data.phone === 'string' ? data.phone : '',
      role: 'customer',
      createdAt:
        data.createdAt && typeof data.createdAt.toMillis === 'function'
          ? data.createdAt.toMillis()
          : null,
    };
  }
  return null;
}

/**
 * Creates the `users/{uid}` profile document.
 * Called right after successful registration; also used lazily for legacy
 * accounts whose document is missing (e.g. profile edited before doc existed).
 */
export async function ensureUserProfile(
  user: User,
  name: string,
  phone = ''
): Promise<void> {
  const db = getDb();
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;
  await setDoc(ref, {
    uid: user.uid,
    name: name.trim(),
    email: (user.email ?? '').toLowerCase(),
    phone: phone.trim(),
    role: 'customer',
    createdAt: serverTimestamp(),
  });
}

export class AuthValidationError extends Error {}

/** Registers a new customer: Auth account + verification email + profile doc. */
export async function registerCustomer(
  name: string,
  email: string,
  password: string
): Promise<User> {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    throw new AuthValidationError('Please enter your full name (2–80 characters).');
  }
  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim(),
    password
  );
  // Best-effort display name + verification email + profile document.
  try {
    await sendEmailVerification(credential.user);
  } catch {
    // The Verify Email screen offers a manual "Resend" button as fallback.
  }
  await ensureUserProfile(credential.user, trimmed);
  return credential.user;
}

/** Signs an existing customer in. */
export async function loginCustomer(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim(),
    password
  );
  return credential.user;
}

/** Sends the password-reset email (Firebase handles the reset page). */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

/** Re-sends the email-verification link for the currently signed-in user. */
export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

/** Reloads the user so `emailVerified` reflects a just-clicked link. */
export async function reloadUser(user: User): Promise<boolean> {
  await user.reload();
  return user.emailVerified;
}

/** Signs the customer out (session ends; AsyncStorage entry cleared). */
export async function logoutCustomer(): Promise<void> {
  await signOut(getFirebaseAuth());
}

/** Maps Firebase Auth error codes to short, human-friendly messages. */
export function friendlyAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak — use at least 6 characters.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error — please check your internet connection.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    default:
      if (error instanceof AuthValidationError) return error.message;
      return 'Something went wrong. Please try again.';
  }
}
