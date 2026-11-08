"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebase, isFirebaseConfigured } from "@/lib/firebase";

export interface AdminAuthState {
  loading: boolean;
  user: User | null;
  /** True only when the signed-in user's email exists in the `admins` collection. */
  isAdmin: boolean;
}

/**
 * Watches Firebase Auth state and verifies admin membership.
 *
 * Authorization model (mirrors firestore.rules):
 *   1. Sign-in requires a Firebase Auth account (email + password).
 *   2. Dashboard + data access additionally require a document in the
 *      `admins` collection whose id equals the user's email.
 * Admin accounts are created manually in the Firebase Console — no admin
 * credentials are ever stored in the frontend source code.
 */
export function useAdminAuth(): AdminAuthState {
  // Deterministic initial state: when Firebase env vars are missing there is
  // nothing to load, so we start settled instead of pending.
  const [state, setState] = useState<AdminAuthState>({
    loading: isFirebaseConfigured(),
    user: null,
    isAdmin: false,
  });

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let active = true;
    const { auth, db } = getFirebase();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || !user.email) {
        if (active) setState({ loading: false, user: null, isAdmin: false });
        return;
      }
      getDoc(doc(db, "admins", user.email))
        .then((snapshot) => {
          if (active) setState({ loading: false, user, isAdmin: snapshot.exists() });
        })
        .catch(() => {
          if (active) setState({ loading: false, user, isAdmin: false });
        });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}

export async function signOutAdmin(): Promise<void> {
  const { auth } = getFirebase();
  await signOut(auth);
}
