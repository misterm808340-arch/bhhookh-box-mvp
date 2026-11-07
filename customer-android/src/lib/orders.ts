import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
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
 * Writes the order to Firestore.
 *
 * Document shape (collection: `orders`) — identical to the schema consumed
 * by the admin dashboard and validated by firestore.rules:
 *
 * {
 *   orderId, customer: { name, phone, address },
 *   items: [{ name, price, quantity }],
 *   subtotal, deliveryFee, total,
 *   paymentMethod: 'COD', status: 'Pending', createdAt: serverTimestamp
 * }
 */
export async function placeOrder(input: CheckoutInput, lines: CartLine[]): Promise<string> {
  if (lines.length === 0) {
    throw new Error('Your cart is empty.');
  }
  const { subtotal, deliveryFee, total } = computeTotals(lines);
  const orderId = generateOrderId();
  const items: OrderItemPayload[] = lines.map((line) => ({
    name: line.item.name,
    price: line.item.price,
    quantity: line.quantity,
  }));

  await setDoc(doc(getDb(), 'orders', orderId), {
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
