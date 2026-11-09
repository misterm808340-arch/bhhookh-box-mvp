import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/backend/firebase-admin";
import { ApiError, requireAdmin } from "@/lib/backend/api-core";
import { apiRoute, asTrimmed, okResponse, readJsonBody } from "@/lib/backend/route-helpers";

/**
 * POST /api/drivers/create — admin creates a driver account:
 * Auth user + `drivers/{uid}` document + `driver: true` custom claim.
 * Nothing client-side can ever grant driver access.
 */
export const POST = apiRoute(async (request) => {
  await requireAdmin(request);
  const data = await readJsonBody(request);
  const name = asTrimmed(data.name);
  const email = asTrimmed(data.email).toLowerCase();
  const phone = asTrimmed(data.phone);
  const password = typeof data.password === "string" ? data.password : "";

  if (name.length < 2 || name.length > 80) {
    throw new ApiError("invalid-argument", "Driver name must be 2–80 characters.");
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError("invalid-argument", "Please provide a valid driver email.");
  }
  if (!/^\d{10}$/.test(phone)) {
    throw new ApiError("invalid-argument", "Please provide a valid 10-digit mobile number.");
  }
  if (password.length < 6) {
    throw new ApiError("invalid-argument", "Temporary password must be at least 6 characters.");
  }

  const auth = getAdminAuth();
  const db = getAdminDb();
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
    return okResponse({ driverId: user.uid });
  } catch (error) {
    const code =
      (error as { errorInfo?: { code?: string } })?.errorInfo?.code ??
      (error as { code?: string })?.code ??
      "";
    if (code === "auth/email-already-exists" || code === "auth/email-already-in-use") {
      throw new ApiError("failed-precondition", "A driver account with this email already exists.");
    }
    if (code === "auth/invalid-password") {
      throw new ApiError("invalid-argument", "Password must be at least 6 characters.");
    }
    console.error("[drivers/create]", error);
    throw new ApiError("internal", "Could not create the driver account. Please try again.");
  }
});
