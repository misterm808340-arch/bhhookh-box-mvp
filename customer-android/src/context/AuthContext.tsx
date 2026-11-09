import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  fetchUserProfile,
  getFirebaseAuth,
  onAuthStateChanged,
  type UserProfile,
} from '../lib/auth';
import { getDriverProfile, type DriverProfile } from '../lib/driver';

/**
 * Authentication state for the whole customer/driver app (§2/§9).
 *
 * - `user` comes from Firebase Auth (persisted across app restarts).
 * - `profile` is the Firestore `users/{uid}` document (name, phone, …).
 * - `driverProfile` is set when the signed-in account was created by the
 *   admin as a DRIVER (`drivers/{uid}`) — those accounts land in the driver
 *   console instead of the customer storefront, and skip the email-verified
 *   gate (admin-created passwords, not self-registered).
 * - `loading` is true until the first auth state resolution — screens show a
 *   branded loader instead of flashing the login form.
 */

export type AuthPhase =
  | 'loading' // resolving persisted session
  | 'signedOut' // no session → Login screen
  | 'unverified' // customer session, email not verified → Verify Email screen
  | 'signedIn'; // verified session → full app

export type AppRole = 'customer' | 'driver';

interface AuthContextValue {
  phase: AuthPhase;
  role: AppRole;
  user: User | null;
  profile: UserProfile | null;
  driverProfile: DriverProfile | null;
  /** Reloads the profile document after edits (e.g. new saved phone). */
  refreshProfile: () => Promise<void>;
  /** Reloads the Auth user (after the customer taps a verification link). */
  reloadVerification: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [resolved, setResolved] = useState(false);
  /** Bumped when the user reloads after clicking the verification email. */
  const [verifiedTick, setVerifiedTick] = useState(0);

  useEffect(() => {
    let active = true;
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setProfile(null);
      setDriverProfile(null);
      setResolved(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Resolve the account KIND whenever the session changes: a document in
  // drivers/{uid} (readable only by its owner — rules enforce this) makes the
  // session a driver console session; everything else is a customer.
  useEffect(() => {
    if (!user) return;
    let active = true;
    getDriverProfile(user.uid)
      .then((driver) => {
        if (active) setDriverProfile(driver);
      })
      .catch(() => {
        // Cannot read drivers/{uid} → definitively NOT a driver (rules).
        if (active) setDriverProfile(null);
      });
    return () => {
      active = false;
    };
  }, [user]);

  // Load (and keep fresh) the profile document for customer sessions.
  useEffect(() => {
    if (!user || driverProfile !== null) return;
    let active = true;
    fetchUserProfile(user)
      .then((p) => {
        if (active) setProfile(p);
      })
      .catch(() => {
        // Profile load failure must not lock the customer out — the app can
        // fall back to the Auth display name.
        if (active) setProfile(null);
      });
    return () => {
      active = false;
    };
  }, [user, driverProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const role: AppRole = driverProfile !== null ? 'driver' : 'customer';
    let phase: AuthPhase;
    if (!resolved) phase = 'loading';
    else if (!user) phase = 'signedOut';
    else if (role === 'driver') phase = 'signedIn';
    else if (user.emailVerified === false) phase = 'unverified';
    else phase = 'signedIn';
    return {
      phase,
      role,
      user,
      profile,
      driverProfile,
      refreshProfile: async () => {
        if (user) setProfile(await fetchUserProfile(user));
      },
      reloadVerification: async () => {
        if (!user) return false;
        await user.reload();
        setVerifiedTick((tick) => tick + 1);
        return user.emailVerified;
      },
    };
  }, [user, profile, driverProfile, resolved, verifiedTick]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
