import { getAdminAuth, getAdminDb } from "@/lib/backend/firebase-admin";
import { ApiError, requireAdmin } from "@/lib/backend/api-core";
import { apiRoute, asTrimmed, okResponse, readJsonBody } from "@/lib/backend/route-helpers";

/**
 * POST /api/drivers/set-active — admin enables/disables a driver. Disabled
 * drivers cannot act on orders (checked server-side on every status update).
 */
export const POST = apiRoute(async (request) => {
  await requireAdmin(request);
  const data = await readJsonBody(request);
  const driverId = asTrimmed(data.driverId);
  const active = data.active === true;
  if (!driverId) throw new ApiError("invalid-argument", "Driver id is required.");

  const db = getAdminDb();
  const doc = await db.collection("drivers").doc(driverId).get();
  if (!doc.exists) throw new ApiError("not-found", "Driver not found.");
  await db.collection("drivers").doc(driverId).update({
    active,
    updatedAt: new Date(),
  });
  try {
    await getAdminAuth().setCustomUserClaims(driverId, { driver: active });
  } catch (error) {
    console.warn("[drivers/set-active] claim update failed", error);
  }
  return okResponse({});
});
