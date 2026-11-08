"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebase, isFirebaseConfigured } from "@/lib/firebase";
import { isOrderStatus, type Order, type OrderStatus } from "@/lib/orders";

export interface OrderStats {
  total: number;
  pending: number;
  accepted: number;
  preparing: number;
  outForDelivery: number;
  delivered: number;
  rejected: number;
  /** Sum of order totals excluding rejected orders. */
  totalValue: number;
}

/** Defensive mapping Firestore → Order (tolerates partially written docs). */
function mapOrder(snapshot: QueryDocumentSnapshot<DocumentData>): Order {
  const data = snapshot.data();
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const items = Array.isArray(data.items)
    ? data.items
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          name: String(item.name ?? "Item"),
          price: Number(item.price ?? 0),
          quantity: Number(item.quantity ?? 0),
        }))
    : [];
  const asTimestamp = (value: unknown) =>
    typeof value === "object" && value !== null && "toDate" in value
      ? (value as import("firebase/firestore").Timestamp)
      : null;

  return {
    id: snapshot.id,
    orderId: typeof data.orderId === "string" ? data.orderId : snapshot.id,
    customer: {
      name: String(customer.name ?? "Unknown"),
      phone: String(customer.phone ?? "—"),
      address: String(customer.address ?? "—"),
    },
    items,
    subtotal: Number(data.subtotal ?? 0),
    deliveryFee: Number(data.deliveryFee ?? 0),
    total: Number(data.total ?? 0),
    paymentMethod: typeof data.paymentMethod === "string" ? data.paymentMethod : "COD",
    status: isOrderStatus(data.status) ? data.status : "Pending",
    createdAt: asTimestamp(data.createdAt),
    updatedAt: asTimestamp(data.updatedAt),
  };
}

/**
 * Real-time orders feed via Firestore onSnapshot.
 *
 * - Streams the `orders` collection, newest first.
 * - Fires onNewOrder for orders added AFTER the initial load, so a page
 *   refresh never replays old chimes; a 15-minute freshness window guards
 *   against clock/backfill edge cases.
 */
export function useAdminOrders(
  enabled: boolean,
  onNewOrder?: (latest: Order, count: number) => void
) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const callbackRef = useRef(onNewOrder);
  const initialSnapshotDone = useRef(false);

  useEffect(() => {
    callbackRef.current = onNewOrder;
  });

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured()) return;
    const { db } = getFirebase();
    initialSnapshotDone.current = false;

    const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const list = snapshot.docs.map(mapOrder);
        const fresh: Order[] = [];

        if (initialSnapshotDone.current) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const order = mapOrder(change.doc);
              if (order.status === "Pending") fresh.push(order);
            }
          });
        } else {
          initialSnapshotDone.current = true;
        }

        setOrders(list);
        setLoading(false);
        setError(null);

        if (fresh.length > 0 && callbackRef.current) {
          const recent = fresh.filter(
            (o) => o.createdAt !== null && Date.now() - o.createdAt.toDate().getTime() < 15 * 60 * 1000
          );
          const picked = recent.length > 0 ? recent : fresh;
          callbackRef.current(picked[0]!, picked.length);
        }
      },
      (err) => {
        setLoading(false);
        if (err.code === "permission-denied") {
          setError(
            "Permission denied. Your account is signed in but is not whitelisted in the admins collection in Firestore."
          );
        } else {
          setError(err.message);
        }
      }
    );
    return unsubscribe;
  }, [enabled]);

  const stats = useMemo<OrderStats>(() => {
    const value: OrderStats = {
      total: orders.length,
      pending: 0,
      accepted: 0,
      preparing: 0,
      outForDelivery: 0,
      delivered: 0,
      rejected: 0,
      totalValue: 0,
    };
    for (const order of orders) {
      switch (order.status) {
        case "Pending":
          value.pending += 1;
          break;
        case "Accepted":
          value.accepted += 1;
          break;
        case "Preparing":
          value.preparing += 1;
          break;
        case "Out for Delivery":
          value.outForDelivery += 1;
          break;
        case "Delivered":
          value.delivered += 1;
          break;
        case "Rejected":
          value.rejected += 1;
          break;
      }
      if (order.status !== "Rejected") value.totalValue += order.total;
    }
    return value;
  }, [orders]);

  /** Persist a status change to Firestore (validated again by security rules). */
  const updateOrderStatus = useCallback(async (order: Order, next: OrderStatus) => {
    const { db } = getFirebase();
    await updateDoc(doc(db, "orders", order.id), {
      status: next,
      updatedAt: serverTimestamp(),
    });
  }, []);

  return { orders, loading, error, stats, updateOrderStatus };
}
