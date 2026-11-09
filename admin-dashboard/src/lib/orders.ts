import { Timestamp } from "firebase/firestore";

/**
 * BHHOOKH BOX order model (§8/§10) — the 7-status workflow:
 *   Order Placed → Accepted → Preparing → Out for Delivery → Delivered
 *   Order Placed → Rejected          (admin, before kitchen starts)
 *   Order Placed / Accepted / Preparing → Cancelled (customer or admin)
 * The legacy v1.1.0 status "Pending" is normalised to "Order Placed" on read.
 */
export const ORDER_STATUSES = [
  "Order Placed",
  "Accepted",
  "Preparing",
  "Out for Delivery",
  "Delivered",
  "Rejected",
  "Cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Normalises the legacy "Pending" status (and trims) to the current model. */
export function normalizeStatus(value: unknown): OrderStatus {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "Pending") return "Order Placed";
  if ((ORDER_STATUSES as readonly string[]).includes(raw)) return raw as OrderStatus;
  return "Order Placed";
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** One immutable item snapshot written by the `createOrder` Cloud Function. */
export interface OrderItem {
  productId?: string;
  name: string;
  /** Server-verified selling price per unit (legacy orders: `price`). */
  unitPrice: number;
  mrp: number | null;
  discountPercent: number;
  quantity: number;
  /** unitPrice × quantity (legacy orders: computed on read). */
  lineTotal: number;
}

export interface OrderAddress {
  label: string;
  receiverName: string;
  phone: string;
  line: string;
}

export interface OrderStatusEvent {
  status: string;
  at: Timestamp | null;
}

export interface Order {
  /** Firestore document id (identical to the human readable orderId). */
  id: string;
  orderId: string;
  /** Auth uid of the customer — null on legacy v1.0 orders. */
  uid: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  address: OrderAddress;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  status: OrderStatus;
  driverId: string | null;
  driverName: string | null;
  statusHistory: OrderStatusEvent[];
  cancelReason: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** The single "next step" the admin usually wants for each status. */
export const NEXT_ACTION: Partial<Record<OrderStatus, OrderStatus>> = {
  "Order Placed": "Accepted",
  Accepted: "Preparing",
  Preparing: "Out for Delivery",
  "Out for Delivery": "Delivered",
};

export const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  "Order Placed": "Accept Order",
  Accepted: "Start Preparing",
  Preparing: "Mark Out for Delivery",
  "Out for Delivery": "Mark Delivered",
};

/** Statuses for which a driver can be assigned (mirrors assignDriver). */
export const ASSIGNABLE_STATUSES: OrderStatus[] = [
  "Accepted",
  "Preparing",
  "Out for Delivery",
];

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

/** e.g. "04 Nov, 1:45 pm" (IST). */
export function formatOrderTime(ts: Timestamp | null): string {
  if (!ts) return "just now";
  return dateTimeFormatter.format(ts.toDate());
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** IST calendar-day key (YYYY-MM-DD) used for "today" aggregates (§11). */
export function istDayKey(ts: Timestamp | null): string | null {
  if (!ts) return null;
  try {
    return dayFormatter.format(ts.toDate());
  } catch {
    return null;
  }
}

export function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "just now";
  const diffMs = Date.now() - ts.toDate().getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

/** Fresh = a newly placed order from the last 10 minutes. */
export function isFreshPending(order: Order, withinMs = 10 * 60 * 1000): boolean {
  return (
    order.status === "Order Placed" &&
    order.createdAt !== null &&
    Date.now() - order.createdAt.toDate().getTime() < withinMs
  );
}
