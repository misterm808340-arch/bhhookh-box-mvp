# BHHOOKH BOX — Firebase Backend Guide

One Firebase project (`bhhookh-box`) powers **both** applications and the
trusted backend:

| Surface | Firebase usage |
| --- | --- |
| `customer-android` (Expo / React Native) | Email/password auth · live menu · **`POST /api/orders/create` (trusted backend)** · own-order tracking · saved addresses |
| `admin-dashboard` (Next.js on Vercel) | Admin sign-in · real-time order feed · menu/driver management · reports · **hosts the trusted backend API (`/api/*`)** |
| `admin-dashboard/src/app/api/` + `src/lib/backend/` | **The TRUSTED BACKEND: secure order creation, price/discount/stock validation, role authorisation, driver management** (Firebase Admin SDK, server-side only) |
| Firestore + Storage rules | Deny-by-default access for every collection |

```
┌──────────────┐  items+address only   ┌──────────────────────┐
│   Customer   │ ────────────────────> │  /api/orders/create  │
│   Android    │ <──────────────────── │  validates price,    │
└──────────────┘  verified totals      │  stock, discount …   │
      │  onSnapshot                    └──────────┬───────────┘
      ▼  (own orders only)                       │ Admin SDK write
┌──────────────┐  status + driver      ┌──────────────────────┐
│    Admin     │ ────────────────────> │  Firestore           │
│  Dashboard   │ <──────────────────── │  orders/products/    │
└──────────────┘      /api/* calls      │  users/drivers/…     │
                                        └──────────▲───────────┘
┌──────────────┐   GPS + status                   │
│    Driver    │ ─────────────────────────────────┘
│ (same app!)  │  drivers/{uid} → orders/{id}.driverLocation
└──────────────┘
```

> **Spark plan? No problem.** Firebase's free Spark plan cannot deploy Cloud
> Functions — so the trusted backend is an authenticated HTTP API bundled with
> the admin dashboard and hosted **free on Vercel**. The old Cloud Functions
> port still ships in `firebase/functions/` for projects on the Blaze plan.

## Files

| File | Purpose |
| --- | --- |
| `firestore.rules` | Deny-by-default security rules for every collection |
| `firestore.indexes.json` | Composite indexes for the customer/driver order queries |
| `storage.rules` | Product image upload rules (admin write, public read) |
| `firebase.json` | Deploys rules, indexes and storage (functions = optional Blaze path) |
| `../admin-dashboard/src/app/api/` | **The trusted backend — 7 authenticated API routes** |
| `../admin-dashboard/src/lib/backend/` | Backend core: pricing engine, state machine, role checks, Admin SDK |
| `functions/` | OPTIONAL Cloud Functions v2 port of the same backend (Blaze plan only) |

## Collections

| Collection | Written by | Read by |
| --- | --- | --- |
| `users/{uid}` | owner (validated) | owner, admins |
| `addresses/{docId}` | owner | owner only |
| `orders/{orderId}` | **trusted backend only** (`POST /api/orders/create`) | customer (own), driver (assigned), admins |
| `categories/{id}` | admins | everyone (menu) |
| `products/{id}` | admins | everyone (menu) |
| `admins/{email}` | Firebase Console only | own doc only |
| `drivers/{uid}` | **driver API routes only** | admins, the driver themself |
| `settings/app` | admins | everyone (delivery fee) |

### `orders/{orderId}` (document id == human-readable id, e.g. `BHB-M3XK9A2-7QD`)

```json
{
  "orderId": "BHB-M3XK9A2-7QD",
  "uid": "<customer Auth uid>",
  "customer": { "name": "…", "email": "…", "phone": "9876543210" },
  "address": { "label": "Home", "receiverName": "…", "phone": "…", "line": "…" },
  "items": [
    {
      "productId": "burger1",
      "name": "Veg Burger",
      "unitPrice": 99, "mrp": 129, "discountPercent": 23,
      "quantity": 2, "lineTotal": 198, "imageUrl": "https://…"
    }
  ],
  "subtotal": 198, "deliveryFee": 20, "total": 218,
  "paymentMethod": "COD",
  "status": "Order Placed",
  "statusHistory": [ { "status": "Order Placed", "at": "<server ts>" } ],
  "driverId": null, "driverName": null,
  "driverLocation": { "lat": 12.97, "lng": 77.59, "updatedAt": "<server ts>" },
  "cancelReason": "",
  "createdAt": "<server ts>", "updatedAt": "<server ts>"
}
```

