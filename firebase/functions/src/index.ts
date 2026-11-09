import { onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { Timestamp } from "firebase-admin/firestore";
import {
  ADMIN_TRANSITIONS,
  DRIVER_TRANSITIONS,
  HttpsError,
  auth,
  db,
  computePricing,
  generateOrderId,
  getDeliveryFee,
  isDriverCaller,
  normalizeStatus,
  requireAdmin,
  requireAuth,
  restockOrderItems,
  type OrderStatus,
} from "./common";

/**
 * BHHOOKH BOX trusted backend (§7/§12/§13).
 *
 * All order writes and role management flow through these callables so that
 * prices, discounts, stock and permissions are validated on the SERVER —
 * the client can never submit a price that the backend did not confirm.
 */

const REGION = { region: "us-central1", cors: true, maxInstances: 20 } as const;

/* ─────────────────────────────── createOrder ─────────────────────────────── */

interface CreateOrderItemInput {
  productId?: unknown;
  quantity?: unknown;
}

interface CreateOrderAddressInput {
  label?: unknown;
  receiverName?: unknown;
  phone?: unknown;
  line?: unknown;
}

/**
 * Secure order creation. The client sends ONLY product ids + quantities and a
 * delivery address — every price/total is computed here from fresh Firestore
 * data inside a transaction, and an immutable snapshot is embedded in order.
 */
export const createOrder = onCall(REGION, async (request) => {
  const session = requireAuth(request);
  const data = (request.data ?? {}) as Record<string, unknown>;

  // ── Validate input shape (never trust client-side prices) ──
  const rawItems = Array.isArray(data.items) ? (data.items as CreateOrderItemInput[]) : [];
  if (rawItems.length < 1 || rawItems.length > 50) {
    throw new HttpsError("invalid-argument", "Your cart must contain between 1 and 50 items.");
  }
  const wanted = new Map<string, number>();
  for (const entry of rawItems) {
    const productId = typeof entry?.productId === "string" ? entry.productId : "";
    const quantity = Math.round(Number(entry?.quantity));
    if (!productId || !Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
      throw new HttpsError("invalid-argument", "Invalid item in your cart. Please refresh and try again.");
    }
    wanted.set(productId, (wanted.get(productId) ?? 0) + quantity);
  }

  const addressInput = (data.address ?? {}) as CreateOrderAddressInput;
  const receiverName = typeof addressInput.receiverName === "string" ? addressInput.receiverName.trim() : "";
  const phone = typeof addressInput.phone === "string" ? addressInput.phone.trim() : "";
  const line = typeof addressInput.line === "string" ? addressInput.line.trim() : "";
  const label = typeof addressInput.label === "string" ? addressInput.label.trim().slice(0, 40) : "";
  if (receiverName.length < 2 || receiverName.length > 80) {
    throw new HttpsError("invalid-argument", "Please provide the receiver's full name.");
  }
  if (!/^\d{10}$/.test(phone)) {
    throw new HttpsError("invalid-argument", "Please provide a valid 10-digit mobile number.");
  }
  if (line.length < 10 || line.length > 500) {
    throw new HttpsError("invalid-argument", "Please provide a complete delivery address (at least 10 characters).");
  }

  // Customer identity comes from the AUTH session, never from the payload.
  const userRecord = await auth.getUser(session.uid);
  const customerName =
    typeof data.customerName === "string" && data.customerName.trim().length >= 2
      ? data.customerName.trim().slice(0, 80)
      : userRecord.displayName || receiverName;
  const customerEmail = (userRecord.email ?? "").toLowerCase();

  const deliveryFee = await getDeliveryFee();
  const now = new Date();

  // ── Transaction: price + stock validation and the order write ──
  const orderId = generateOrderId();
  const orderRef = db.collection("orders").doc(orderId);

  const result = await db.runTransaction(async (tx) => {
    const items: Array<{
      productId: string;
      name: string;
      unitPrice: number;
      mrp: number | null;
      discountPercent: number;
      quantity: number;
      lineTotal: number;
      imageUrl: string;
    }> = [];
    const stockDecrements: Array<{ ref: FirebaseFirestore.DocumentReference; current: number }> = [];

    for (const [productId, quantity] of wanted) {
      const productRef = db.collection("products").doc(productId);
      const snapshot = await tx.get(productRef);
      if (!snapshot.exists) {
        throw new HttpsError("failed-precondition", "An item in your cart is no longer on the menu.");
      }
      const product = snapshot.data() ?? {};
      if (product.available !== true) {
        throw new HttpsError(
          "failed-precondition",
          `"${String(product.name ?? "An item")}" is currently unavailable. Please remove it from your cart.`
        );
      }
      // Stock check — products with null stock are unlimited.
      const stock = product.stock;
      if (typeof stock === "number" && Number.isFinite(stock)) {
        const availableStock = Math.round(stock);
        if (availableStock < quantity) {
          throw new HttpsError(
            "failed-precondition",
            `"${String(product.name ?? "An item")}" has only ${Math.max(0, availableStock)} left in stock.`
          );
        }
        stockDecrements.push({ ref: productRef, current: availableStock });
      }

      const pricing = computePricing(product, now);
      items.push({
        productId,
        name: String(product.name ?? "Item").slice(0, 120),
        unitPrice: pricing.unitPrice,
        mrp: pricing.mrp,
        discountPercent: pricing.discountPercent,
        quantity,
        lineTotal: pricing.unitPrice * quantity,
        imageUrl: typeof product.imageUrl === "string" && product.imageUrl.startsWith("https://")
          ? product.imageUrl
          : "",
      });
    }

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    if (subtotal <= 0 || subtotal > 100000) {
      throw new HttpsError("failed-precondition", "Order subtotal is out of the allowed range.");
    }
    const total = subtotal + deliveryFee;

    // Immutable order document (§7) — historical receipts never change.
    tx.set(orderRef, {
      orderId,
      uid: session.uid,
      customer: {
        name: customerName,
        email: customerEmail,
        phone,
      },
      address: { label, receiverName, phone, line },
      items, // per-item price/discount snapshots (immutable)
      subtotal,
      deliveryFee,
      total,
      paymentMethod: "COD",
      status: "Order Placed",
      statusHistory: [{ status: "Order Placed", at: Timestamp.now() }],
      driverId: null,
      driverName: null,
      cancelReason: "",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Decrement tracked stock.
    for (const entry of stockDecrements) {
      tx.update(entry.ref, { stock: entry.current - (wanted.get(entry.ref.id) ?? 0) });
    }

    return { subtotal, deliveryFee, total };
  });

  logger.info("Order created", { orderId, uid: session.uid, total: result.total });
  return { orderId, ...result };
});

/* ─────────────────────────────── cancelOrder ─────────────────────────────── */

/** Customers may cancel their OWN order while it is Order Placed / Accepted. */
export const cancelOrder = onCall(REGION, async (request) => {
  const session = requireAuth(request);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const orderId = typeof data.orderId === "string" ? data.orderId : "";
  const reason = typeof data.reason === "string" ? data.reason.trim().slice(0, 200) : "";
  if (!orderId) throw new HttpsError("invalid-argument", "Order id is required.");

  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(orderRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Order not found.");
    const order = snapshot.data() ?? {};
    if (order.uid !== session.uid) {
      throw new HttpsError("permission-denied", "You can only cancel your own orders.");
    }
    const current = normalizeStatus(order.status);
    if (current !== "Order Placed" && current !== "Accepted") {
      throw new HttpsError(
        "failed-precondition",
        "This order can no longer be cancelled. Please contact support."
      );
    }
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    tx.update(orderRef, {
      status: "Cancelled",
      cancelReason: reason || "Cancelled by customer",
      statusHistory: [...history, { status: "Cancelled", at: Timestamp.now() }],
      updatedAt: Timestamp.now(),
    });
  });

  // Restock AFTER the transaction (best-effort; stock is advisory).
  const snapshot = await orderRef.get();
  if (snapshot.exists) await restockOrderItems(snapshot.data() ?? {});
  logger.info("Order cancelled by customer", { orderId, uid: session.uid });
  return { ok: true };
});

/* ──────────────────────────── updateOrderStatus ──────────────────────────── */

/**
 * Status updates by ADMIN (full workflow) and DRIVER (delivery hand-off only).
 * Every transition is validated against the allowed state machine, and a
 * statusHistory entry is appended (customer-facing timeline).
 */
export const updateOrderStatus = onCall(REGION, async (request) => {
  const session = requireAuth(request);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const orderId = typeof data.orderId === "string" ? data.orderId : "";
  const rawStatus = typeof data.status === "string" ? data.status : "";
  const reason = typeof data.reason === "string" ? data.reason.trim().slice(0, 200) : "";
  if (!orderId || !rawStatus) {
    throw new HttpsError("invalid-argument", "Order id and status are required.");
  }

  const orderRef = db.collection("orders").doc(orderId);

  // ── Resolve caller role ──
  let actor: "admin" | "driver" | null = null;
  let driverName = "";
  if (session.token.admin === true) {
    actor = "admin";
  } else {
    const email = session.token.email;
    if (typeof email === "string" && email) {
      const adminDoc = await db.collection("admins").doc(email.toLowerCase()).get();
      if (adminDoc.exists) actor = "admin";
    }
  }
  if (!actor) {
    const driver = await isDriverCaller(request);
    if (driver) {
      actor = "driver";
      driverName = driver.name;
    }
  }
  if (!actor) throw new HttpsError("permission-denied", "Not authorised to update orders.");

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(orderRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Order not found.");
    const order = snapshot.data() ?? {};
    const current = normalizeStatus(order.status);
    const next = ((): OrderStatus => {
      const value = rawStatus === "Pending" ? "Order Placed" : rawStatus;
      if (
        !["Order Placed", "Accepted", "Rejected", "Preparing", "Out for Delivery", "Delivered", "Cancelled"].includes(
          value
        )
      ) {
        throw new HttpsError("invalid-argument", "Unknown status.");
      }
      return value as OrderStatus;
    })();

    if (actor === "admin") {
      const allowed = ADMIN_TRANSITIONS[current] ?? [];
      if (!allowed.includes(next)) {
        throw new HttpsError("failed-precondition", `Cannot move an order from ${current} to ${next}.`);
      }
    } else {
      // Driver: only their assigned orders, only delivery hand-off steps.
      if (order.driverId !== session.uid) {
        throw new HttpsError("permission-denied", "This order is not assigned to you.");
      }
      const allowed = DRIVER_TRANSITIONS[current] ?? [];
      if (!allowed.includes(next)) {
        throw new HttpsError("failed-precondition", `Cannot move an order from ${current} to ${next}.`);
      }
    }

    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const update: Record<string, unknown> = {
      status: next,
      statusHistory: [...history, { status: next, at: Timestamp.now() }],
      updatedAt: Timestamp.now(),
    };
    if (next === "Rejected" || next === "Cancelled") {
      update.cancelReason =
        reason || (actor === "admin" ? "Rejected by restaurant" : "Cancelled");
    }
    if (actor === "driver" && next === "Delivered") {
      update.deliveredBy = driverName;
    }
    tx.update(orderRef, update);
  });

  if (rawStatus === "Rejected" || rawStatus === "Cancelled") {
    const snapshot = await orderRef.get();
    if (snapshot.exists) await restockOrderItems(snapshot.data() ?? {});
  }
  logger.info("Order status updated", { orderId, status: rawStatus, actor });
  return { ok: true };
});

/* ────────────────────────────── assignDriver ────────────────────────────── */

/** Admin assigns (or unassigns) a driver to an active order. */
export const assignDriver = onCall(REGION, async (request) => {
  await requireAdmin(request);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const orderId = typeof data.orderId === "string" ? data.orderId : "";
  const driverId = typeof data.driverId === "string" ? data.driverId : "";
  if (!orderId) throw new HttpsError("invalid-argument", "Order id is required.");

  const orderRef = db.collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Order not found.");
  const order = snapshot.data() ?? {};
  const current = normalizeStatus(order.status);
  if (!["Accepted", "Preparing", "Out for Delivery"].includes(current)) {
    throw new HttpsError("failed-precondition", "Drivers can only be assigned to active orders.");
  }

  if (!driverId) {
    await orderRef.update({ driverId: null, driverName: null, updatedAt: Timestamp.now() });
    return { ok: true, driverId: null };
  }

  const driverDoc = await db.collection("drivers").doc(driverId).get();
  if (!driverDoc.exists || driverDoc.data()?.active !== true) {
    throw new HttpsError("failed-precondition", "That driver is not active.");
  }
  const driverName = String(driverDoc.data()?.name ?? "Driver");
  await orderRef.update({
    driverId,
    driverName,
    updatedAt: Timestamp.now(),
  });
  logger.info("Driver assigned", { orderId, driverId });
  return { ok: true, driverId, driverName };
});

/* ────────────────────────────── createDriver ────────────────────────────── */

/** Admin creates a driver account (Auth user + drivers/{uid} + claim). */
export const createDriver = onCall(REGION, async (request) => {
  await requireAdmin(request);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const phone = typeof data.phone === "string" ? data.phone.trim() : "";
  const password = typeof data.password === "string" ? data.password : "";

  if (name.length < 2 || name.length > 80) {
    throw new HttpsError("invalid-argument", "Driver name must be 2–80 characters.");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Please provide a valid driver email.");
  }
  if (!/^\d{10}$/.test(phone)) {
    throw new HttpsError("invalid-argument", "Please provide a valid 10-digit mobile number.");
  }
  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Temporary password must be at least 6 characters.");
  }

  try {
    const user = await auth.createUser({ email, password, displayName: name });
    await auth.setCustomUserClaims(user.uid, { driver: true });
    await db.collection("drivers").doc(user.uid).set({
      uid: user.uid,
      name,
      email,
      phone,
      active: true,
      createdAt: Timestamp.now(),
    });
    logger.info("Driver created", { uid: user.uid, email });
    return { ok: true, driverId: user.uid };
  } catch (error) {
    const code = (error as { errorInfo?: { code?: string } })?.errorInfo?.code ?? "";
    if (code === "auth/email-already-exists" || code === "auth/email-already-in-use") {
      throw new HttpsError("failed-precondition", "A driver account with this email already exists.");
    }
    if (code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }
    logger.error("createDriver failed", error);
    throw new HttpsError("internal", "Could not create the driver account. Please try again.");
  }
});

