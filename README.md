# BHHOOKH BOX — Food Delivery Startup MVP

A **functional** (not simulated) food-delivery MVP — a simplified Swiggy/Zomato
built as **two apps + one trusted backend** sharing **one Firebase project**
(`bhhookh-box`):

| App | Stack | Role |
| --- | --- | --- |
| `customer-android/` | React Native + Expo (TypeScript, SDK 54) | Email login → live menu → cart → secure checkout → **real-time order tracking with live driver map** |
| `admin-dashboard/` | Next.js 16 + TypeScript + Tailwind + shadcn | Orders (live feed + chime) · Menu & categories · **Drivers** · **Reports** · **hosts the trusted backend API** |
| `firebase/` | Firestore + Storage rules + indexes | Deny-by-default access for every collection |

```
bhhookh-box-mvp/
├── customer-android/        # Expo React Native app (Android)
│   ├── App.tsx              # Auth gate: Login → VerifyEmail → app / driver console
│   └── src/
│       ├── screens/         # Login, Register, ForgotPassword, VerifyEmail,
│       │                    # Home, Cart, Checkout, OrderSuccess,
│       │                    # Profile, MyOrders, OrderTracking (map!),
│       │                    # Addresses, Reorder, DriverHome (GPS)
│       ├── context/         # AuthContext (roles) · CartContext · CatalogContext
│       ├── lib/             # firebase · auth · catalog · orders (trusted API)
│       │                    # addresses · api (backend client) · driver (GPS)
│       └── components/      # FoodCard, CategoryGrid, CartBar, …
├── admin-dashboard/         # Next.js 16 App Router + Tailwind + shadcn
│   ├── src/app/api/         # ★ TRUSTED BACKEND: 7 authenticated API routes
│   │                        #   (orders create/cancel/status/assign-driver,
│   │                        #    drivers create/set-active/delete) — Firebase
│   │                        #    Admin SDK, service account in env only
│   └── src/components/admin/
│       ├── dashboard.tsx    # Tabs: Orders · Menu · Drivers · Reports
│       ├── orders-board.tsx # Live feed, filters, status workflow, driver assign
│       ├── drivers-manager.tsx  # Create/enable/disable driver accounts
│       └── reports.tsx      # Today's sales, status counts, history (§11)
└── firebase/
    ├── firestore.rules      # Deny-by-default rules for every collection
    ├── firestore.indexes.json
    ├── storage.rules        # Product images (admin write, public read)
    ├── functions/           # Cloud Functions v2 — the trusted backend
    └── README.md            # ← FULL backend/deployment guide
```

## What is new in v1.3.0 (vs v1.2.0)

- **Spark-plan compatible backend** — Firebase's free Spark plan cannot run
  Cloud Functions, so the trusted backend was ported to **7 authenticated
  Next.js API routes** inside the admin dashboard (Firebase Admin SDK),
  hosted free on Vercel. Identical security guarantees: server-verified
  prices, immutable snapshots, role re-checks, state machine.
- The customer app and the dashboard now call the backend over HTTPS with
  Firebase ID tokens (`EXPO_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL`).
- `firebase/functions/` remains as an optional Blaze-plan port — nothing
  depends on it.

## What is new in v1.2.0 (vs v1.1.0)

- **Email/password auth end-to-end** — register (name/email/password/confirm),
  email verification, login, forgot password, persistent session, logout.
  The old phone-OTP flow is fully removed.
- **Customer dashboard** — My Profile, My Orders (Active/History), Saved
  Addresses, Reorder, Logout.
- **9 product categories** (Burgers, Pizza, Biryani, Chinese, Rolls, Drinks,
  Snacks, Desserts, Fruits) — admin CRUD + enable/disable + one-tap seeding.
- **Offers** — admin sets MRP, sale price (auto % OFF), offer start/end dates
  and on/off; the effective price reverts outside the window.
- **Secure checkout** — the app sends only product ids + quantities + address;
  the `createOrder` Cloud Function validates price/discount/stock server-side
  and writes an **immutable price snapshot** into every order.
- **Real-time tracking** — 7-status timeline (Order Placed / Accepted /
  Rejected / Preparing / Out for Delivery / Delivered / Cancelled), full bill,
  status timestamps, and a **live driver map** (OpenStreetMap in-app, no API key).
- **Driver module** — admin creates driver accounts; drivers sign into the
  SAME app and get a delivery console; **real GPS** via expo-location streams
  to the customer's map; tracking stops after delivery.
