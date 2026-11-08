import {
  collection,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from './firebase';
import type { Category, FoodItem } from '../types';

/**
 * Live Firestore bindings for the menu catalogue.
 *
 * Collections (see firebase/firestore.rules):
 *   categories/{id} — managed by admins in the dashboard
 *   products/{id}   — every product carries a categoryId
 *
 * The customer app subscribes once and filters client-side (small
 * catalogue, zero composite indexes needed):
 *   - only enabled categories are shown
 *   - only available products are shown
 *   - products whose category is disabled are hidden too
 */

/** Defensive mapping Firestore → Category (tolerates partially written docs). */
export function mapCategory(snapshot: QueryDocumentSnapshot<DocumentData>): Category | null {
  const data = snapshot.data();
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) return null;
  return {
    id: snapshot.id,
    name,
    icon: typeof data.icon === 'string' && data.icon ? data.icon : 'restaurant-outline',
    emoji: typeof data.emoji === 'string' ? data.emoji.slice(0, 4) : '',
    imageUrl:
      typeof data.imageUrl === 'string' && data.imageUrl.startsWith('https://') ? data.imageUrl : '',
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Math.round(Number(data.sortOrder)) : 99,
    enabled: data.enabled === true,
  };
}

/** Defensive mapping Firestore → FoodItem. */
export function mapProduct(snapshot: QueryDocumentSnapshot<DocumentData>): FoodItem | null {
  const data = snapshot.data();
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const price = Math.round(Number(data.price));
  if (!name || !Number.isFinite(price) || price < 1) return null;
  const mrp = Number(data.mrp);
  const rating = Number(data.rating);
  const categoryId = typeof data.categoryId === 'string' ? data.categoryId : '';
  return {
    id: snapshot.id,
    name,
    description: typeof data.description === 'string' ? data.description : '',
    price,
    mrp: Number.isFinite(mrp) && mrp >= price ? Math.round(mrp) : null,
    categoryId,
    categoryName: typeof data.categoryName === 'string' ? data.categoryName : '',
    categoryIcon: typeof data.categoryIcon === 'string' ? data.categoryIcon : 'restaurant-outline',
    imageUrl:
      typeof data.imageUrl === 'string' && data.imageUrl.startsWith('https://') ? data.imageUrl : '',
    isVeg: data.isVeg !== false,
    popular: data.popular === true,
    available: data.available !== false,
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Math.round(Number(data.sortOrder)) : 99,
    rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : 4.5,
    prepTime: typeof data.prepTime === 'string' && data.prepTime ? data.prepTime : '15 min',
  };
}

/** Sort helper — admin-controlled order first, then alphabetical. */
export function bySortOrderThenName<T extends { sortOrder: number; name: string }>(a: T, b: T) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

/** Subscribe to ALL categories (admin may toggle enabled — we filter client-side). */
export function subscribeCategories(
  onData: (categories: Category[]) => void,
  onError: (message: string) => void
): () => void {
  const db = getDb();
  return onSnapshot(
    collection(db, 'categories'),
    (snapshot) => {
      const list = snapshot.docs
        .map(mapCategory)
        .filter((category): category is Category => category !== null)
        .sort(bySortOrderThenName);
      onData(list);
    },
    (error) => onError(error.message)
  );
}

/** Subscribe to ALL products (availability filtered client-side). */
export function subscribeProducts(
  onData: (products: FoodItem[]) => void,
  onError: (message: string) => void
): () => void {
  const db = getDb();
  return onSnapshot(
    collection(db, 'products'),
    (snapshot) => {
      const list = snapshot.docs
        .map(mapProduct)
        .filter((product): product is FoodItem => product !== null)
        .sort(bySortOrderThenName);
      onData(list);
    },
    (error) => onError(error.message)
  );
}

/** Percentage discount between MRP and price, e.g. 20 for ₹100 → ₹80. */
export function discountPercent(price: number, mrp: number | null): number | null {
  if (mrp === null || mrp <= price) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}
