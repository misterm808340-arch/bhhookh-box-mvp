"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebase, isFirebaseConfigured } from "@/lib/firebase";
import { callTrustedApi } from "@/lib/api";

/**
 * Driver roster for the admin (§9) — live from Firestore; every mutation goes
 * through the admin-only trusted backend (`/api/drivers/...`), which
 * creates/removes the Auth account and the `drivers/{uid}` document with the
 * `driver: true` custom claim. Clients can never write the roster directly
 * (Firestore rules deny it) and the admin role is re-verified server-side.
 */
export interface DriverRow {
  uid: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  createdAt: import("firebase/firestore").Timestamp | null;
}

function mapDriver(snapshot: QueryDocumentSnapshot<DocumentData>): DriverRow {
  const data = snapshot.data();
  const asTimestamp = (value: unknown) =>
    typeof value === "object" && value !== null && "toDate" in value
      ? (value as import("firebase/firestore").Timestamp)
      : null;
  return {
    uid: snapshot.id,
    name: String(data.name ?? "Driver"),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    active: data.active === true,
    createdAt: asTimestamp(data.createdAt),
  };
}

export function useDrivers(enabled: boolean) {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured()) return;
    const { db } = getFirebase();
    const driversQuery = query(collection(db, "drivers"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      driversQuery,
      (snapshot) => {
        setDrivers(snapshot.docs.map(mapDriver));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setLoading(false);
        setError(
          err.code === "permission-denied"
            ? "Only whitelisted admins can view the driver roster."
            : err.message
        );
      }
    );
    return unsubscribe;
  }, [enabled]);

  /** Creates a driver account (Auth user + drivers/{uid} + claim). */
  const createDriver = useCallback(
    async (input: { name: string; email: string; phone: string; password: string }) => {
      await callTrustedApi("/api/drivers/create", { ...input });
    },
    []
  );

  /** Enables / disables a driver (disabled drivers cannot act on orders). */
  const setDriverActive = useCallback(async (driverId: string, active: boolean) => {
    await callTrustedApi("/api/drivers/set-active", { driverId, active });
  }, []);

  /** Permanently deletes the driver (Auth user + roster document). */
  const deleteDriver = useCallback(async (driverId: string) => {
    await callTrustedApi("/api/drivers/delete", { driverId });
  }, []);

  return { drivers, loading, error, createDriver, setDriverActive, deleteDriver };
}
