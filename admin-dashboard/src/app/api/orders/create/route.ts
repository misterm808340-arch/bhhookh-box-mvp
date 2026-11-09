import { getAdminAuth, getAdminDb } from "@/lib/backend/firebase-admin";
import {
  ApiError,
  Timestamp,
  computePricing,
  generateOrderId,
  getDeliveryFee,
  requireUser,
} from "@/lib/backend/api-core";
import { apiRoute, asTrimmed, okResponse, readJsonBody } from "@/lib/backend/route-helpers";

/**
 * POST /api/orders/create — secure checkout (§7).
 *
 * The client sends ONLY product ids + quantities + a delivery address. Every
 * price/discount/stock decision happens HERE inside a transaction against the
 * fresh Firestore products, and an immutable price snapshot is embedded in
 * the order. Clients can never submit a price the server did not compute.
 */

interface ItemInput {
  productId?: unknown;
  quantity?: unknown;
}

interface AddressInput {
  label?: unknown;
  receiverName?: unknown;
  phone?: unknown;
  line?: unknown;
}

export const POST = apiRoute(async (request) => {
  const token = await requireUser(request);
  const data = await readJsonBody(request);

  // ── Validate input shape (never trust client-side prices) ──
  const rawItems = Array.isArray(data.items) ? (data.items as ItemInput[]) : [];
  if (rawItems.length < 1 || rawItems.length > 50) {
    throw new ApiError("invalid-argument", "Your cart must contain between 1 and 50 items.");
  }
  const wanted = new Map<string, number>();
  for (const entry of rawItems) {
    const productId = typeof entry?.productId === "string" ? entry.productId : "";
    const quantity = Math.round(Number(entry?.quantity));
    if (!productId || !Number.isFinite(quantity) || quantity < 1 || quantity > 20) {
      throw new ApiError("invalid-argument", "Invalid item in your cart. Please refresh and try again.");
    }
    wanted.set(productId, (wanted.get(productId) ?? 0) + quantity);
  }

  const addressInput = (data.address ?? {}) as AddressInput;
  const receiverName = asTrimmed(addressInput.receiverName);
  const phone = asTrimmed(addressInput.phone);
  const line = asTrimmed(addressInput.line);
  const label = asTrimmed(addressInput.label).slice(0, 40);
  if (receiverName.length < 2 || receiverName.length > 80) {
    throw new ApiError("invalid-argument", "Please provide the receiver's full name.");
  }
  if (!/^\d{10}$/.test(phone)) {
    throw new ApiError("invalid-argument", "Please provide a valid 10-digit mobile number.");
  }
  if (line.length < 10 || line.length > 500) {
    throw new ApiError("invalid-argument", "Please provide a complete delivery address (at least 10 characters).");
  }

  // Customer identity comes from the AUTH session, never from the payload.
  const userRecord = await getAdminAuth().getUser(token.uid);
  const customerName =
    asTrimmed(data.customerName).length >= 2
      ? asTrimmed(data.customerName).slice(0, 80)
      : userRecord.displayName || receiverName;
  const customerEmail = (userRecord.email ?? "").toLowerCase();

  const deliveryFee = await getDeliveryFee();
  const now = new Date();
  const db = getAdminDb();

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
        throw new ApiError("failed-precondition", "An item in your cart is no longer on the menu.");
      }
      const product = snapshot.data() ?? {};
      if (product.available !== true) {
        throw new ApiError(
          "failed-precondition",
          `"${String(product.name ?? "An item")}" is currently unavailable. Please remove it from your cart.`
        );
      }
      // Stock check — products with null stock are unlimited.
      const stock = product.stock;
      if (typeof stock === "number" && Number.isFinite(stock)) {
        const availableStock = Math.round(stock);
        if (availableStock < quantity) {
          throw new ApiError(
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
        imageUrl:
          typeof product.imageUrl === "string" && product.imageUrl.startsWith("https://")
            ? product.imageUrl
            : "",
      });
    }

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    if (subtotal <= 0 || subtotal > 100000) {
      throw new ApiError("failed-precondition", "Order subtotal is out of the allowed range.");
    }
    const total = subtotal + deliveryFee;

    // Immutable order document (§7) — historical receipts never change.
    tx.set(orderRef, {
      orderId,
      uid: token.uid,
      customer: { name: customerName, email: customerEmail, phone },
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

  return okResponse({ orderId, ...result });
});
