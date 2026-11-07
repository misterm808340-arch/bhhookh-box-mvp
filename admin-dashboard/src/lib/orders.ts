import { Timestamp } from "firebase/firestore";

/** All possible order statuses, in workflow order (Rejected is terminal). */
export const ORDER_STATUSES = [
  "Pending",
  "Accepted",
  "Preparing",
  "Out for Delivery",
  "Delivered",
  "Rejected",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  address: string;
}

export interface Order {
  /** Firestore document id (identical to the human readable orderId). */
  id: string;
  orderId: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  status: OrderStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/**
 * Allowed forward transitions. This mirrors the Firestore security rules,
 * which only permit these exact status changes plus Pending → Rejected.
 */
export const STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus>> = {
  Pending: "Accepted",
  Accepted: "Preparing",
  Preparing: "Out for Delivery",
  "Out for Delivery": "Delivered",
};

export const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  Pending: "Accept Order",
  Accepted: "Start Preparing",
  Preparing: "Mark Out for Delivery",
  "Out for Delivery": "Mark Delivered",
};

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

/** Fresh = a Pending order placed within the last 10 minutes. */
export function isFreshPending(order: Order, withinMs = 10 * 60 * 1000): boolean {
  return (
    order.status === "Pending" &&
    order.createdAt !== null &&
    Date.now() - order.createdAt.toDate().getTime() < withinMs
  );
}
