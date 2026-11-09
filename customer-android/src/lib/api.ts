import { getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Client helper for the BHHOOKH BOX trusted backend (§7/§12).
 *
 * The Spark-plan backend is a small authenticated HTTP API (hosted free on
 * Vercel). Every order mutation is a POST with the signed-in user's Firebase
 * ID token; the server re-verifies identity, roles, prices and stock before
 * touching Firestore — the app can never submit a price of its own.
 *
 * The base URL comes from EXPO_PUBLIC_API_BASE_URL in `.env`
 * (e.g. https://bhhookh-box.vercel.app).
 */

export function apiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
}

export function isApiConfigured(): boolean {
  return /^https:\/\/.+/.test(apiBaseUrl());
}

interface ApiFailure {
  status: number;
  message: string;
}

export class ApiRequestError extends Error {
  constructor(public failure: ApiFailure) {
    super(failure.message);
  }
}

/** Authenticated POST to the trusted backend; throws ApiRequestError on failure. */
export async function callTrustedApi<T extends Record<string, unknown>>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiRequestError({
      status: 0,
      message:
        'The ordering service is not configured. Set EXPO_PUBLIC_API_BASE_URL in .env to the backend URL.',
    });
  }
  const currentUser = getAuth(getApp()).currentUser;
  if (!currentUser) {
    throw new ApiRequestError({ status: 401, message: 'Please log in and try again.' });
  }
  const idToken = await currentUser.getIdToken();

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiRequestError({
      status: 0,
      message: 'We could not reach the kitchen. Please check your internet connection and try again.',
    });
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // fall through — handled by the status check below
  }

  if (!response.ok) {
    throw new ApiRequestError({
      status: response.status,
      message:
        typeof data.error === 'string' && data.error
          ? data.error
          : 'We could not complete your request. Please try again in a moment.',
    });
  }
  return data as T;
}