/* ───────────────────────────── setDriverActive ───────────────────────────── */

/** Admin enables/disables a driver (disabled drivers cannot sign in usefully). */
export const setDriverActive = onCall(REGION, async (request) => {
  await requireAdmin(request);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const driverId = typeof data.driverId === "string" ? data.driverId : "";
  const active = data.active === true;
  if (!driverId) throw new HttpsError("invalid-argument", "Driver id is required.");

  const doc = await db.collection("drivers").doc(driverId).get();
  if (!doc.exists) throw new HttpsError("not-found", "Driver not found.");
  await db.collection("drivers").doc(driverId).update({
    active,
    updatedAt: Timestamp.now(),
  });
  try {
    if (active) {
      await auth.setCustomUserClaims(driverId, { driver: true });
    } else {
      await auth.setCustomUserClaims(driverId, { driver: false });
    }
  } catch (error) {
    logger.warn("Could not update driver claim", error);
  }
  return { ok: true };
});

/* ────────────────────────────── deleteDriver ────────────────────────────── */

/** Admin permanently removes a driver (Auth user + document). */
export const deleteDriver = onCall(REGION, async (request) => {
  await requireAdmin(request);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const driverId = typeof data.driverId === "string" ? data.driverId : "";
  if (!driverId) throw new HttpsError("invalid-argument", "Driver id is required.");

  try {
    await auth.deleteUser(driverId);
  } catch (error) {
    logger.warn("Auth user already gone?", error);
  }
  await db.collection("drivers").doc(driverId).delete();
  return { ok: true };
});

