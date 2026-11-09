# BHHOOKH BOX — Test Plan (v1.2.0)

Every test below was designed to run against the REAL Firebase project — no
emulator required, no mock data. Work through it top-to-bottom after deploying
the backend (`firebase/README.md`).

## 0. Prerequisites

- [ ] Firestore rules, indexes and Storage rules deployed.
- [ ] Cloud Functions deployed (`firebase deploy --only functions`) — the
      apps are NOT fully functional without them.
- [ ] Admin user created (Auth + `admins/{email}` document with `role: "admin"`).
- [ ] Dashboard → **Menu → Seed 9 categories** clicked; ≥1 product per test
      category exists with images and stock (leave one product with
      `stock: 1` and one `mrp > price` for the discount/stock checks).
- [ ] `settings/app.deliveryFee` set (or accept the ₹20 default).
- [ ] Customer app running (`npx expo start`) on a real Android device with
      internet + GPS.

## 1. Customer authentication (§2)

| # | Test | Expected |
| --- | --- | --- |
| 1.1 | Register with name + email + password + confirm mismatch | Inline "Passwords do not match" error |
| 1.2 | Register valid | Success → **Verify Email** screen; verification mail arrives |
| 1.3 | Try to login before verifying | Blocked on the Verify Email screen with a **Resend** button |
| 1.4 | Click the email link → tap **I've verified** | App advances to the menu |
| 1.5 | Logout → login with wrong password | Friendly "Incorrect email or password" message |
| 1.6 | Login correctly, kill the app, reopen | Still logged in (AsyncStorage session) — lands on the menu |
| 1.7 | Forgot password → submit email | Reset email arrives; reset flow works; new password logs in |
| 1.8 | Logout | Returns to Login; session cleared |

## 2. Admin authentication (§2, independent)

| # | Test | Expected |
| --- | --- | --- |
| 2.1 | Open dashboard without signing in | Login form only |
| 2.2 | Sign in with a NON-admin Firebase account | "not an authorized admin" — no data access |
| 2.3 | Sign in with the whitelisted admin | Dashboard loads with live stats |
| 2.4 | Admin email/password does NOT log into the customer app's flow | Customer app treats it as a normal customer login (no admin powers there) |

## 3. Menu & catalogue (§4/§5/§6)

| # | Test | Expected |
| --- | --- | --- |
| 3.1 | Seed 9 categories | Burgers, Pizza, Biryani, Chinese, Rolls, Drinks, Snacks, Desserts, Fruits appear in dashboard + app |
| 3.2 | Create a product with image upload (Storage) | Image visible in the app within seconds (real-time listener) |
| 3.3 | Set MRP 199 / price 149 | App shows ₹149 with ~~₹199~~ and **25% OFF** badge (auto-calculated) |
| 3.4 | Set offer window that ends today | Price reverts to MRP after the window (offer on) |
| 3.5 | Disable a category | Its products vanish from the app menu |
| 3.6 | Mark a product unavailable / stock 0 | App hides it or shows "Out of stock"; Add blocked |
| 3.7 | Edit price in dashboard while app is open | New price appears live in the app without restart |

## 4. Cart & secure checkout (§7)

| # | Test | Expected |
| --- | --- | --- |
| 4.1 | Add / increment / decrement / remove | Subtotal, delivery fee, total always correct |
| 4.2 | Checkout with a saved address | One tap; receiver + phone pre-filled |
| 4.3 | Checkout with manual address | 10-digit phone + ≥10-char address enforced inline |
| 4.4 | Place order | Success screen with the real order id; totals equal the SERVER bill |
| 4.5 | **Stale-price attack**: add item to cart, change its price in the dashboard, then checkout | Order succeeds at the NEW server price — client price ignored (check Firestore `items[].unitPrice`) |
| 4.6 | **Stock attack**: two devices buy a `stock: 1` product | Second order fails with "only 1 left in stock" |
| 4.7 | **Direct-write attack**: from any client, `setDoc(doc(db,'orders','FAKE1'),{ total: 1, … })` | Denied by security rules (`create: if false`) |

