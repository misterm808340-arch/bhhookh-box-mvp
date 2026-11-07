# BHHOOKH BOX — Food Delivery Startup MVP

A **functional** (not simulated) food-delivery MVP like a simplified Swiggy/Zomato, built as two applications sharing **one Firebase project and one Firestore database**:

| App | Stack | Role |
| --- | --- | --- |
| `customer-android/` | React Native + Expo (TypeScript) | Browse menu → cart → checkout → **real order written to Firestore** |
| `admin-dashboard/` | React (Next.js 16) + Firebase Auth + Firestore | Login → **real-time order feed via `onSnapshot`** → accept/reject → move through status workflow |
| `firebase/` | Security rules + hosting config | Protects the data; hosts the dashboard |

```
bhhookh-box-mvp/
├── customer-android/       # Expo React Native app (Android)
│   ├── App.tsx
│   ├── src/
│   │   ├── components/     # FoodCard, PopularCard, QtyStepper, CartBar…
│   │   ├── screens/        # Home, Cart, Checkout, OrderSuccess, ConfigError
│   │   ├── context/        # CartContext (add/increment/decrement/remove)
│   │   ├── data/menu.ts    # 6 sample items (Veg Burger ₹99 … Cold Coffee ₹89)
│   │   ├── lib/            # firebase.ts + orders.ts (validation, order write)
│   │   └── theme.ts
│   └── assets/             # App icon, splash, 6 food photos (bundled in APK)
├── admin-dashboard/        # React (Next.js 16 App Router, TypeScript) + Tailwind + shadcn
│   ├── src/app/page.tsx    # Single console page: login → dashboard
│   ├── src/components/admin/
│   ├── src/hooks/          # use-admin-auth, use-admin-orders (onSnapshot)
│   ├── src/lib/            # firebase.ts, orders.ts, sound.ts (chime)
│   └── .env.local.example
└── firebase/
    ├── firestore.rules     # Customers create orders; admins read/update only
    ├── firestore.indexes.json
    ├── firebase.json
    └── README.md           # Backend/data-model deep dive
```

---

## 1. Create the Firebase project (one project for BOTH apps)

1. Go to <https://console.firebase.google.com> → **Add project** → name it (e.g. `bhhookh-box`) → continue (Analytics optional).
2. **Register a Web app**: Project settings (⚙️) → General → *Your apps* → **</>** (Web) → nickname `bhhookh-box-web` → Register. Firebase shows a `firebaseConfig` object — copy these 6 values, you will paste them into **both apps**:

   ```
   apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
   ```

   > You do **not** need an Android app registration or `google-services.json` — the customer app uses the Firebase JS SDK.

3. **Create the Firestore database**: Build → Firestore Database → Create database → **Production mode** → location `asia-south1` (Mumbai) or the closest to you.
4. **Enable sign-in**: Build → Authentication → Get started → **Email/Password** → Enable → Save.
5. **Create your admin account**: Authentication → Users → **Add user** →
   - Email: `owner@bhhookhbox.in` (use lowercase — it matters)
   - Password: a strong password (this is the dashboard login; it lives only in Firebase, never in any source code)
6. **Whitelist the admin**: Firestore → Start collection → Collection ID `admins` →
   - Document ID: **exactly the email you created above** (e.g. `owner@bhhookhbox.in`)
   - Field: `role` (string) = `admin` → Save.

## 2. Install and deploy the security rules

The rules make the whole flow secure **by default**:

- **Anyone** can `create` an `orders` document — but only if it is perfectly shaped (valid 10-digit phone, `total == subtotal + deliveryFee`, status starts as `Pending`, etc.).
- **Only whitelisted admins** can read orders or change status, and status changes are locked to the workflow `Pending → Accepted → Preparing → Out for Delivery → Delivered` (+ `Pending → Rejected`).
- The `admins` collection can never be listed or written from any client.

Console method (fastest): Firestore → Rules → paste all of `firebase/firestore.rules` → **Publish**.

CLI method:

```bash
npm install -g firebase-tools
cd firebase
firebase login
firebase use --add          # pick your project
firebase deploy --only firestore:rules
```

## 3. Run the customer Android app

```bash
cd customer-android
npm install                       # or: bun install
cp .env.example .env              # then paste YOUR Firebase values into .env
npx expo start
```

- Scan the QR code with the **Expo Go** app (Play Store), or press `a` for an Android emulator.
- The app shows a clear setup screen instead of failing silently if `.env` is missing.
- Menu, search, categories, cart and checkout work immediately; placing an order writes to **your** Firestore (check Firestore Database → `orders` after your first order).

