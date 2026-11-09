import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Timestamp as FsTimestamp,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebase } from "@/lib/firebase";

/**
 * BHHOOKH BOX menu catalogue — categories + products.
 *
 * Collections (see firebase/firestore.rules):
 *   categories/{id}  — public read, admin-only write
 *   products/{id}    — public read, admin-only write, every product has categoryId
 *
 * The 9 standard BHHOOKH BOX categories are seeded from the dashboard with
 * one click (Admin → Menu → "Add the 9 standard categories").
 */

// ───────────────────────────── Types ─────────────────────────────

export interface Category {
  id: string;
  name: string;
  icon: string;
  emoji: string;
  imageUrl: string;
  sortOrder: number;
  enabled: boolean;
  createdAt: FsTimestamp | null;
  updatedAt: FsTimestamp | null;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  /** Selling price (₹) — what the customer pays while the offer is active. */
  price: number;
  /** Original price before discount (₹) — null when no discount. */
  mrp: number | null;
  /** Offer schedule: while ON, price applies inside the window, mrp outside. */
  offerEnabled: boolean;
  offerStart: FsTimestamp | null;
  offerEnd: FsTimestamp | null;
  /** Stock count — null means unlimited. Customers cannot order more. */
  stock: number | null;
  /** Auto-calculated % OFF while the offer is active (0 = none). */
  discountPercent: number;
  imageUrl: string;
  isVeg: boolean;
  popular: boolean;
  available: boolean;
  sortOrder: number;
  rating: number;
  prepTime: string;
  createdAt: FsTimestamp | null;
  updatedAt: FsTimestamp | null;
}

// ─────────────────────── Icon palette (Ionicons) ───────────────────────

/** Verified Ionicons names — all render correctly in the customer app. */
export const CATEGORY_ICONS: string[] = [
  "restaurant-outline",
  "fast-food-outline",
  "pizza-outline",
  "flame-outline",
  "albums-outline",
  "cafe-outline",
  "pint-outline",
  "water-outline",
  "sparkles-outline",
  "ice-cream-outline",
  "nutrition-outline",
  "leaf-outline",
  "fish-outline",
  "egg-outline",
  "gift-outline",
  "star-outline",
  "heart-outline",
  "diamond-outline",
  "cart-outline",
  "grid-outline",
  "beer-outline",
  "wine-outline",
  "flash-outline",
  "game-controller-outline",
];

/** The 9 standard BHHOOKH BOX categories (id = lowercase name). */
export const STANDARD_CATEGORIES: { id: string; name: string; icon: string; emoji: string }[] = [
  { id: "burgers", name: "Burgers", icon: "fast-food-outline", emoji: "🍔" },
  { id: "pizza", name: "Pizza", icon: "pizza-outline", emoji: "🍕" },
  { id: "biryani", name: "Biryani", icon: "restaurant-outline", emoji: "🍛" },
  { id: "chinese", name: "Chinese", icon: "flame-outline", emoji: "🥡" },
  { id: "rolls", name: "Rolls", icon: "albums-outline", emoji: "🌯" },
  { id: "drinks", name: "Drinks", icon: "cafe-outline", emoji: "🥤" },
  { id: "snacks", name: "Snacks", icon: "sparkles-outline", emoji: "🍿" },
  { id: "desserts", name: "Desserts", icon: "ice-cream-outline", emoji: "🍦" },
  { id: "fruits", name: "Fruits", icon: "nutrition-outline", emoji: "🍎" },
];

// ───────────────────────────── Mappers ─────────────────────────────

const asTimestamp = (value: unknown): FsTimestamp | null =>
  typeof value === "object" && value !== null && "toDate" in value
    ? (value as FsTimestamp)
    : null;

const safeImageUrl = (value: unknown): string =>
  typeof value === "string" && value.startsWith("https://") ? value : "";

const safeInt = (value: unknown, fallback: number): number => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
};

