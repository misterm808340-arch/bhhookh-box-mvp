# BHHOOKH BOX — Admin Dashboard

React (Next.js 16, TypeScript, Tailwind CSS, shadcn/ui) console for the BHHOOKH BOX food delivery MVP. Talks to **Firebase Authentication + Firestore** — the same project as the customer Android app.

## Features

- **Firebase Auth login** (email + password). Admin accounts are created in the Firebase Console and whitelisted in the `admins` Firestore collection — no credentials exist in this codebase.
- **Overview stats**: total orders, pending, accepted, preparing, out for delivery, delivered, rejected, total order value (excludes rejected orders).
- **Real-time orders** via Firestore `onSnapshot` — newest first, no refresh, no polling.
- **Order cards**: unique order ID (click to copy), customer name / phone (tap-to-call) / address, items with quantities, subtotal, delivery fee, total, COD payment, IST timestamps, "time ago".
- **Status workflow** enforced by security rules: Pending → Accepted → Preparing → Out for Delivery → Delivered, plus Reject (with two-step confirm) for pending orders.
- **New-order alerts**: lime banner + pulsing NEW badge + Web-Audio chime (enable once via **Sound On**; browsers require a user gesture before audio).
- **Responsive**: desktop grid + mobile-first stacking.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # paste your Firebase web config values
npm run dev                        # http://localhost:3000
```

## Project layout

```
src/
├── app/page.tsx                    # state machine: setup → loader → login → dashboard
├── app/layout.tsx, globals.css     # brand theme (dark green #0B3D2E + lime #A3E635)
├── components/admin/               # LoginForm, StatCard, OrderCard, OrdersBoard, banner…
├── hooks/use-admin-auth.ts         # onAuthStateChanged + admins whitelist check
├── hooks/use-admin-orders.ts       # onSnapshot feed + stats + status updates
└── lib/                            # firebase.ts (lazy init), orders.ts, sound.ts
```

## Deployment

**Firebase Hosting (static export):**

```bash
NEXT_STATIC_EXPORT=1 npm run build     # outputs to out/  (Windows: use Git Bash or
                                       # set output:"export" in next.config.ts)
# then, from the ../firebase folder:
firebase deploy --only hosting
```

**Vercel:** import the repo, add the six `NEXT_PUBLIC_FIREBASE_*` env vars, deploy.

## First-run checklist

1. Firebase Console → enable **Authentication → Email/Password** and **Firestore**.
2. Create your admin user (Authentication → Users) with a lowercase email.
3. Create the `admins` collection with a document whose **ID is that exact email** (`role: "admin"`).
4. Publish `../firebase/firestore.rules`.
5. Open the dashboard, sign in, place a test order from the Android app.
