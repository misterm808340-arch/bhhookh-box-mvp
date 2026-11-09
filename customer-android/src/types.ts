import type { ImageSourcePropType } from 'react-native';

/**
 * Firestore `categories` collection document.
 * Customers only ever see categories with `enabled: true`.
 */
export interface Category {
  /** Firestore document id. */
  id: string;
  name: string;
  /** Ionicons name chosen by the admin (e.g. "pizza-outline"). */
  icon: string;
  /** Short emoji fallback shown when the icon cannot render. */
  emoji: string;
  /** Optional remote image (https URL) — overrides the icon when present. */
  imageUrl: string;
  sortOrder: number;
  enabled: boolean;
}

export interface FoodItem {
  /** Firestore product document id. */
  id: string;
  name: string;
  description: string;
  /** List selling price in ₹ (authoritative Firestore value). */
  price: number;
  /** Original price before discount — null when no discount. */
  mrp: number | null;
  /** Offer schedule: while ON, the sale price applies only inside the window. */
  offerEnabled: boolean;
  /** Offer window boundaries in epoch millis (null = unbounded side). */
  offerStart: number | null;
  offerEnd: number | null;
  /** What the customer pays RIGHT NOW — `price` inside the window,
   *  reverts to `mrp` when a scheduled offer is inactive. */
  effectivePrice: number;
  /** Auto-calculated % OFF that applies right now (0 = none). */
  discountPercent: number;
  /** Remaining stock — null means unlimited; 0 = out of stock. */
  stock: number | null;
  /** Category document id (required on every product). */
  categoryId: string;
  /** Denormalised category name for display. */
  categoryName: string;
  /** Denormalised category icon — used as the image fallback. */
  categoryIcon: string;
  /** Optional remote product image (https URL). */
  imageUrl: string;
  /** Optional bundled asset image (legacy local menu — Firestore data has none). */
  image?: ImageSourcePropType;
  isVeg: boolean;
  popular: boolean;
  /** Unavailable products are hidden from normal ordering. */
  available: boolean;
  /** Admin-controlled display order (lower first). */
  sortOrder: number;
  rating: number;
  prepTime: string;
}

export interface CartLine {
  item: FoodItem;
  quantity: number;
}

/** Exactly the item shape stored in Firestore order documents. */
export interface OrderItemPayload {
  name: string;
  price: number;
  quantity: number;
  /** Product document id (optional so older app versions stay rule-compliant). */
  productId?: string;
}

export type OrderStatus =
  | 'Order Placed'
  | 'Accepted'
  | 'Rejected'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

/** Maps the legacy v1.1.0 status to the current 7-status model. */
export function normalizeOrderStatus(raw: string): OrderStatus {
  if (raw === 'Pending') return 'Order Placed';
  return raw as OrderStatus;
}

/** One item inside an order — an immutable price snapshot written by the
 *  `createOrder` Cloud Function (§7). Never re-computed client-side. */
export interface OrderItemSnapshot {
  productId: string;
  name: string;
  unitPrice: number;
  mrp: number | null;
  discountPercent: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string;
}

/** A status history entry on an order (customer-facing timeline, §8). */
export interface OrderStatusEvent {
  status: string;
  /** Epoch millis (null while the Timestamp is pending). */
  at: number | null;
}

/** Live delivery position written by the driver's device (§9). */
export interface DriverLocation {
  lat: number;
  lng: number;
  /** Epoch millis of the last GPS update. */
  updatedAt: number | null;
}

/** Firestore `orders/{id}` as seen by the customer app. */
export interface CustomerOrder {
  /** Firestore document id (same string as `orderId`). */
  id: string;
  orderId: string;
  status: OrderStatus;
  items: OrderItemSnapshot[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  address: {
    label: string;
    receiverName: string;
    phone: string;
    line: string;
  };
  driverId: string | null;
  driverName: string | null;
  driverLocation: DriverLocation | null;
  statusHistory: OrderStatusEvent[];
  cancelReason: string;
  createdAt: number | null;
  updatedAt: number | null;
}
