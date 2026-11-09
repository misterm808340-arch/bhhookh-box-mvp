# BHHOOKH BOX — File Change List (v1.2.0 → v1.3.0)

**Theme: Spark-plan compatible trusted backend.** Firebase's free Spark plan
cannot deploy Cloud Functions (they require Blaze), so the trusted backend was
ported to 7 authenticated Next.js API routes inside the admin dashboard, using
the Firebase Admin SDK and hosted free on Vercel. The security guarantees are
unchanged: server-verified prices, immutable price snapshots, role
re-verification on every call, and the order state machine.

**Totals:** 20 files changed (5 added, 15 modified)

## Admin dashboard (the dashboard IS the backend now)

| Status | File | What changed |
| --- | --- | --- |
| A | `src/lib/backend/firebase-admin.ts` | Firebase Admin SDK singleton — credentials from `FIREBASE_SERVICE_ACCOUNT` env var (server-only, never committed) |
| A | `src/lib/backend/api-core.ts` | Backend core ported from `functions/`: pricing engine (MRP/sale/offer-window), 7-status state machine, `requireUser`/`requireAdmin`/`getActiveDriver`, order-id generator, restock helper |
| A | `src/lib/backend/route-helpers.ts` | CORS, JSON body parsing, uniform error responses (ApiError → HTTP status) |
| A | `src/app/api/orders/create/route.ts` | `POST /api/orders/create` — secure checkout, transactional price+stock validation, immutable snapshot (was the `createOrder` callable) |
| A | `src/app/api/orders/cancel/route.ts` | `POST /api/orders/cancel` — customer cancel while Order Placed/Accepted + restock (was `cancelOrder`) |
| A | `src/app/api/orders/status/route.ts` | `POST /api/orders/status` — admin full machine / driver hand-off transitions (was `updateOrderStatus`) |
| A | `src/app/api/orders/assign-driver/route.ts` | `POST /api/orders/assign-driver` — admin driver assignment (was `assignDriver`) |
| A | `src/app/api/drivers/create/route.ts` | `POST /api/drivers/create` — Auth user + `drivers/{uid}` + `driver: true` claim (was `createDriver`) |
| A | `src/app/api/drivers/set-active/route.ts` | `POST /api/drivers/set-active` (was `setDriverActive`) |
| A | `src/app/api/drivers/delete/route.ts` | `POST /api/drivers/delete` (was `deleteDriver`) |
| A | `src/lib/api.ts` | Client helper `callTrustedApi` — fetch + Firebase ID token header + friendly errors |
| M | `src/hooks/use-admin-orders.ts` | Status updates + driver assignment now go through the trusted API |
| M | `src/hooks/use-drivers.ts` | Driver create/enable/disable/delete now go through the trusted API |
| M | `src/lib/firebase.ts` | Functions SDK removed (no callables anymore); `callableErrorMessage` retained for API failures |
| M | `package.json` | + `firebase-admin@^13`; version 1.3.0 |
| M | `.env.local.example` | + `FIREBASE_SERVICE_ACCOUNT`, `NEXT_PUBLIC_API_BASE_URL` |

## Customer app

| Status | File | What changed |
| --- | --- | --- |
| A | `src/lib/api.ts` | Trusted-API client: `EXPO_PUBLIC_API_BASE_URL` + Firebase ID token + `ApiRequestError` with human-friendly messages |
| M | `src/lib/orders.ts` | `placeOrder` / `cancelMyOrder` now call `/api/orders/*` instead of callables |
| M | `src/lib/driver.ts` | `setDriverOrderStatus` now calls `/api/orders/status` |
| M | `src/screens/ConfigErrorScreen.tsx` | Setup hint includes the new API URL env var |
| M | `.env.example` | + `EXPO_PUBLIC_API_BASE_URL` |
| M | `app.json`, `package.json` | version 1.3.0 |

## Backend & docs

| Status | File | What changed |
| --- | --- | --- |
| M | `firebase/README.md` | Rewritten deployment guide: **Option A (Spark, recommended)** = Vercel + service-account key, step-by-step; Option B (Blaze) = optional Cloud Functions port |
| M | `README.md` | Architecture table, quick start, deploy + security sections updated for the Vercel backend; v1.3.0 changelog |
| M | `TESTING.md` | Prerequisites + security spot-checks updated for the API backend |
| M | `firebase/firestore.rules`, `firestore.indexes.json`, `storage.rules` | **Unchanged** — already deny-by-default and Spark-compatible (Admin SDK bypasses rules; `admins/{email}` doc path needs no custom claims) |
| A | `CHANGES-v1.3.0.md` | This document |

## Deployment status (as of this document)

| Component | Status |
| --- | --- |
| Source (GitHub `bhhookh-box-mvp`) | ✅ pushed, tag `v1.3.0` |
| TypeScript / builds (app · admin + API) | ✅ all exit 0 |
| Firestore rules + indexes + Storage | ⬜ `firebase deploy --only firestore:rules,firestore:indexes,storage` (Spark OK) |
| Trusted backend | ⬜ Vercel import + env vars (free) — `firebase/README.md` |
| Customer APK v1.3.0 | ⬜ `eas build -p android --profile preview` |
