import { getAdminDb } from "@/lib/backend/firebase-admin";
import {
  ADMIN_TRANSITIONS,
  ApiError,
  DRIVER_TRANSITIONS,
  Timestamp,
  getActiveDriver,
  normalizeStatus,
  requireUser,
  restockOrderItems,
  type OrderStatus,
} from "@/lib/backend/api-core";
import { apiRoute, asTrimmed, okResponse, readJsonBody } from "@/lib/backend/route-helpers";

/**
 * POST /api/orders/status — status updates by ADMIN (full workflow) and
 * DRIVER (delivery hand-off only). Every transition is validated against the
 * allowed state machine and appended to the customer-facing statusHistory.
 */
export const POST = apiRoute(async (request) => {
  const token = await requireUser(request);
  const data = await readJsonBody(request);
  const orderId = asTrimmed(data.orderId);
  const rawStatus = asTrimmed(data.status);
  const reason = asTrimmed(data.reason).slice(0, 200);
  if (!orderId || !rawStatus) {
    throw new ApiError("invalid-argument", "Order id and status are required.");
  }

  const db = getAdminDb();
  const orderRef = db.collection("orders").doc(orderId);

  // ── Resolve caller role (server-side, never from the payload) ──
  let actor: "admin" | "driver" | null = null;
  let driverName = "";

  const email = typeof token.email === "string" ? token.email.toLowerCase() : "";
  if (token.admin === true || (email && (await db.collection("admins").doc(email).get()).exists)) {
    actor = "admin";
  }
  if (!actor) {
    const driver = await getActiveDriver(token);
    if (driver) {
      actor = "driver";
      driverName = driver.name;
    }
  }
  if (!actor) throw new ApiError("permission-denied", "Not authorised to update orders.");

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(orderRef);
    if (!snapshot.exists) throw new ApiError("not-found", "Order not found.");
    const order = snapshot.data() ?? {};
    const current = normalizeStatus(order.status);
    const value = rawStatus === "Pending" ? "Order Placed" : rawStatus;
    if (
      !["Order Placed", "Accepted", "Rejected", "Preparing", "Out for Delivery", "Delivered", "Cancelled"].includes(
        value
      )
    ) {
      throw new ApiError("invalid-argument", "Unknown status.");
    }
    const next = value as OrderStatus;

    if (actor === "admin") {
      const allowed = ADMIN_TRANSITIONS[current] ?? [];
      if (!allowed.includes(next)) {
        throw new ApiError("failed-precondition", `Cannot move an order from ${current} to ${next}.`);
      }
    } else {
      // Driver: only their assigned orders, only delivery hand-off steps.
      if (order.driverId !== token.uid) {
        throw new ApiError("permission-denied", "This order is not assigned to you.");
      }
      const allowed = DRIVER_TRANSITIONS[current] ?? [];
      if (!allowed.includes(next)) {
        throw new ApiError("failed-precondition", `Cannot move an order from ${current} to ${next}.`);
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
  return okResponse({});
});
