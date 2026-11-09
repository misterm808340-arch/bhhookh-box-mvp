"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { callableErrorMessage, getFirebase, isFirebaseConfigured } from "@/lib/firebase";
import { callTrustedApi } from "@/lib/api";
import {
  istDayKey,
  normalizeStatus,
  type Order,
  type OrderStatus,
} from "@/lib/orders";

export interface OrderStats {
  total: number;
  orderPlaced: number;
  accepted: number;
  preparing: number;
  outForDelivery: number;
  delivered: number;
  rejected: number;
  cancelled: number;
  /** Sum of order totals excluding Rejected/Cancelled (§11: they are not sales). */
  totalValue: number;
  /** Orders placed today (IST calendar day). */
  todayOrders: number;
  /** Sales of non-cancelled orders placed today (IST) (§11). */
  todaySales: number;
}

const asTimestamp = (value: unknown) =>
  typeof value === "object" && value !== null && "toDate" in value
    ? (value as import("firebase/firestore").Timestamp)
    : null;

/** Defensive mapping Firestore → Order (tolerates legacy v1.0/v1.1 documents). */
function mapOrder(snapshot: QueryDocumentSnapshot<DocumentData>): Order {
  const data = snapshot.data();
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const rawAddress = (data.address ?? null) as Record<string, unknown> | null;

  const items = Array.isArray(data.items)
    ? data.items
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => {
          const quantity = Math.max(1, Math.round(Number(item.quantity ?? 1)));
          const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
          const mrp = typeof item.mrp === "number" ? item.mrp : null;
          return {
            productId: typeof item.productId === "string" ? item.productId : undefined,
            name: String(item.name ?? "Item"),
            unitPrice,
            mrp,
            discountPercent: Number(item.discountPercent ?? 0) || 0,
            quantity,
            lineTotal: Number(item.lineTotal ?? unitPrice * quantity),
          };
        })
    : [];

  // Address: new object shape with the legacy customer.address string fallback.
  const legacyAddress = String(customer.address ?? "");
  const address = {
    label: rawAddress ? String(rawAddress.label ?? "") : "",
    receiverName: rawAddress
      ? String(rawAddress.receiverName ?? "")
      : String(customer.name ?? ""),
    phone: rawAddress ? String(rawAddress.phone ?? "") : String(customer.phone ?? ""),
    line: rawAddress ? String(rawAddress.line ?? "") : legacyAddress,
  };

  return {
    id: snapshot.id,
    orderId: typeof data.orderId === "string" ? data.orderId : snapshot.id,
    uid: typeof data.uid === "string" ? data.uid : null,
    customer: {
      name: String(customer.name ?? "Unknown"),
      email: String(customer.email ?? ""),
      phone: address.phone || String(customer.phone ?? ""),
    },
    address,
    items,
    subtotal: Number(data.subtotal ?? 0),
    deliveryFee: Number(data.deliveryFee ?? 0),
    total: Number(data.total ?? 0),
    paymentMethod: typeof data.paymentMethod === "string" ? data.paymentMethod : "COD",
    status: normalizeStatus(data.status),
    driverId: typeof data.driverId === "string" ? data.driverId : null,
    driverName: typeof data.driverName === "string" ? data.driverName : null,
    statusHistory: Array.isArray(data.statusHistory)
      ? data.statusHistory
          .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
          .map((entry) => ({ status: String(entry.status ?? ""), at: asTimestamp(entry.at) }))
      : [],
    cancelReason: typeof data.cancelReason === "string" ? data.cancelReason : "",
    createdAt: asTimestamp(data.createdAt),
    updatedAt: asTimestamp(data.updatedAt),
  };
}

/**
 * Real-time orders feed via Firestore onSnapshot (§10) with trusted-backend
 * mutations (§12): status changes and driver assignment go through the
 * `updateOrderStatus` / `assignDriver` Cloud Functions, which re-verify the
 * admin role and the state machine server-side.
 *
 * Fires onNewOrder for orders added AFTER the initial load, so a page refresh
 * never replays old chimes.
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
              if (order.status === "Order Placed") fresh.push(order);
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
    const nowKey = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Kolkata",
    }).format(new Date());

    const value: OrderStats = {
      total: orders.length,
      orderPlaced: 0,
      accepted: 0,
      preparing: 0,
      outForDelivery: 0,
      delivered: 0,
      rejected: 0,
      cancelled: 0,
      totalValue: 0,
      todayOrders: 0,
      todaySales: 0,
    };
    for (const order of orders) {
      switch (order.status) {
        case "Order Placed":
          value.orderPlaced += 1;
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
        case "Cancelled":
          value.cancelled += 1;
          break;
      }
      if (order.status !== "Rejected" && order.status !== "Cancelled") {
        value.totalValue += order.total;
      }
      const createdKey = istDayKey(order.createdAt);
      if (createdKey === nowKey) {
        value.todayOrders += 1;
        if (order.status !== "Rejected" && order.status !== "Cancelled") {
          value.todaySales += order.total;
        }
      }
    }
    return value;
  }, [orders]);

  /**
   * Persist a status change through the trusted backend — Firestore rules
   * DENY direct client writes to orders, the API is the only path, and it
   * re-verifies the admin role + transition server-side.
   */
  const updateOrderStatus = useCallback(async (order: Order, next: OrderStatus) => {
    await callTrustedApi("/api/orders/status", { orderId: order.orderId, status: next });
  }, []);

  /** Assign (or clear, with driverId = "") the delivery partner on an order. */
  const assignDriver = useCallback(async (orderId: string, driverId: string) => {
    await callTrustedApi("/api/orders/assign-driver", { orderId, driverId });
  }, []);

  return { orders, loading, error, stats, updateOrderStatus, assignDriver };
}
