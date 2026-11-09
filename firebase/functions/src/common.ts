import * as admin from "firebase-admin";

/**
 * BHHOOKH BOX trusted backend — shared helpers.
 *
 * SECURITY MODEL (§12):
 *  - `createOrder` is the ONLY way a customer can write an order document.
 *    Firestore rules DENY all direct client writes to `orders`.
 *  - Every product price / discount / availability / stock decision is made
 *    HERE, on the trusted server, from the fresh `products` documents.
 *  - Orders embed an immutable per-item price snapshot — later product edits
 *    never change historical receipts.
 *  - Admin permission = custom claim `admin: true` OR a document in
 *    `admins/{email}`. Driver permission = custom claim `driver: true` OR an
 *    active document in `drivers/{uid}`.
 */

admin.initializeApp();

export const db = admin.firestore();
export const auth = admin.auth();

/** Default flat delivery fee (₹) when `settings/app.deliveryFee` is absent. */
export const DEFAULT_DELIVERY_FEE = 20;

export const ORDER_STATUSES = [
  "Order Placed",
  "Accepted",
  "Rejected",
  "Preparing",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Legacy v1.1.0 status, normalised everywhere on read. */
export type LegacyStatus = "Pending";

/** Allowed status transitions per actor role. */
export const ADMIN_TRANSITIONS: Record<string, OrderStatus[]> = {
  "Order Placed": ["Accepted", "Rejected"],
  Pending: ["Accepted", "Rejected"],
  Accepted: ["Preparing", "Cancelled"],
  Preparing: ["Out for Delivery", "Cancelled"],
  "Out for Delivery": ["Delivered"],
  Delivered: [],
  Rejected: [],
  Cancelled: [],
};

export const DRIVER_TRANSITIONS: Record<string, OrderStatus[]> = {
  Preparing: ["Out for Delivery"],
  "Out for Delivery": ["Delivered"],
};

export function normalizeStatus(raw: unknown): OrderStatus {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "Pending") return "Order Placed";
  if ((ORDER_STATUSES as readonly string[]).includes(value)) return value as OrderStatus;
  return "Order Placed";
}

export class HttpsError extends Error {
  constructor(
    public code:
      | "invalid-argument"
      | "unauthenticated"
      | "permission-denied"
      | "not-found"
      | "failed-precondition"
      | "internal",
    public message: string
  ) {
    super(message);
  }
}

export interface CallableContext {
  auth?: { uid: string; token: admin.auth.DecodedIdToken } | null;
}

/** Throws when the caller has no Firebase Auth session. */
export function requireAuth(context: CallableContext): { uid: string; token: admin.auth.DecodedIdToken } {
  if (!context.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to do that.");
  }
  return context.auth;
}

/** True when the caller is a whitelisted admin (claim OR admins/{email} doc). */
export async function isAdminCaller(
  context: CallableContext
): Promise<boolean> {
  const session = requireAuth(context);
  if (session.token.admin === true) return true;
  const email = session.token.email;
  if (typeof email === "string" && email) {
    const doc = await db.collection("admins").doc(email.toLowerCase()).get();
    if (doc.exists) return true;
  }
  return false;
}

export async function requireAdmin(context: CallableContext): Promise<void> {
  if (!(await isAdminCaller(context))) {
    throw new HttpsError("permission-denied", "Admin authorisation required.");
  }
}

/** True when the caller is an ACTIVE driver (claim OR drivers/{uid} doc). */
export async function isDriverCaller(
  context: CallableContext,
  driverDocId?: string
): Promise<{ uid: string; name: string } | null> {
  const session = requireAuth(context);
  if (driverDocId && session.uid !== driverDocId) return null;
  if (session.token.driver === true) {
    const doc = await db.collection("drivers").doc(session.uid).get();
    if (doc.exists && doc.data()?.active === true) {
      return { uid: session.uid, name: String(doc.data()?.name ?? "Driver") };
    }
    return null;
  }
  const doc = await db.collection("drivers").doc(session.uid).get();
  if (doc.exists && doc.data()?.active === true) {
    return { uid: session.uid, name: String(doc.data()?.name ?? "Driver") };
  }
  return null;
}

/* ────────────────────────── Order id generation ────────────────────────── */

/** Human-friendly unique order id, e.g. "BHB-M3XK9A2-7QD". */
export function generateOrderId(): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart =
    Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[^A-Z0-9]/g, "X") || "ZZ9";
  return `BHB-${timePart}-${randomPart}`;
}

/* ─────────────────────────── Offer-window pricing ─────────────────────────── */

function tsToDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export interface PricingResult {
  /** Effective selling price per unit right now (₹, integer). */
  unitPrice: number;
  /** Original price snapshot (₹, integer) — null when no MRP. */
  mrp: number | null;
  /** Discount % relative to MRP while the offer window is active. */
  discountPercent: number;
}

/**
 * Server-authoritative pricing (§5/§7):
 *   mrp          — original price (>= sale price to count), shown struck-through
 *   price        — selling price (what the customer pays today)
 *   offerEnabled — schedule a discount window; when ON, the item sells at
 *                  `price` inside the window and reverts to `mrp` outside it.
 *                  When OFF (or absent, e.g. legacy products) the item always
 *                  sells at `price` — v1.1.0 behaviour is preserved.
 */
export function computePricing(product: FirebaseFirestore.DocumentData, now: Date): PricingResult {
  const sale = Math.round(Number(product.price));
  if (!Number.isFinite(sale) || sale < 1) {
    throw new HttpsError("failed-precondition", "This product has an invalid price configuration.");
  }
  const rawMrp = Number(product.mrp);
  const mrp = Number.isFinite(rawMrp) && rawMrp >= sale && rawMrp > 0 ? Math.round(rawMrp) : null;
  const base = mrp ?? sale;

  const start = tsToDate(product.offerStart);
  const end = tsToDate(product.offerEnd);
  const offerEnabled = product.offerEnabled === true;
  const inWindow = offerEnabled && (start === null || now >= start) && (end === null || now <= end);

  const unitPrice = offerEnabled && !inWindow ? base : sale;
  const discountPercent = mrp !== null && mrp > sale && unitPrice === sale
    ? Math.round(((mrp - sale) / mrp) * 100)
    : 0;
  return { unitPrice, mrp, discountPercent };
}

/** Delivery fee from `settings/app` (falls back to the brand default). */
export async function getDeliveryFee(): Promise<number> {
  try {
    const doc = await db.collection("settings").doc("app").get();
    const value = Number(doc.data()?.deliveryFee);
    if (Number.isFinite(value) && value >= 0 && value <= 500) return Math.round(value);
  } catch {
    // fall through to default
  }
  return DEFAULT_DELIVERY_FEE;
}

/* ───────────────────────────── Restock helper ───────────────────────────── */

/** Returns items to their inventory when an order is rejected/cancelled. */
export async function restockOrderItems(
  order: FirebaseFirestore.DocumentData
): Promise<void> {
  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const productId = typeof item?.productId === "string" ? item.productId : "";
    const quantity = Math.max(0, Math.round(Number(item?.quantity)));
    if (!productId || quantity <= 0) continue;
    const productRef = db.collection("products").doc(productId);
    const snapshot = await productRef.get();
    if (!snapshot.exists) continue;
    const stock = snapshot.data()?.stock;
    // Only restock products that track stock (null = unlimited).
    if (typeof stock === "number" && Number.isFinite(stock)) {
      await productRef.update({ stock: Math.round(stock) + quantity });
    }
  }
}