export function mapCategory(snapshot: QueryDocumentSnapshot<DocumentData>): Category | null {
  const data = snapshot.data();
  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) return null;
  return {
    id: snapshot.id,
    name,
    icon: typeof data.icon === "string" && data.icon ? data.icon : "restaurant-outline",
    emoji: typeof data.emoji === "string" ? data.emoji.slice(0, 8) : "",
    imageUrl: safeImageUrl(data.imageUrl),
    sortOrder: safeInt(data.sortOrder, 99),
    enabled: data.enabled === true,
    createdAt: asTimestamp(data.createdAt),
    updatedAt: asTimestamp(data.updatedAt),
  };
}

export function mapProduct(snapshot: QueryDocumentSnapshot<DocumentData>): Product | null {
  const data = snapshot.data();
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const price = Math.round(Number(data.price));
  if (!name || !Number.isFinite(price) || price < 1) return null;
  const mrp = Number(data.mrp);
  const rating = Number(data.rating);
  const normalizedMrp = Number.isFinite(mrp) && mrp >= price ? Math.round(mrp) : null;
  return {
    id: snapshot.id,
    name,
    description: typeof data.description === "string" ? data.description : "",
    categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
    categoryName: typeof data.categoryName === "string" ? data.categoryName : "",
    price,
    mrp: normalizedMrp,
    offerEnabled: data.offerEnabled === true,
    offerStart: asTimestamp(data.offerStart),
    offerEnd: asTimestamp(data.offerEnd),
    stock:
      typeof data.stock === "number" && Number.isFinite(data.stock) && data.stock >= 0
        ? Math.round(data.stock)
        : null,
    discountPercent:
      Number.isFinite(Number(data.discountPercent)) && Number(data.discountPercent) > 0
        ? Math.round(Number(data.discountPercent))
        : (discountPercent(price, normalizedMrp) ?? 0),
    imageUrl: safeImageUrl(data.imageUrl),
    isVeg: data.isVeg !== false,
    popular: data.popular === true,
    available: data.available !== false,
    sortOrder: safeInt(data.sortOrder, 99),
    rating: Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : 4.5,
    prepTime: typeof data.prepTime === "string" && data.prepTime ? data.prepTime : "15 min",
    createdAt: asTimestamp(data.createdAt),
    updatedAt: asTimestamp(data.updatedAt),
  };
}

/** Sort helper — admin-controlled order first, then alphabetical. */
export function bySortOrderThenName<T extends { sortOrder: number; name: string }>(a: T, b: T) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name);
}

// ───────────────────────── Validation ─────────────────────────

export interface CategoryDraft {
  name: string;
  icon: string;
  emoji: string;
  imageUrl: string;
  sortOrder: number;
  enabled: boolean;
  /** Optional explicit Firestore doc id when creating (defaults to slugified name). */
  idHint?: string;
}

export interface ProductDraft {
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  price: number;
  mrp: number | null;
  /** Offer window switch — while OFF the item always sells at `price`. */
  offerEnabled: boolean;
  /** datetime-local strings ("" = unbounded). Converted to Timestamps on save. */
  offerStart: string;
  offerEnd: string;
  /** null = unlimited stock. */
  stock: number | null;
  imageUrl: string;
  isVeg: boolean;
  popular: boolean;
  available: boolean;
  sortOrder: number;
  rating: number;
  prepTime: string;
}

/** Returns an error message, or null when the draft is valid. */
export function validateCategory(draft: CategoryDraft): string | null {
  const name = draft.name.trim();
  if (name.length < 2 || name.length > 40) return "Category name must be 2–40 characters.";
  if (!draft.icon) return "Pick an icon for the category.";
  if (draft.imageUrl && !draft.imageUrl.startsWith("https://"))
    return "Category image URL must start with https://";
  if (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0 || draft.sortOrder > 9999)
    return "Sort order must be a whole number between 0 and 9999.";
  return null;
}

