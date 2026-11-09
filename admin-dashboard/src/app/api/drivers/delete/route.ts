import { getAdminAuth, getAdminDb } from "@/lib/backend/firebase-admin";
import { ApiError, requireAdmin } from "@/lib/backend/api-core";
import { apiRoute, asTrimmed, okResponse, readJsonBody } from "@/lib/backend/route-helpers";

/**
 * POST /api/drivers/delete — admin permanently removes a driver
 * (the Auth user AND the `drivers/{uid}` roster document).
 */
export const POST = apiRoute(async (request) => {
  await requireAdmin(request);
  const data = await readJsonBody(request);
  const driverId = asTrimmed(data.driverId);
  if (!driverId) throw new ApiError("invalid-argument", "Driver id is required.");

  try {
    await getAdminAuth().deleteUser(driverId);
  } catch (error) {
    // Auth user already gone — still remove the roster document.
    console.warn("[drivers/delete] auth user already gone?", error);
  }
  await getAdminDb().collection("drivers").doc(driverId).delete();
  return okResponse({});
});