**Immutable snapshots (§7):** `items[].unitPrice / mrp / discountPercent` are
copied from the product AT ORDER TIME by the trusted backend. Later menu edits
never change historical receipts, and reports always reflect what the
customer actually paid.

## One-time Firebase project setup

1. **Create the project** at <https://console.firebase.google.com> (e.g. `bhhookh-box`).
2. **Register a Web app** (Project settings ⚙️ → General → Your apps → `</>`) and copy the
   `firebaseConfig` values into:
   - `customer-android/.env` (see `.env.example`), and
   - `admin-dashboard/.env.local` (see `.env.local.example`).
   Both MUST use the same project.
3. **Authentication → Sign-in method → enable Email/Password.**
4. **Firestore Database → Create database** (Production mode; e.g. `asia-south1`).
5. **Storage → Get started** (needed for product image uploads).
6. **Create the admin login**: Authentication → Users → **Add user**
   (e.g. `owner@bhhookhbox.in`).
7. **Whitelist the admin**: Firestore → collection `admins` → document ID
   **exactly the login email** (case-sensitive) → field `role` (string) = `admin`.
   > The dashboard checks this document (or an `admin: true` custom claim) —
   > client state is never trusted; every API route re-verifies server-side.
8. **(Optional) delivery fee**: Firestore → collection `settings` → doc `app`
   → `deliveryFee` (number) — default ₹20 when absent.

## Deploy rules, indexes and storage (REQUIRED — works on Spark)

```bash
npm install -g firebase-tools   # once
cd firebase
firebase login
firebase use --add              # select the BHHOOKH BOX project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Console alternative: paste `firestore.rules` into Firestore → Rules → Publish,
and create the two composite indexes from `firestore.indexes.json`
(`orders: uid+createdAt DESC`, `orders: driverId+createdAt DESC`).

## Deploy the trusted backend (REQUIRED — FREE, works on the Spark plan)

The trusted backend ships inside the admin dashboard as authenticated Next.js
API routes using the Firebase Admin SDK. It needs Node.js hosting — **Vercel's
free Hobby plan is perfect** (the Spark plan cannot run Cloud Functions, so
the backend lives just outside Firebase while using the same Firestore):

### Step 1 — Create the service account key (one time)

1. Firebase Console → ⚙️ **Project settings → Service accounts**.
2. Click **Generate new private key** → download the JSON file.
3. Keep it SECRET — it is the server's master key. Never commit it, never put
   it in either app, never share it. (You can revoke and re-generate anytime.)

### Step 2 — Deploy the admin dashboard + API to Vercel

1. Sign up at <https://vercel.com> (free) with your GitHub account.
2. **Add New → Project → Import** the `bhhookh-box-mvp` repository.
3. Under **Root Directory** choose `admin-dashboard`.
4. Add the environment variables (Project → Settings → Environment Variables):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | your web config API key |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `bhhookh-box.firebaseapp.com` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `bhhookh-box` |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `bhhookh-box.firebasestorage.app` |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | your sender id |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | your app id |
   | `FIREBASE_SERVICE_ACCOUNT` | **the entire service-account JSON on one line** |

5. Click **Deploy**. You get a URL like `https://bhhookh-box.vercel.app`.
6. Verify: open the URL → sign in as admin → Menu → **Seed 9 categories**.
   If seeding works, the backend is live and authorised.

### Step 3 — Point the customer app at the backend

Put the Vercel URL into `customer-android/.env`:

```
EXPO_PUBLIC_API_BASE_URL=https://bhhookh-box.vercel.app
```

…then rebuild/restart the app. Order placement, cancellation, status
updates, driver assignment and driver management all flow through this URL.

