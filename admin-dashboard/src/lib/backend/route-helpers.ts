import { ApiError, httpStatusFor } from "./api-core";

/**
 * Shared plumbing for the trusted-backend API routes: CORS (the GitHub Pages
 * UI mirror may call this API from a different origin), JSON body parsing and
 * uniform error responses.
 *
 * Every route is authenticated with a Firebase ID token in the
 * `Authorization: Bearer <token>` header — CORS is therefore not a security
 * boundary here (browsers cannot forge the token), it only enables the
 * Pages-hosted dashboard mirror.
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  } catch {
    throw new ApiError("invalid-argument", "Invalid request body.");
  }
}

export function okResponse(payload: Record<string, unknown>): Response {
  return Response.json({ ok: true, ...payload }, { headers: CORS_HEADERS });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { ok: false, error: error.message },
      { status: httpStatusFor(error.code), headers: CORS_HEADERS }
    );
  }
  console.error("[bhhookh-box api]", error);
  return Response.json(
    { ok: false, error: "The server could not process this request. Please try again." },
    { status: 500, headers: CORS_HEADERS }
  );
}

/** Wraps a route handler with preflight + uniform error mapping. */
export function apiRoute(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    if (request.method === "OPTIONS") return corsPreflight();
    try {
      return await handler(request);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/* ─────────────────────────── input coercion helpers ─────────────────────── */

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function asTrimmed(value: unknown): string {
  return asString(value).trim();
}
