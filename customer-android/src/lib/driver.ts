import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDb } from './firebase';
import { mapOrderDoc } from './orders';
import type { CustomerOrder } from '../types';

/**
 * Driver module (§9) — the trusted link between the restaurant and the map.
 *
 * - Driver identity is verified SERVER-SIDE: an account becomes a driver only
 *   when the `createDriver` Cloud Function (admin-only) creates `drivers/{uid}`
 *   and sets the `driver: true` custom claim. Nothing client-side can grant it.
 * - Drivers read ONLY orders assigned to them (Firestore rules + constrained
 *   query below) and update status ONLY through the `updateOrderStatus`
 *   callable, which re-checks the assignment and the allowed transitions.
 * - GPS is REAL device location from expo-location — published to
 *   `orders/{id}.driverLocation` while the order is being delivered. No fake
 *   or simulated coordinates exist anywhere in this codebase.
 */

export interface DriverProfile {
  uid: string;
  name: string;
  phone: string;
  active: boolean;
}

/** Reads the signed-in user's driver document (null = not a driver). */
export async function getDriverProfile(uid: string): Promise<DriverProfile | null> {
  const snapshot = await getDoc(doc(getDb(), 'drivers', uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    uid,
    name: String(data.name ?? 'Driver'),
    phone: String(data.phone ?? ''),
    active: data.active === true,
  };
}

/** Statuses a driver still acts on (newest hand-offs first). */
export const DRIVER_ACTIVE_STATUSES = ['Preparing', 'Out for Delivery'];

/** Real-time feed of orders assigned to this driver (§9). */
export function subscribeAssignedOrders(
  uid: string,
  onData: (orders: CustomerOrder[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const assignedQuery = query(
    collection(getDb(), 'orders'),
    where('driverId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(25)
  );
  return onSnapshot(
    assignedQuery,
    (snapshot) =>
      onData(snapshot.docs.map((docSnapshot) => mapOrderDoc(docSnapshot.id, docSnapshot.data()))),
    onError
  );
}

/**
 * Driver status update — goes through the `updateOrderStatus` Cloud Function
 * which verifies the assignment and the driver state machine:
 *   Preparing → Out for Delivery → Delivered. Nothing else.
 */
export async function setDriverOrderStatus(orderId: string, status: string): Promise<void> {
  const functions = getFunctions(getApp());
  const updateStatus = httpsCallable<{ orderId: string; status: string }, { ok: boolean }>(
    functions,
    'updateOrderStatus'
  );
  await updateStatus({ orderId, status });
}

/**
 * Publishes the driver's REAL GPS position for one order.
 *
 * Firestore rules allow ONLY this exact field (`driverLocation`) to change,
 * and only on the driver's own assigned order while it is Preparing /
 * Out for Delivery — so location stops flowing automatically once the order
 * is Delivered or Cancelled (§9: stop tracking after delivery).
 */
export async function publishDriverLocation(
  orderId: string,
  lat: number,
  lng: number
): Promise<void> {
  await updateDoc(doc(getDb(), 'orders', orderId), {
    driverLocation: { lat, lng, updatedAt: serverTimestamp() },
  });
}
