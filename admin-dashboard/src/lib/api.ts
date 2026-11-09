import { callableErrorMessage, getFirebase, isFirebaseConfigured } from "@/lib/firebase";

/**
 * Client helper for the trusted backend API (§7/§12).
 *
 * Every order/driver mutation is an authenticated POST to the backend with
 * the signed-in admin's Firebase ID token. The SERVER re-verifies the admin
 * role on every call — the dashboard being visible proves nothing.
 *
 * - On Vercel (recommended) the API is same-origin: `/api/...`.
 * - On the GitHub Pages mirror set NEXT_PUBLIC_API_BASE_URL to the backend
 *   URL (e.g. https://bhhookh-box.vercel.app).
 */

export function apiBase(): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return base;
}

export async function callTrustedApi<T extends Record<string, unknown>>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Add your project credentials to .env.local.");
  }
  const { auth } = getFirebase();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Your session expired — sign in again.");
  }
  const idToken = await currentUser.getIdToken();

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }

  let data: (Record<string, unknown> & { error?: string }) | null = null;
  try {
    data = (await response.json()) as Record<string, unknown> & { error?: string };
  } catch {
    // fall through to the status check below
  }

  if (!response.ok) {
    const detail = typeof data?.error === "string" ? data.error : "";
    throw new Error(detail || `The server rejected this action (${response.status}).`);
  }
  return (data ?? { ok: true }) as T;
}

/** Human-readable message for a trusted-API failure (kept for older callers). */
export { callableErrorMessage };
