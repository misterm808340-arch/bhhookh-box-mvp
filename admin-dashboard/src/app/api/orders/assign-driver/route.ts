import { getAdminDb } from "@/lib/backend/firebase-admin";
import { ApiError, Timestamp, normalizeStatus, requireAdmin } from "@/lib/backend/api-core";
import { apiRoute, asTrimmed, okResponse, readJsonBody } from "@/lib/backend/route-helpers";

/**
 * POST /api/orders/assign-driver — admin assigns (or unassigns, driverId="") a
 * delivery partner on an ACTIVE order.
 */
export const POST = apiRoute(async (request) => {
  await requireAdmin(request);
  const data = await readJsonBody(request);
  const orderId = asTrimmed(data.orderId);
  const driverId = asTrimmed(data.driverId);
  if (!orderId) throw new ApiError("invalid-argument", "Order id is required.");

  const db = getAdminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const snapshot = await orderRef.get();
  if (!snapshot.exists) throw new ApiError("not-found", "Order not found.");
  const order = snapshot.data() ?? {};
  const current = normalizeStatus(order.status);
  if (!["Accepted", "Preparing", "Out for Delivery"].includes(current)) {
    throw new ApiError("failed-precondition", "Drivers can only be assigned to active orders.");
  }

  if (!driverId) {
    await orderRef.update({ driverId: null, driverName: null, updatedAt: Timestamp.now() });
    return okResponse({ driverId: null, driverName: null });
  }

  const driverDoc = await db.collection("drivers").doc(driverId).get();
  if (!driverDoc.exists || driverDoc.data()?.active !== true) {
    throw new ApiError("failed-precondition", "That driver is not active.");
  }
  const driverName = String(driverDoc.data()?.name ?? "Driver");
  await orderRef.update({ driverId, driverName, updatedAt: Timestamp.now() });
  return okResponse({ driverId, driverName });
});
