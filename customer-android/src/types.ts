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
  /** Current selling price in ₹ (always the authoritative Firestore value). */
  price: number;
  /** Original price before discount — null when no discount. */
  mrp: number | null;
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
  | 'Pending'
  | 'Accepted'
  | 'Preparing'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Rejected';