/** Returns an error message, or null when the draft is valid. */
export function validateProduct(draft: ProductDraft): string | null {
  const name = draft.name.trim();
  if (name.length < 2 || name.length > 120) return "Product name must be 2–120 characters.";
  if (!draft.categoryId) return "Please choose a category.";
  if (draft.description.length > 500) return "Description must be at most 500 characters.";
  if (!Number.isFinite(draft.price) || draft.price < 1 || draft.price > 100000)
    return "Price must be between ₹1 and ₹1,00,000.";
  if (draft.mrp !== null && (draft.mrp < draft.price || draft.mrp > 200000))
    return "Original price (MRP) must be ≥ the selling price.";
  if (draft.stock !== null && (!Number.isInteger(draft.stock) || draft.stock < 0 || draft.stock > 10000))
    return "Stock must be a whole number between 0 and 10,000 (or empty for unlimited).";
  if (draft.offerEnabled) {
    const start = parseLocalDateTime(draft.offerStart);
    const end = parseLocalDateTime(draft.offerEnd);
    if (draft.offerStart && start === null) return "Offer start date is invalid.";
    if (draft.offerEnd && end === null) return "Offer end date is invalid.";
    if (start !== null && end !== null && end.getTime() <= start.getTime())
      return "Offer end must be after the offer start.";
    if (draft.mrp === null)
      return "Offers need an original price (MRP) so the % OFF can be calculated.";
  }
  if (draft.rating < 0 || draft.rating > 5) return "Rating must be between 0 and 5.";
  if (draft.prepTime.length > 24) return "Prep time must be at most 24 characters.";
  if (draft.imageUrl && !draft.imageUrl.startsWith("https://"))
    return "Product image URL must start with https://";
  return null;
}

// ───────────────────────────── CRUD ─────────────────────────────

