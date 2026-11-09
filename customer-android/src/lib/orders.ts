import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from './firebase';
import { ApiRequestError, callTrustedApi } from './api';
import {
  DELIVERY_FEE,
  MAX_ADDRESS_LENGTH,
  MAX_NAME_LENGTH,
  MIN_ADDRESS_LENGTH,
  MIN_NAME_LENGTH,
  PHONE_PATTERN,
} from '../config';
import { normalizeOrderStatus, type CustomerOrder, type OrderStatus } from '../types';

/**
 * Customer order API (§7/§8).
 *
 * SECURITY (§12): the client NEVER writes an order document directly and
 * NEVER submits a price. `placeOrder` calls the trusted backend
 * (`POST /api/orders/create`) with only product ids + quantities + an address;
 * the server re-reads every product from Firestore, validates
 * prices/discounts/stock, computes the totals and writes an order with an
 * immutable price snapshot.
 *
 * Orders are streamed back in real time with onSnapshot for tracking (§8).
 */

/* ─────────────────────────────── totals (display) ───────────────────────── */

export interface Totals {
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}

export function computeTotals(
  lines: Array<{ item: { effectivePrice: number }; quantity: number }>,
  deliveryFee: number = DELIVERY_FEE
): Totals {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.item.effectivePrice * line.quantity,
    0
  );
  const fee = lines.length > 0 ? deliveryFee : 0;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  return { subtotal, deliveryFee: fee, total: subtotal + fee, itemCount };
}

/* ───────────────────────────── delivery fee (live) ──────────────────────── */

/**
 * Reads the admin-configured flat delivery fee (`settings/app.deliveryFee`).
 * Falls back to the bundled default when the document is missing — the
 * authoritative value is always the one the Cloud Function charges.
 */
export async function fetchDeliveryFee(): Promise<number> {
  try {
    const snapshot = await getDoc(doc(getDb(), 'settings', 'app'));
    const value = Number(snapshot.data()?.deliveryFee);
    if (Number.isFinite(value) && value >= 0 && value <= 500) return Math.round(value);
  } catch {
    // fall through to the default
  }
  return DELIVERY_FEE;
}

/* ─────────────────────────────── place order ────────────────────────────── */

export interface CheckoutErrors {
  name?: string;
  phone?: string;
  address?: string;
}

/** Client-side mirror of the Cloud Function input validation (§7). */
export function validateCheckout(input: CheckoutInput): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();

  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    errors.name = 'Please enter the receiver’s full name (2–80 characters).';
  }
  if (!PHONE_PATTERN.test(phone)) {
    errors.phone = 'Please enter a valid 10-digit mobile number.';
  }
  if (address.length < MIN_ADDRESS_LENGTH || address.length > MAX_ADDRESS_LENGTH) {
    errors.address = 'Please enter the complete delivery address (at least 10 characters).';
  }
  return errors;
}

export interface CheckoutInput {
  /** Receiver name (pre-filled from the profile, editable). */
  name: string;
  /** 10-digit mobile. */
  phone: string;
  /** Complete delivery address line. */
  address: string;
  /** Optional saved-address label (e.g. "Home"). */
  label?: string;
}

export interface PlacedOrder {
  orderId: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
}

interface CallableErrorShape {
  code?: string;
  message?: string;
}

/** Maps trusted-API / network failures to short human-friendly messages. */
export function friendlyOrderError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.failure.message;
  }
  const shape = (typeof error === 'object' && error !== null ? error : {}) as CallableErrorShape;
  const message = shape.message ?? '';
  if (message.includes('network') || message.toLowerCase().includes('fetch')) {
    return 'We could not reach the kitchen. Please check your internet connection and try again.';
  }
  return 'We could not place your order. Please try again in a moment.';
}

/**
 * Secure order creation — prices come from the SERVER, never from the app.
 * The cart only contributes product ids and quantities.
 */
export async function placeOrder(
  input: CheckoutInput,
  lines: Array<{ item: { id: string }; quantity: number }>,
  customerName?: string
): Promise<PlacedOrder> {
  if (lines.length === 0) {
    throw new Error('Your cart is empty.');
  }
  const result = await callTrustedApi<{
    orderId: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
  }>('/api/orders/create', {
    items: lines.map((line) => ({ productId: line.item.id, quantity: line.quantity })),
    address: {
      label: (input.label ?? '').trim().slice(0, 40),
      receiverName: input.name.trim(),
      phone: input.phone.trim(),
      line: input.address.trim(),
    },
    customerName: customerName?.trim() || undefined,
  });
  return {
    orderId: result.orderId,
    subtotal: result.subtotal,
    deliveryFee: result.deliveryFee,
    total: result.total,
  };
}

/* ─────────────────────────────── cancellation ───────────────────────────── */

/** Cancels the customer's own order (allowed while Order Placed / Accepted). */
export async function cancelMyOrder(orderId: string, reason: string): Promise<void> {
  await callTrustedApi('/api/orders/cancel', { orderId, reason });
}

