import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from './firebase';
import {
  DELIVERY_FEE,
  MAX_ADDRESS_LENGTH,
  MAX_NAME_LENGTH,
  MIN_ADDRESS_LENGTH,
  MIN_NAME_LENGTH,
  PHONE_PATTERN,
} from '../config';
import type { CartLine, OrderItemPayload } from '../types';

export interface CheckoutInput {
  name: string;
  phone: string;
  address: string;
}

export interface Totals {
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}

/**
 * Generates a human-friendly, unique order id such as "BHB-M3XK9A2-7QD".
 * The same string is used as the Firestore document id, so support staff can
 * find any order by its id.
 */
export function generateOrderId(): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart =
    Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[^A-Z0-9]/g, 'X') || 'ZZ9';
  return `BHB-${timePart}-${randomPart}`;
}

export function computeTotals(lines: CartLine[]): Totals {
  const subtotal = lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  const deliveryFee = lines.length > 0 ? DELIVERY_FEE : 0;
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  return { subtotal, deliveryFee, total: subtotal + deliveryFee, itemCount };
}

export interface CheckoutErrors {
  name?: string;
  phone?: string;
  address?: string;
}

/** Client-side mirror of the Firestore security rules validation. */
export function validateCheckout(input: CheckoutInput): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const name = input.name.trim();
  const phone = input.phone.trim();
  const address = input.address.trim();

  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    errors.name = 'Please enter your full name (2–80 characters).';
  }
  if (!PHONE_PATTERN.test(phone)) {
    errors.phone = 'Please enter a valid 10-digit mobile number.';
  }
  if (address.length < MIN_ADDRESS_LENGTH || address.length > MAX_ADDRESS_LENGTH) {
    errors.address = 'Please enter your complete delivery address (at least 10 characters).';
  }
  return errors;
}

/**
 * Thrown when a cart item fails re-validation against Firestore at checkout
 * (product deleted, marked unavailable, or its price changed).
 */
export class OrderValidationError extends Error {}

/**
 * Writes the order to Firestore.
 *
 * Document shape (collection: `orders`) — identical to the schema consumed
 * by the admin dashboard and validated by firestore.rules:
 *
 * {
 *   orderId, customer: { name, phone, address },
 *   items: [{ productId?, name, price, quantity }],
 *   subtotal, deliveryFee, total,
 *   paymentMethod: 'COD', status: 'Pending', createdAt: serverTimestamp
 * }
 *
 * Trusted-data validation before order creation: every cart line is
 * re-read from Firestore (the trusted source — only admins can write
 * products) and the payload is rebuilt from the FRESH price and
 * availability. Stale carts, deleted products and items switched to
 * unavailable are rejected here, before anything is written.
 */
export async function placeOrder(input: CheckoutInput, lines: CartLine[]): Promise<string> {
  if (lines.length === 0) {
    throw new Error('Your cart is empty.');
  }
  const db = getDb();

  const items: OrderItemPayload[] = [];
  for (const line of lines) {
    const snapshot = await getDoc(doc(db, 'products', line.item.id));
    if (!snapshot.exists()) {
      throw new OrderValidationError(
        `"${line.item.name}" is no longer on the menu. Please remove it from your cart.`
      );
    }
    const data = snapshot.data();
    if (data.available !== true) {
      throw new OrderValidationError(
        `"${line.item.name}" is currently unavailable. Please remove it from your cart.`
      );
    }
    const freshPrice = Math.round(Number(data.price));
    if (!Number.isFinite(freshPrice) || freshPrice < 1) {
      throw new OrderValidationError(
        `"${line.item.name}" has an invalid price right now. Please try again later.`
      );
    }
    items.push({
      productId: line.item.id,
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : line.item.name,
      price: freshPrice,
      quantity: line.quantity,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = DELIVERY_FEE;
  const total = subtotal + deliveryFee;
  const orderId = generateOrderId();

  await setDoc(doc(db, 'orders', orderId), {
    orderId,
    customer: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
    },
    items,
    subtotal,
    deliveryFee,
    total,
    paymentMethod: 'COD',
    status: 'Pending',
    createdAt: serverTimestamp(),
  });

  return orderId;
}