## 5. Real-time admin notifications & order management (§10)

| # | Test | Expected |
| --- | --- | --- |
| 5.1 | Place an order while the dashboard is open | Appears in ≤2 s with chime (after Sound On) + NEW badge + banner |
| 5.2 | Order card contents | Customer name, email, phone, full address, items with unit prices, subtotal, delivery, total, COD, date/time |
| 5.3 | Accept → Start Preparing | Status chips update live on both dashboard and app |
| 5.4 | Reject an order (confirmation shown) | App timeline shows Rejected + reason; item restocked |
| 5.5 | Filter chips | Each status filter shows the correct counts |
| 5.6 | Refresh the dashboard | Feed replays instantly from Firestore; no fake chimes for old orders |

## 6. Customer tracking (§8)

| # | Test | Expected |
| --- | --- | --- |
| 6.1 | Open My Orders | Active tab shows live orders; History shows delivered/rejected/cancelled |
| 6.2 | Open tracking for an active order | 7-step timeline; the current step highlighted with timestamp |
| 6.3 | Bill section | Per-item unit price × qty = line total; subtotal + delivery = total; COD marked |
| 6.4 | Customer sees ONLY their orders | Another account's order id in the tracking URL → "Order not found" (rules) |
| 6.5 | Cancel while `Order Placed`/`Accepted` | Works (with confirmation + optional reason); blocked once Preparing |

## 7. Driver module & live GPS (§9)

| # | Test | Expected |
| --- | --- | --- |
| 7.1 | Dashboard → Drivers → Add Driver (name/email/phone/temp password) | Auth account + roster doc created; driver appears as Active |
| 7.2 | Sign into the app with the driver account | Driver console (NOT the customer storefront) |
| 7.3 | Driver sees only assigned orders | Unassigned orders never appear; rules block a `driverId == other` query |
| 7.4 | Admin assigns driver on an Accepted order | Order appears on the driver's phone instantly |
| 7.5 | Driver taps Start Delivery → grant location permission | App shows "Live GPS on" with real coordinates |
| 7.6 | Customer tracking screen | Map shows the driver marker moving as the rider walks/drives (OpenStreetMap) |
| 7.7 | Driver taps Mark Delivered | Timeline completes; **GPS publishing stops** (rules only allow `driverLocation` on Preparing/Out for Delivery) |
| 7.8 | Deny location permission | Explicit warning; no fake coordinates are ever sent |
| 7.9 | Disable a driver | Their console shows "Account paused"; status updates fail server-side |

## 8. Reports (§11)

| # | Test | Expected |
| --- | --- | --- |
| 8.1 | Today's orders/sales after the tests above | Counts match the orders you placed today |
| 8.2 | Reject/cancel a test order | Today's Sales does NOT change; status counters do |
| 8.3 | Search history by id/name/phone + status filter | Correct rows only |

## 9. Build & type-check gates (§15)

```bash
cd customer-android  && npx tsc --noEmit        # must exit 0
cd admin-dashboard   && npm run build           # TS errors now FAIL the build
cd firebase/functions&& npm run build           # must exit 0
```

The admin build previously had `typescript.ignoreBuildErrors` — this was
**removed** in v1.2.0: type errors can no longer be hidden by the build.

## 10. Security rules spot-checks (§12)

Run from any authenticated client (e.g. a scratch page):

| Attempt | Expected result |
| --- | --- |
| Customer lists ALL orders (`collection(db,'orders')`) | Denied — query lacks `uid == auth.uid` constraint |
| Customer reads another user's order by id | Denied (`get` requires `resource.data.uid == auth.uid`) |
| Customer writes `products/`, `admins/`, `drivers/` | Denied (admin-only / CF-only) |
| Driver updates `status` directly via `updateDoc` | Denied — only `driverLocation` on their own assigned order |
| Driver reads `drivers/` list | Denied (admins only; drivers get their own doc) |
| Anyone creates an order without a callable | Denied (`create: if false`) |
