import { getAdminDb } from "@/lib/backend/firebase-admin";
import { ApiError, Timestamp, normalizeStatus, requireUser, restockOrderItems } from "@/lib/backend/api-core";
import { apiRoute, asTrimmed, okResponse, readJsonBody } from "@/lib/backend/route-helpers";

/**
 * POST /api/orders/cancel — customers cancel their OWN order while it is
 * still Order Placed / Accepted. Tracked items are restocked.
 */
export const POST = apiRoute(async (request) => {
  const token = await requireUser(request);
  const data = await readJsonBody(request);
  const orderId = asTrimmed(data.orderId);
  const reason = asTrimmed(data.reason).slice(0, 200);
  if (!orderId) throw new ApiError("invalid-argument", "Order id is required.");

  const db = getAdminDb();
  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(orderRef);
    if (!snapshot.exists) throw new ApiError("not-found", "Order not found.");
    const order = snapshot.data() ?? {};
    if (order.uid !== token.uid) {
      throw new ApiError("permission-denied", "You can only cancel your own orders.");
    }
    const current = normalizeStatus(order.status);
    if (current !== "Order Placed" && current !== "Accepted") {
      throw new ApiError(
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
  return okResponse({});
});
