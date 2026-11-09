# BHHOOKH BOX — Firebase Backend Guide

One Firebase project (`bhhookh-box`) powers **both** applications and the
trusted backend:

| Surface | Firebase usage |
| --- | --- |
| `customer-android` (Expo / React Native) | Email/password auth · live menu · **`createOrder` callable** · own-order tracking · saved addresses |
| `admin-dashboard` (Next.js) | Admin sign-in · real-time order feed · menu/driver management · reports · **admin callables** |
| `firebase/functions` (Cloud Functions v2, Node 20) | The TRUSTED BACKEND: secure order creation, price/discount/stock validation, role authorisation, driver management |
| Firestore + Storage rules | Deny-by-default access for every collection |

```
┌──────────────┐  items+address only   ┌──────────────────────┐
│   Customer   │ ────────────────────► │  createOrder (CF v2) │
│   Android    │ ◄──────────────────── │  validates price,    │
└──────────────┘  verified totals      │  stock, discount …   │
      │  onSnapshot                    └──────────┬───────────┘
      ▼  (own orders only)                       │ Admin SDK write
┌──────────────┐  status + driver      ┌──────────────────────┐
│    Admin     │ ────────────────────► │  Firestore           │
│  Dashboard   │ ◄──────────────────── │  orders/products/    │
└──────────────┘      callables        │  users/drivers/…     │
                                       └──────────▲───────────┘
┌──────────────┐   GPS + status                  │
│    Driver    │ ────────────────────────────────┘
│ (same app!)  │  drivers/{uid} → orders/{id}.driverLocation
└──────────────┘
```

## Files

| File | Purpose |
| --- | --- |
| `firestore.rules` | Deny-by-default security rules for every collection |
| `firestore.indexes.json` | Composite indexes for the customer/driver order queries |
| `storage.rules` | Product image upload rules (admin write, public read) |
| `firebase.json` | Deploys rules, indexes, storage, functions and hosting |
| `functions/src/index.ts` | All callable entry points |
| `functions/src/common.ts` | Authorisation helpers, state machine, pricing engine |

## Collections

| Collection | Written by | Read by |
| --- | --- | --- |
| `users/{uid}` | owner (validated) | owner, admins |
| `addresses/{docId}` | owner | owner only |
| `orders/{orderId}` | **`createOrder` CF only** | customer (own), driver (assigned), admins |
| `categories/{id}` | admins | everyone (menu) |
| `products/{id}` | admins | everyone (menu) |
| `admins/{email}` | Firebase Console only | own doc only |
| `drivers/{uid}` | **driver CFs only** | admins, the driver themself |
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
copied from the product AT ORDER TIME by the Cloud Function. Later menu edits
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
   > client state is never trusted; every callable re-verifies server-side.
8. **(Optional) delivery fee**: Firestore → collection `settings` → doc `app`
   → `deliveryFee` (number) — default ₹20 when absent.

## Deploy rules, indexes and storage

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

## Deploy the Cloud Functions (REQUIRED)

The callable functions are the trusted backend — **the apps do not work fully
without them** (order creation, status updates, driver management all go
through them). Cloud Functions v2 requires the **Blaze (pay-as-you-go) plan**;
the MVP's traffic stays comfortably inside the free allowance.

```bash
cd firebase/functions
npm install
npm run build                       # type-checks + emits lib/
cd ..
firebase deploy --only functions
```

Deployed callables (region `us-central1`):

| Callable | Who | What |
| --- | --- | --- |
| `createOrder` | any signed-in user | Validates items/stock/offers server-side, computes totals, writes the immutable order |
| `cancelOrder` | customer (own order) | Allowed while `Order Placed`/`Accepted`; restocks items |
| `updateOrderStatus` | admin or assigned driver | Enforces the status state machine + appends `statusHistory` |
| `assignDriver` | admin | Assigns/unassigns a driver to an active order |
| `createDriver` | admin | Creates the Auth account + `drivers/{uid}` + `driver: true` claim |
| `setDriverActive` | admin | Enables/disables a driver |
| `deleteDriver` | admin | Deletes the Auth user + roster document |
| `seedCategories` | admin | One-tap seed of the 9 required categories (idempotent) |

After deploying, open the dashboard → **Menu → Seed 9 categories** to create
Burgers, Pizza, Biryani, Chinese, Rolls, Drinks, Snacks, Desserts, Fruits.

## Order lifecycle

```
Order Placed ──► Accepted ──► Preparing ──► Out for Delivery ──► Delivered
   │  │              │            │
   │  └─► Rejected  └─ Cancelled └─ Cancelled
   └─► Cancelled (customer, before the kitchen starts)
```

- Statuses move ONLY through `updateOrderStatus` (admin full machine, driver
  `Preparing → Out for Delivery → Delivered` on their assigned orders).
- Reject/Cancel restocks tracked inventory.
- `driverLocation` is written by the driver's device ONLY while the order is
  `Preparing`/`Out for Delivery` and ONLY on their assigned order (rules +
  callable enforce it); tracking stops automatically on delivery/cancel.

## Security model (§12)

- **Orders can never be created or edited by any client** — `allow create:
  if false`, `allow update` only for the driver's `driverLocation` field on
  their own assigned order. Everything else is Admin-SDK (Cloud Functions).
- **Admin authorisation is server-side**: `request.auth.token.admin == true`
  OR a document in `admins/{email}` matching the Auth email. Every callable
  re-checks with `requireAdmin` — the dashboard UI being visible proves
  nothing to an attacker.
- **Drivers**: claim `driver: true` + active `drivers/{uid}` document, both
  created by admin-only callables. Drivers list ONLY orders assigned to them
  (the query is constrained to `driverId == auth.uid`).
- **Customers** read/write ONLY their own `users/{uid}` and `addresses`,
  read ONLY their own orders.
- **No service-account keys exist in any client or in the repository.**
  The Admin SDK runs exclusively inside Cloud Functions.

## Production hardening checklist

- [ ] Enable **Firebase App Check** for both apps.
- [ ] Set a budget alert on the Blaze plan (Cloud Functions invocations).
- [ ] Replace COD with a payment gateway verified via webhooks (Razorpay/UPI).
- [ ] Add Cloud Functions rate limiting (e.g. App Check + per-uid throttle).
- [ ] Rotate the admin password periodically; consider 2FA via Google sign-in.