- **Admin reports** — today's orders/sales, per-status counts, searchable
  history. Rejected/Cancelled orders never count as sales.

## Quick start

### 1. Firebase project (one project for both apps)

Follow **`firebase/README.md` § One-time setup** — register the web app,
enable Email/Password auth, create Firestore + Storage, create your admin
user and the `admins/{email}` whitelist document.

### 2. Deploy backend (works on the FREE Spark plan)

```bash
cd firebase
firebase login && firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,storage
```

The trusted backend (order pricing/validation, driver accounts) ships inside
the admin dashboard and deploys **free on Vercel** — see
**`firebase/README.md` § Deploy the trusted backend** for the 10-minute
click-by-click guide (service account key → Vercel import → env vars).
Cloud Functions are NOT required (Spark cannot run them); an optional Blaze
port lives in `firebase/functions/`.

### 3. Customer app

```bash
cd customer-android
npm install
cp .env.example .env            # paste YOUR Firebase values + the Vercel API URL
npx expo start                  # scan with Expo Go, or press `a`
```

### 4. Admin dashboard

```bash
cd admin-dashboard
npm install
cp .env.local.example .env.local # paste the SAME Firebase values
npm run dev                      # http://localhost:3000
```

Sign in with the admin email → **Menu → Seed 9 categories** → add products →
place a test order from the app → accept it → assign a driver.

## Build the Android APK (EAS)

```bash
npm install -g eas-cli
cd customer-android
eas login                       # free Expo account
eas build -p android --profile preview    # installable APK
```

Local build (Android SDK + JDK 17): see `customer-android/BUILD-RELEASE.md`
(release keystore and signing properties are intentionally NOT committed).

## Deploy the admin dashboard + trusted backend (Vercel — recommended)

The dashboard IS the backend: one free Vercel deployment serves both the UI
and the authenticated `/api/*` ordering endpoints.

```bash
# 1. Vercel → Add New → Project → Import bhhookh-box-mvp
# 2. Root Directory: admin-dashboard
# 3. Env vars: NEXT_PUBLIC_FIREBASE_* (6) + FIREBASE_SERVICE_ACCOUNT
# 4. Deploy
```

Full click-by-click guide: **`firebase/README.md` § Deploy the trusted
backend** (free, works on the Spark plan).

**GitHub Pages UI mirror (optional):** the static build cannot host the API,
so point it at the Vercel backend when rebuilding:

```bash
cd admin-dashboard
NEXT_PUBLIC_API_BASE_URL=https://<your-app>.vercel.app npm run build:pages
# commit/push the out/ build to the gh-pages branch of bhhookh-box-admin
```

## End-to-end test (the full loop)

1. Register a customer in the app → click the verification email → login.
2. Menu loads from Firestore (categories + products you created as admin).
3. Add items to the cart → checkout → pick a saved address → **Place Order**.
4. The dashboard chimes; the order appears with customer, items, bill, COD.
5. **Accept** → **Start Preparing** → **Drivers tab**: create a driver →
   back on the order, pick the driver in the dropdown.
6. Sign in as the driver in the app (temporary password) → grant location →
   **Start Delivery** → the customer's tracking screen shows the driver moving
   on the map in real time.
7. Driver taps **Mark Delivered** → timeline completes → the order appears in
   history + Reports (today's sales).
8. Reject/cancel a test order → it restocks, and is excluded from sales.

Full deployment and testing guides: **`firebase/README.md`** and
**`TESTING.md`**.

## Security model

- No password, API secret or service-account key exists in any source file —
  Firebase web configs are public identifiers by design; the service account
  lives ONLY in the server's environment variables. **Access control is
  enforced by Firestore rules + the trusted backend API, never by the client**.
- Orders are created/updated ONLY by the trusted backend (`/api/*`, verified
  with Firebase ID tokens + Admin SDK); customers can never submit a price
  that the backend did not verify.
- Admin = server-side check (custom claim or `admins/{email}` document) on
  every API call and rule evaluation.
- Drivers = `driver: true` claim + active `drivers/{uid}` doc, both created
  by admin-only API routes; they see only their assigned orders.
- GPS is real device location (expo-location). No mock or fake coordinates
  exist anywhere in the codebase.
- **Runs entirely on free tiers**: Firebase Spark + Vercel Hobby. No Cloud
  Functions needed (optional Blaze port included in `firebase/functions/`).