## 4. Run the admin web dashboard

```bash
cd admin-dashboard
npm install                       # or: bun install
cp .env.local.example .env.local  # paste the SAME Firebase values into .env.local
npm run dev                       # http://localhost:3000
```

- Sign in with the admin email + password from step 1.
- Orders placed by the Android app appear **within ~1 second, in real time** — highlighted with a lime ring, a NEW badge, an alert banner, and (after you click **Sound On**) an audible chime.
- Use **Accept / Reject** on Pending orders, then walk orders through **Start Preparing → Out for Delivery → Mark Delivered**. Every click is validated by Firestore rules and saved instantly.

> Sound: browsers only allow audio after you interact with a page. Click **Sound On** once (it plays a test chime); new orders will then beep automatically.

## 5. End-to-end test (the 10-step workflow)

1. Open the Android app (Expo Go / emulator).
2. Search or browse a category, e.g. **Biryani**.
3. Add **Chicken Biryani ₹199** and a **Cold Coffee ₹89** to the cart.
4. Cart shows subtotal ₹288 + delivery ₹20 = **₹308**.
5. Checkout: enter name, 10-digit mobile, complete address (invalid inputs are rejected inline).
6. Tap **Place Order** — a unique ID like `BHB-M3XK9A2-7QD` is generated.
7. Confirmation screen shows the order ID and `Status: Pending`. The document now exists in Firestore → `orders`.
8. The admin dashboard banner + NEW badge + chime announce it; customer details, items, bill and time are all visible.
9. Click **Accept Order** (or Reject with confirmation).
10. Click through **Start Preparing → Out for Delivery → Mark Delivered** — each status is saved to Firestore and the stat cards update live.

## 6. Build the Android APK

**Option A — EAS Build (cloud, no Android Studio needed):**

```bash
npm install -g eas-cli
cd customer-android
eas login                       # free Expo account
eas build:configure             # already configured via eas.json
eas build -p android --profile preview    # preview profile = installable APK
```

When the build finishes, the link gives you an **APK** you can sideload (`eas.json`: `preview` → `buildType: apk`).

**Option B — local build (requires Android SDK + JDK 17):**

```bash
cd customer-android
npx expo prebuild -p android    # generates the android/ project
cd android
./gradlew assembleRelease       # APK at android/app/build/outputs/apk/release/
```

## 7. Deploy the admin dashboard

**Firebase Hosting (recommended — stays in one ecosystem):**

```bash
cd admin-dashboard
NEXT_STATIC_EXPORT=1 npm run build        # emits static site to out/
cd ../firebase
firebase login && firebase use --add
firebase deploy --only hosting            # serves ../admin-dashboard/out
```

`firebase.json` already points hosting at `../admin-dashboard/out`, uses clean URLs and an SPA rewrite. (On Windows, set `NEXT_STATIC_EXPORT=1` in Git Bash, or set `"output": "export"` in `admin-dashboard/next.config.ts`.) Alternative: import the repo into **Vercel**, add the 6 `NEXT_PUBLIC_FIREBASE_*` env vars, deploy — no code change needed.

## Security model (why this is safe as an MVP)

- No admin password exists in any source file — accounts live in Firebase Auth + the `admins` whitelist.
- Firebase web config values are public identifiers, not secrets; real protection is the deployed `firestore.rules`.
- Customers **cannot** read any order or touch the `admins` collection; they can only create well-formed orders.
- Admins cannot edit prices/items after creation — rules allow only the status workflow fields (`status`, `updatedAt`).
- Before production: re-verify item prices against a real menu on a trusted backend (Cloud Functions), add App Check, and see the checklist in `firebase/README.md`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Customer app shows "Firebase setup required" | `.env` missing/empty — copy `.env.example` and restart `expo start` |
| Dashboard says "Firebase configuration required" | `.env.local` missing — see step 4, then restart `npm run dev` |
| "This account is not an authorized admin" | The `admins` doc ID must equal the login email **exactly** (case-sensitive) |
| `permission-denied` in dashboard | Rules not deployed, or admin not whitelisted (steps 2 & 1.6) |
| Orders don't appear in dashboard | Same Firebase project in both `.env` files? Firestore created? Rules deployed? |
| No chime on new orders | Click **Sound On** once (browser autoplay policy); visual alerts work regardless |
| Expo Go: orders sometimes delayed on flaky Wi-Fi | Expected — `experimentalAutoDetectLongPolling` falls back automatically |
