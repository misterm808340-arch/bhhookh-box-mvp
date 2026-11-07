# BHHOOKH BOX — Firebase Backend

One Firebase project powers **both** applications:

| App | Firebase usage |
| --- | --- |
| `customer-android` (Expo / React Native) | Writes new orders to the `orders` collection (no auth needed — allowed by rules) |
| `admin-dashboard` (React / Next.js) | Firebase Auth sign-in + real-time `onSnapshot` reads + status updates |

```
┌────────────────────┐        creates orders        ┌─────────────────────┐
│  Customer Android  │  ──────────────────────────► │  Firestore          │
│  (Expo RN app)     │                              │  collection: orders │
└────────────────────┘                              └──────────┬──────────┘
                                                    │ onSnapshot (real time)
                                                    ▼
┌────────────────────┐   reads + status updates    ┌─────────────────────┐
│  Admin Web Dashboard│ ◄───────────────────────── │  Firebase Auth      │
│  (React / Next.js) │                             │  (email+password)   │
└────────────────────┘                             └─────────────────────┘
```

## Files

| File | Purpose |
| --- | --- |
| `firestore.rules` | Security rules: customers create orders, only whitelisted admins read/update |
| `firestore.indexes.json` | Empty — the dashboard query (single orderBy) needs no composite index |
| `firebase.json` | Deploys the rules **and** hosts the admin dashboard static build |

## Data model

### `orders/{orderId}` (document id == human-readable order id, e.g. `BHB-M3XK9A2-7QD`)

```json
{
  "orderId": "BHB-M3XK9A2-7QD",
  "customer": {
    "name": "Customer Name",
    "phone": "9876543210",
    "address": "Complete delivery address"
  },
  "items": [
    { "name": "Veg Burger", "price": 99, "quantity": 2 }
  ],
  "subtotal": 198,
  "deliveryFee": 20,
  "total": 218,
  "paymentMethod": "COD",
  "status": "Pending",
  "createdAt": "<Firestore server timestamp>",
  "updatedAt": "<set by admin status changes>"
}
```

### `admins/{email}`

- **Document ID = the admin's full email address, exactly** (case-sensitive).
- Content: `{ "role": "admin", "createdAt": <any timestamp> }`.
- Created manually in Firebase Console → Firestore. Never written by any app.

## Deploy the security rules

**Option A — Firebase Console (no CLI):**
1. Firebase Console → Firestore Database → Rules.
2. Paste the full contents of `firestore.rules` → Publish.

**Option B — Firebase CLI:**

```bash
cd firebase
npm install -g firebase-tools   # once
firebase login
firebase use --add              # select your BHHOOKH BOX project
firebase deploy --only firestore:rules
```

## Status workflow enforced by rules

```
Pending ──► Accepted ──► Preparing ──► Out for Delivery ──► Delivered
   │
   └──► Rejected
```

The rules reject any other transition, so the workflow cannot be bypassed
even if someone calls Firestore directly. Orders cannot be edited after
creation (only the status changes above are allowed).

## Production hardening checklist

- [ ] Re-validate order item names/prices server-side (Cloud Functions) against a real menu collection — rules cannot iterate list elements.
- [ ] Add Firebase App Check for both apps.
- [ ] Move the `admins` check to custom claims (`request.auth.token.admin == true`) set by a Cloud Function.
- [ ] Add rate limiting / duplicate-order protection.
- [ ] Replace COD with a real payment gateway (e.g. Razorpay) verified via webhooks.
