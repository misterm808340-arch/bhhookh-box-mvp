import { Timestamp } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getAdminDb } from "./firebase-admin";

/**
 * BHHOOKH BOX trusted backend core — Spark-plan edition (§7/§12/§13).
 *
 * This is the same logic that used to live in `firebase/functions` (Cloud
 * Functions, Blaze-only), ported to Next.js API routes so the project can run
 * on the FREE Firebase Spark plan with a FREE Vercel backend.
 *
 * SECURITY MODEL (unchanged):
 *  - The API routes are the ONLY way a client can create or transition an
 *    order. Firestore rules deny all direct client writes to `orders`.
 *  - Every price / discount / availability / stock decision is made HERE on
 *    the trusted server from the fresh `products` documents.
 *  - Orders embed an immutable per-item price snapshot.
 *  - Admin = custom claim `admin: true` OR a document in `admins/{email}`.
 *    Driver = custom claim `driver: true` AND an active `drivers/{uid}` doc.
 *  - The service account key exists ONLY as a server-side env variable.
 */

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

/** Allowed status transitions per actor role (§8: the 7-status model). */
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

/* ─────────────────────────────── errors ─────────────────────────────────── */

export class ApiError extends Error {
  constructor(
    public code:
      | "invalid-argument"
      | "unauthenticated"
      | "permission-denied"
      | "not-found"
      | "failed-precondition"
      | "internal",
    message: string
  ) {
    super(message);
  }
}

export function httpStatusFor(code: ApiError["code"]): number {
  switch (code) {
    case "invalid-argument":
      return 400;
    case "unauthenticated":
      return 401;
    case "permission-denied":
      return 403;
    case "not-found":
      return 404;
    case "failed-precondition":
      return 409;
    default:
      return 500;
  }
}

/* ─────────────────────────── caller authentication ──────────────────────── */

async function verifyBearer(request: Request): Promise<DecodedIdToken> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    throw new ApiError("unauthenticated", "You must be signed in to do that.");
  }
  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch {
    throw new ApiError("unauthenticated", "Your session expired — sign in again.");
  }
}

/** True when the caller is a whitelisted admin (claim OR admins/{email} doc). */
async function isAdminToken(token: DecodedIdToken): Promise<boolean> {
  if (token.admin === true) return true;
  const email = typeof token.email === "string" ? token.email.toLowerCase() : "";
  if (!email) return false;
  const doc = await getAdminDb().collection("admins").doc(email).get();
  return doc.exists;
}

export async function requireUser(request: Request): Promise<DecodedIdToken> {
  return verifyBearer(request);
}

export async function requireAdmin(request: Request): Promise<DecodedIdToken> {
  const token = await verifyBearer(request);
  if (!(await isAdminToken(token))) {
    throw new ApiError("permission-denied", "Admin authorisation required.");
  }
  return token;
}

/** Returns the caller's ACTIVE driver profile, or null. */
export async function getActiveDriver(
  token: DecodedIdToken
): Promise<{ uid: string; name: string } | null> {
  const doc = await getAdminDb().collection("drivers").doc(token.uid).get();
  if (doc.exists && doc.data()?.active === true) {
    return { uid: token.uid, name: String(doc.data()?.name ?? "Driver") };
  }
  return null;
}

/* ───────────────────────────── order id ─────────────────────────────────── */

/** Human-friendly unique order id, e.g. "BHB-M3XK9A2-7QD". */
export function generateOrderId(): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart =
    Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[^A-Z0-9]/g, "X") || "ZZ9";
  return `BHB-${timePart}-${randomPart}`;
}

/* ───────────────────────── offer-window pricing (§5/§7) ─────────────────── */

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
  unitPrice: number;
  mrp: number | null;
  discountPercent: number;
}

/**
 * Server-authoritative pricing:
 *   mrp          — original price (>= sale price to count), struck-through
 *   price        — selling price (what the customer pays today)
 *   offerEnabled — schedule a discount window; when ON, the item sells at
 *                  `price` inside the window and reverts to `mrp` outside it.
 *                  When OFF the item always sells at `price`.
 */
export function computePricing(
  product: FirebaseFirestore.DocumentData,
  now: Date
): PricingResult {
  const sale = Math.round(Number(product.price));
  if (!Number.isFinite(sale) || sale < 1) {
    throw new ApiError("failed-precondition", "This product has an invalid price configuration.");
  }
  const rawMrp = Number(product.mrp);
  const mrp = Number.isFinite(rawMrp) && rawMrp >= sale && rawMrp > 0 ? Math.round(rawMrp) : null;
  const base = mrp ?? sale;

  const start = tsToDate(product.offerStart);
  const end = tsToDate(product.offerEnd);
  const offerEnabled = product.offerEnabled === true;
  const inWindow = offerEnabled && (start === null || now >= start) && (end === null || now <= end);

  const unitPrice = offerEnabled && !inWindow ? base : sale;
  const discountPercent =
    mrp !== null && mrp > sale && unitPrice === sale
      ? Math.round(((mrp - sale) / mrp) * 100)
      : 0;
  return { unitPrice, mrp, discountPercent };
}

/** Delivery fee from `settings/app` (falls back to the brand default). */
export async function getDeliveryFee(): Promise<number> {
  try {
    const doc = await getAdminDb().collection("settings").doc("app").get();
    const value = Number(doc.data()?.deliveryFee);
    if (Number.isFinite(value) && value >= 0 && value <= 500) return Math.round(value);
  } catch {
    // fall through to default
  }
  return DEFAULT_DELIVERY_FEE;
}

/* ───────────────────────────── restock helper ───────────────────────────── */

/** Returns items to their inventory when an order is rejected/cancelled. */
export async function restockOrderItems(order: FirebaseFirestore.DocumentData): Promise<void> {
  const items = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const productId = typeof item?.productId === "string" ? item.productId : "";
    const quantity = Math.max(0, Math.round(Number(item?.quantity)));
    if (!productId || quantity <= 0) continue;
    const productRef = getAdminDb().collection("products").doc(productId);
    const snapshot = await productRef.get();
    if (!snapshot.exists) continue;
    const stock = snapshot.data()?.stock;
    // Only restock products that track stock (null = unlimited).
    if (typeof stock === "number" && Number.isFinite(stock)) {
      await productRef.update({ stock: Math.round(stock) + quantity });
    }
  }
}

export { Timestamp };