### Step 4 — (Optional) update the GitHub Pages UI mirror

The static Pages build cannot host the API itself; point it at the Vercel
backend when you rebuild it:

```bash
cd admin-dashboard
NEXT_PUBLIC_API_BASE_URL=https://bhhookh-box.vercel.app npm run build:pages
# commit/push the out/ build to the gh-pages branch of bhhookh-box-admin
```

### Deployed API routes

| Route | Who | What |
| --- | --- | --- |
| `POST /api/orders/create` | any signed-in user | Validates items/stock/offers server-side, computes totals, writes the immutable order |
| `POST /api/orders/cancel` | customer (own order) | Allowed while `Order Placed`/`Accepted`; restocks items |
| `POST /api/orders/status` | admin or assigned driver | Enforces the status state machine + appends `statusHistory` |
| `POST /api/orders/assign-driver` | admin | Assigns/unassigns a driver to an active order |
| `POST /api/drivers/create` | admin | Creates the Auth account + `drivers/{uid}` + `driver: true` claim |
| `POST /api/drivers/set-active` | admin | Enables/disables a driver |
| `POST /api/drivers/delete` | admin | Deletes the Auth user + roster document |

After deploying, open the dashboard → **Menu → Seed 9 categories** to create
Burgers, Pizza, Biryani, Chinese, Rolls, Drinks, Snacks, Desserts, Fruits
(the seed writes categories directly; the dashboard's admin status is gated
by the same server-side whitelist).

## Alternative: Cloud Functions (requires the paid Blaze plan)

`firebase/functions/` contains the SAME backend as Cloud Functions v2
callables. Deploy it **only** if you upgrade the Firebase project to Blaze:

```bash
cd firebase/functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

The apps in this repository use the Vercel HTTP API — deploying the functions
is optional and nothing depends on it.

## Order lifecycle

```
Order Placed ──> Accepted ──> Preparing ──> Out for Delivery ──> Delivered
   │  │              │            │
   │  └─> Rejected  └─ Cancelled └─ Cancelled
   └─> Cancelled (customer, before the kitchen starts)
```

- Statuses move ONLY through the trusted backend (`POST /api/orders/status`;
  admin full machine, driver `Preparing → Out for Delivery → Delivered` on
  their assigned orders).
- Reject/Cancel restocks tracked inventory.
- `driverLocation` is written by the driver's device ONLY while the order is
  `Preparing`/`Out for Delivery` and ONLY on their assigned order (rules
  enforce it); tracking stops automatically on delivery/cancel.

## Security model (§12)

- **Orders can never be created or edited by any client** — `allow create:
  if false`, `allow update` only for the driver's `driverLocation` field on
  their own assigned order. Everything else is Admin SDK (the trusted backend
  API routes on Vercel).
- **Admin authorisation is server-side**: `request.auth.token.admin == true`
  OR a document in `admins/{email}` matching the Auth email. Every API route
  re-checks with `requireAdmin` — the dashboard UI being visible proves
  nothing to an attacker.
- **Drivers**: claim `driver: true` + active `drivers/{uid}` document, both
  created by admin-only API routes. Drivers list ONLY orders assigned to them
  (the query is constrained to `driverId == auth.uid`).
- **Customers** read/write ONLY their own `users/{uid}` and `addresses`,
  read ONLY their own orders.
- **No service-account keys exist in any client or in the repository.**
  The Admin SDK runs exclusively on the server — `FIREBASE_SERVICE_ACCOUNT`
  lives only in the Vercel project's environment variables.

## Production hardening checklist

- [ ] Enable **Firebase App Check** for both apps.
- [ ] Set a spend limit / budget alert (Vercel usage page + Firebase).
- [ ] Replace COD with a payment gateway verified via webhooks (Razorpay/UPI).
- [ ] Add API rate limiting (per-uid throttle in the backend core).
- [ ] Rotate the admin password periodically; consider 2FA via Google sign-in.
- [ ] When revenue justifies it: move the backend to Cloud Functions (Blaze)
      or upgrade Vercel to Pro — both drop-in paths are documented here.