export async function saveCategory(
  id: string | null,
  draft: CategoryDraft
): Promise<void> {
  const { db } = getFirebase();
  const payload: Record<string, unknown> = {
    name: draft.name.trim(),
    icon: draft.icon,
    enabled: draft.enabled,
    sortOrder: draft.sortOrder,
    updatedAt: serverTimestamp(),
  };
  // Emptied optional fields must actually be REMOVED on edit, not left behind.
  if (draft.emoji.trim()) payload.emoji = draft.emoji.trim().slice(0, 8);
  else if (id) payload.emoji = deleteField();
  if (draft.imageUrl.trim()) payload.imageUrl = draft.imageUrl.trim();
  else if (id) payload.imageUrl = deleteField();

  if (id) {
    await updateDoc(doc(db, "categories", id), payload);
  } else {
    // Deterministic id from the name keeps repeat seeds idempotent.
    const docId = draft.idHint ?? slugify(draft.name);
    await setDoc(doc(db, "categories", docId), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const { db } = getFirebase();
  await deleteDoc(doc(db, "categories", id));
}

/** Reassign every product from one category to another (batched, ≤500 per batch). */
export async function reassignProducts(fromCategoryId: string, toCategoryId: string, toCategoryName: string): Promise<number> {
  const { db } = getFirebase();
  const snapshot = await getDocs(collection(db, "products"));
  const moving = snapshot.docs.filter((d) => d.data().categoryId === fromCategoryId);
  for (let i = 0; i < moving.length; i += 400) {
    const batch = writeBatch(db);
    for (const item of moving.slice(i, i + 400)) {
      batch.update(item.ref, {
        categoryId: toCategoryId,
        categoryName: toCategoryName,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return moving.length;
}

export async function saveProduct(id: string | null, draft: ProductDraft): Promise<void> {
  const { db } = getFirebase();
  const offerActive = draft.offerEnabled && draft.mrp !== null;
  const start = parseLocalDateTime(draft.offerStart);
  const end = parseLocalDateTime(draft.offerEnd);
  const payload: Record<string, unknown> = {
    name: draft.name.trim(),
    description: draft.description.trim(),
    categoryId: draft.categoryId,
    categoryName: draft.categoryName,
    price: Math.round(draft.price),
    offerEnabled: offerActive,
    offerStart: offerActive && start ? Timestamp.fromDate(start) : null,
    offerEnd: offerActive && end ? Timestamp.fromDate(end) : null,
    // Auto-calculated discount % (mrp vs selling price) — stored for the
    // customer app and future sales reporting.
    discountPercent:
      draft.mrp !== null && draft.mrp > draft.price
        ? Math.round(((draft.mrp - draft.price) / draft.mrp) * 100)
        : 0,
    isVeg: draft.isVeg,
    popular: draft.popular,
    available: draft.available,
    sortOrder: draft.sortOrder,
    rating: draft.rating,
    prepTime: draft.prepTime.trim() || "15 min",
    updatedAt: serverTimestamp(),
  };
  // Emptied optional fields must actually be REMOVED on edit, not left behind.
  if (draft.mrp !== null) payload.mrp = Math.round(draft.mrp);
  else if (id) payload.mrp = deleteField();
  if (draft.stock !== null) payload.stock = Math.round(draft.stock);
  else if (id) payload.stock = deleteField();
  if (draft.imageUrl.trim()) payload.imageUrl = draft.imageUrl.trim();
  else if (id) payload.imageUrl = deleteField();

  if (id) {
    await updateDoc(doc(db, "products", id), payload);
  } else {
    await setDoc(doc(db, "products", slugify(draft.name) || randomId()), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const { db } = getFirebase();
  await deleteDoc(doc(db, "products", id));
}

/** Instant enable/disable toggle from the category card. */
export async function toggleCategory(id: string, enabled: boolean): Promise<void> {
  const { db } = getFirebase();
  await updateDoc(doc(db, "categories", id), { enabled, updatedAt: serverTimestamp() });
}

/** Instant availability toggle from the product row. */
export async function toggleProduct(id: string, available: boolean): Promise<void> {
  const { db } = getFirebase();
  await updateDoc(doc(db, "products", id), { available, updatedAt: serverTimestamp() });
}

/** Creates any of the 9 standard categories that do not exist yet. Returns created names. */
export async function seedStandardCategories(existing: Category[]): Promise<string[]> {
  const { db } = getFirebase();
  const existingNames = new Set(existing.map((category) => category.name.toLowerCase()));
  const missing = STANDARD_CATEGORIES.filter(
    (standard) => !existingNames.has(standard.name.toLowerCase())
  );
  for (let i = 0; i < missing.length; i++) {
    const standard = missing[i]!;
    await setDoc(doc(db, "categories", standard.id), {
      name: standard.name,
      icon: standard.icon,
      emoji: standard.emoji,
      enabled: true,
      sortOrder: i + 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return missing.map((standard) => standard.name);
}

// ───────────────────────────── Helpers ─────────────────────────────

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || ""
  );
}

function randomId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Percentage discount between MRP and price, e.g. 20 for ₹100 → ₹80. */
export function discountPercent(price: number, mrp: number | null): number | null {
  if (mrp === null || mrp <= price) return null;
  return Math.round(((mrp - price) / mrp) * 100);
}

// ───────────────────────── Product image upload ─────────────────────────

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Uploads a product image to Firebase Storage under products/ and returns its
 * public download URL. Requires an admin custom claim (see the bootstrap
 * script in the setup docs). Progress is reported 0–100.
 */
export function uploadProductImage(
  file: File,
  onProgress: (percent: number) => void
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return Promise.reject(new Error("Please choose a JPG, PNG or WebP image."));
  }
  if (file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error("Image must be smaller than 5 MB."));
  }
  const { app } = getFirebase();
  const storage = getStorage(app);
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-60) || "image";
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.${extension}`;
  const imageRef = ref(storage, path);
  const task = uploadBytesResumable(imageRef, file, { contentType: file.type });
  return new Promise<string>((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress(percent);
      },
      (error) => {
        if (error.code === "storage/unauthorized") {
          reject(
            new Error(
              "Upload not authorised — run the admin bootstrap script once (sets the admin claim) and sign in again. See the setup docs."
            )
          );
        } else {
          reject(new Error(error.message));
        }
      },
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Upload failed."));
        }
      }
    );
  });
}

/** Converts a datetime-local input value ("2026-01-01T09:30") to a Date. */
export function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Converts a Firestore Timestamp to a datetime-local input value ("" if null). */
export function timestampToInputValue(value: FsTimestamp | null): string {
  if (!value) return "";
  const date = value.toDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