/* ─────────────────────────── real-time subscriptions ────────────────────── */

function asMillis(value: unknown): number | null {
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return null;
    }
  }
  if (typeof value === 'number') return value;
  return null;
}

interface OrderItemSnapshot {
  productId: string;
  name: string;
  unitPrice: number;
  mrp: number | null;
  discountPercent: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string;
}

/** Tolerant Firestore → CustomerOrder mapping (also understands legacy docs). */
export function mapOrderDoc(id: string, data: Record<string, unknown>): CustomerOrder {
  // Items: new snapshot shape (unitPrice/lineTotal) with legacy fallbacks.
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: OrderItemSnapshot[] = rawItems
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const quantity = Math.max(1, Math.round(Number(item.quantity ?? 1)));
      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
      return {
        productId: typeof item.productId === 'string' ? item.productId : '',
        name: String(item.name ?? 'Item'),
        unitPrice,
        mrp: typeof item.mrp === 'number' ? item.mrp : null,
        discountPercent: Number(item.discountPercent ?? 0) || 0,
        quantity,
        lineTotal: Number(item.lineTotal ?? unitPrice * quantity),
        imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : '',
      };
    });

  // Address: new object shape with legacy string fallback.
  const rawAddress = data.address;
  const address =
    typeof rawAddress === 'object' && rawAddress !== null
      ? (rawAddress as Record<string, unknown>)
      : {};
  const legacyAddress = typeof data.customer === 'object' && data.customer !== null
    ? String((data.customer as Record<string, unknown>).address ?? '')
    : '';
  const line =
    typeof address.line === 'string' && address.line ? address.line : legacyAddress;

  // Driver location (§9) — written by the driver's device while delivering.
  const rawLocation = data.driverLocation;
  const driverLocation =
    typeof rawLocation === 'object' && rawLocation !== null
      ? (rawLocation as Record<string, unknown>)
      : null;

  return {
    id,
    orderId: typeof data.orderId === 'string' ? data.orderId : id,
    status: normalizeOrderStatus(String(data.status ?? 'Order Placed')),
    items,
    subtotal: Number(data.subtotal ?? 0),
    deliveryFee: Number(data.deliveryFee ?? 0),
    total: Number(data.total ?? 0),
    paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : 'COD',
    address: {
      label: typeof address.label === 'string' ? address.label : '',
      receiverName:
        typeof address.receiverName === 'string'
          ? address.receiverName
          : typeof data.customer === 'object' && data.customer !== null
            ? String((data.customer as Record<string, unknown>).name ?? '')
            : '',
      phone:
        typeof address.phone === 'string'
          ? address.phone
          : typeof data.customer === 'object' && data.customer !== null
            ? String((data.customer as Record<string, unknown>).phone ?? '')
            : '',
      line,
    },
    driverId: typeof data.driverId === 'string' ? data.driverId : null,
    driverName: typeof data.driverName === 'string' ? data.driverName : null,
    driverLocation:
      driverLocation &&
      typeof driverLocation.lat === 'number' &&
      typeof driverLocation.lng === 'number'
        ? {
            lat: driverLocation.lat,
            lng: driverLocation.lng,
            updatedAt: asMillis(driverLocation.updatedAt),
          }
        : null,
    statusHistory: Array.isArray(data.statusHistory)
      ? data.statusHistory
          .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
          .map((entry) => ({
            status: normalizeOrderStatus(String(entry.status ?? '')),
            at: asMillis(entry.at),
          }))
      : [],
    cancelReason: typeof data.cancelReason === 'string' ? data.cancelReason : '',
    createdAt: asMillis(data.createdAt),
    updatedAt: asMillis(data.updatedAt),
  };
}

/** Real-time feed of THIS customer's orders, newest first (§8). */
export function subscribeMyOrders(
  uid: string,
  onData: (orders: CustomerOrder[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const ordersQuery = query(
    collection(getDb(), 'orders'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(
    ordersQuery,
    (snapshot) => onData(snapshot.docs.map((docSnapshot) => mapOrderDoc(docSnapshot.id, docSnapshot.data()))),
    onError
  );
}

/** Real-time tracking for ONE order (timeline + bill + driver location). */
export function subscribeOrder(
  orderId: string,
  onData: (order: CustomerOrder | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), 'orders', orderId),
    (snapshot) => onData(snapshot.exists() ? mapOrderDoc(snapshot.id, snapshot.data()) : null),
    onError
  );
}

/* ────────────────────────────── status helpers ──────────────────────────── */

/** Statuses where the customer can still cancel (mirrors the Cloud Function). */
export function canCancel(status: OrderStatus): boolean {
  return status === 'Order Placed' || status === 'Accepted';
}

/** Statuses still in the kitchen / on the road (the "Active orders" tab). */
export function isActiveStatus(status: OrderStatus): boolean {
  return ['Order Placed', 'Accepted', 'Preparing', 'Out for Delivery'].includes(status);
}