/* ─────────────────────────── seedCategories ─────────────────────────── */

/** Admin one-tap seed of the 9 required categories (idempotent). */
export const seedCategories = onCall(REGION, async (request) => {
  await requireAdmin(request);

  const NINE_CATEGORIES: Array<{
    id: string;
    name: string;
    icon: string;
    emoji: string;
    sortOrder: number;
  }> = [
    { id: "burgers", name: "Burgers", icon: "fast-food-outline", emoji: "🍔", sortOrder: 1 },
    { id: "pizza", name: "Pizza", icon: "pizza-outline", emoji: "🍕", sortOrder: 2 },
    { id: "biryani", name: "Biryani", icon: "restaurant-outline", emoji: "🍛", sortOrder: 3 },
    { id: "chinese", name: "Chinese", icon: "bowl-outline", emoji: "🥡", sortOrder: 4 },
    { id: "rolls", name: "Rolls", icon: "fast-food", emoji: "🌯", sortOrder: 5 },
    { id: "drinks", name: "Drinks", icon: "cafe-outline", emoji: "🥤", sortOrder: 6 },
    { id: "snacks", name: "Snacks", icon: "cube-outline", emoji: "🍟", sortOrder: 7 },
    { id: "desserts", name: "Desserts", icon: "ice-cream-outline", emoji: "🍰", sortOrder: 8 },
    { id: "fruits", name: "Fruits", icon: "nutrition-outline", emoji: "🍎", sortOrder: 9 },
  ];

  let created = 0;
  for (const category of NINE_CATEGORIES) {
    const ref = db.collection("categories").doc(category.id);
    const snapshot = await ref.get();
    if (snapshot.exists) continue; // idempotent — never overwrite admin edits
    await ref.set({
      name: category.name,
      icon: category.icon,
      emoji: category.emoji,
      enabled: true,
      sortOrder: category.sortOrder,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    created += 1;
  }
  logger.info("Categories seeded", { created });
  return { ok: true, created };
});
