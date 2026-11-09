# BHHOOKH BOX — File Change List (v1.0.0 → v1.2.0)

Complete inventory of every file added, modified or removed since the
v1.0.0 APK release, mapped to the upgrade specification.

**Totals:** 191 files changed · 41,131 insertions · 793 deletions
(85 added · 60 modified · 1 deleted · 48 shadcn UI primitives)

| Area | Files | Insertions |
| --- | --- | --- |
| `customer-android/` (Expo app) | 45 | 5,922 |
| `admin-dashboard/` (Next.js console) | 88 (40 feature + 48 UI primitives) | 19,451 |
| `firebase/` (backend) | 10 | 4,024 |
| Root docs | 5 | ~15,700 |

---

## 1. Customer app (`customer-android/`) — 45 files

### Authentication — Email/Password (§2), Phone OTP fully removed
| Status | File | What changed |
| --- | --- | --- |
| A | `src/lib/auth.ts` | Register / login / forgot-password / resend-verification helpers, `users/{uid}` profile read-write |
| A | `src/context/AuthContext.tsx` | Session persistence, role resolution (customer vs driver), profile state |
| A | `src/screens/LoginScreen.tsx` | Email + password sign-in (replaces the old phone screen) |
| A | `src/screens/RegisterScreen.tsx` | Full name / email / password / confirm + sends verification mail |
| A | `src/screens/ForgotPasswordScreen.tsx` | Password reset email flow |
| A | `src/screens/VerifyEmailScreen.tsx` | Verify + resend + "check your inbox" states |
| D | `src/data/menu.ts` | **Deleted** — the hardcoded product catalogue (§6 violation) is gone |
| M | `src/screens/ConfigErrorScreen.tsx` | Explains `.env` setup when Firebase config is missing |

### Customer dashboard (§3)
| Status | File | What changed |
| --- | --- | --- |
| A | `src/screens/ProfileScreen.tsx` | My Profile, edit name/phone, logout |
| A | `src/screens/MyOrdersScreen.tsx` | Active orders + order history (tabbed) |
| A | `src/screens/AddressesScreen.tsx` | Saved addresses CRUD |
| A | `src/screens/ReorderScreen.tsx` | One-tap repeat of a past order |
| A | `src/lib/addresses.ts` | Address validation (10-digit phone pattern) + Firestore access |

### Live menu & categories (§4, §6)
| Status | File | What changed |
| --- | --- | --- |
| A | `src/context/CatalogContext.tsx` | Real-time Firestore listeners for categories + products |
| A | `src/lib/catalog.ts` | Catalog queries, offer-window pricing helpers |
| A | `src/components/CategoryGrid.tsx` | 9-category grid (Burgers, Pizza, Biryani, Chinese, Rolls, Drinks, Snacks, Desserts, Fruits) |
| A | `src/components/FoodImage.tsx` | Storage/remote image loader with fallback |
| M | `src/components/FoodCard.tsx`, `PopularCard.tsx`, `CategoryChips.tsx`, `SearchBar.tsx`, `QtyStepper.tsx`, `CartBar.tsx`, `CartLineRow.tsx`, `PrimaryButton.tsx` | Discount %, offer badges, stock states, dynamic data |

### Cart, checkout & orders (§7, §8)
| Status | File | What changed |
| --- | --- | --- |
| M | `src/lib/orders.ts` | **Callable-based** `createOrder` / `cancelOrder` / `watchMyOrders`; client sends only ids + quantities; order detail parsing |
| M | `src/context/CartContext.tsx` | Cart state, live price re-validation, stock guards |
| M | `src/screens/CartScreen.tsx`, `CheckoutScreen.tsx`, `OrderSuccessScreen.tsx` | Server-verified bill, delivery fee, COD confirmation |
| A | `src/screens/OrderTrackingScreen.tsx` | 7-status timeline, live bill, **live driver map** (OpenStreetMap), auto-stop after delivery |

### Driver module (§9)
| Status | File | What changed |
| --- | --- | --- |
| A | `src/screens/DriverHomeScreen.tsx` | Delivery console for assigned orders only |
| A | `src/lib/driver.ts` | Assigned-order query + **real GPS publisher** (expo-location → `orders.driverLocation`) |

### Infrastructure
| Status | File | What changed |
| --- | --- | --- |
| M | `App.tsx`, `src/navigation.ts`, `src/config.ts`, `src/lib/firebase.ts` | Auth gate (Login → VerifyEmail → app/driver console), env-based config |
| M | `package.json`, `package-lock.json`, `app.json`, `android/app/build.gradle` | New deps (expo-location, react-native-maps), version 1.2.0 |

---

## 2. Admin dashboard (`admin-dashboard/`) — 88 files

### Feature files (40)
| Status | File | What changed |
| --- | --- | --- |
| A | `src/components/admin/categories-manager.tsx` | Category CRUD + enable/disable + one-tap seed of the 9 categories (§4) |
| A | `src/components/admin/products-manager.tsx` | Product CRUD, image upload, MRP/sale price with **auto discount %**, offer start/end + on/off, stock & availability, search/filter (§5) |
| A | `src/components/admin/menu-section.tsx` | Menu tab shell (categories + products) |
| A | `src/components/admin/drivers-manager.tsx` | Create/enable/disable/delete driver accounts (§9) |
| A | `src/components/admin/reports.tsx` | Today's orders/sales, per-status counts, history — rejected/cancelled never count as sales (§11) |
| A | `src/components/admin/delivery-settings.tsx` | Delivery fee card (`settings/app`, server-charged) |
| A | `src/hooks/use-catalog.ts`, `use-drivers.ts` | Live catalog/driver listeners |
| M | `src/hooks/use-admin-auth.ts` | Admin authorisation via `admins/{email}` doc or custom claim (server-side checked on every callable, §12) |
| M | `src/hooks/use-admin-orders.ts` | Real-time feed, filters, driver assignment |
| M | `src/components/admin/orders-board.tsx`, `order-card.tsx` | 7-status workflow, customer info, bill, assign-driver dropdown, cancel reason |
| M | `src/components/admin/dashboard.tsx` | Tabs: Orders · Menu · Drivers · Reports |
| M | `src/lib/firebase.ts` | Env config + Functions SDK + `callableErrorMessage` helper |
| M | `src/lib/orders.ts`, `catalog.ts`, `sound.ts` | Callable wrappers, live queries, new-order chime (§10) |
| M | `next.config.ts`, `package.json`, `src/app/*` | basePath for GitHub Pages, static export |
| M | `login-form.tsx`, `not-authorized.tsx`, `setup-required.tsx`, `brand-loader.tsx`, `stat-card.tsx`, `status-badge.tsx`, `new-order-banner.tsx` | Polished auth/status UI (§14) |
| A | `firebase/` (rules · indexes · storage · README mirror) | Deployment assets bundled with the repo |

### UI primitives (48 files, `src/components/ui/`)
shadcn/ui primitives added for the new managers — table, select, dialog,
alert-dialog, switch, tabs, form, calendar, popover, dropdown-menu,
command, sidebar, chart, etc.

---

## 3. Backend (`firebase/`) — 10 files

| Status | File | What changed |
| --- | --- | --- |
| A | `functions/src/index.ts` | **8 callable Cloud Functions (v2, Node 20):** `createOrder`, `cancelOrder`, `updateOrderStatus`, `assignDriver`, `createDriver`, `setDriverActive`, `deleteDriver`, `seedCategories` (§13) |
| A | `functions/src/common.ts` | Authorisation helpers (`requireAdmin` / driver claims), 7-status state machine, pricing + discount + stock engine |
| A | `functions/package.json`, `tsconfig.json`, `package-lock.json` | Functions workspace |
| M | `firestore.rules` | Deny-by-default for all collections; orders created **only** by Admin SDK; customers read own orders; drivers read assigned orders + write `driverLocation` only (§12) |
| M | `firestore.indexes.json` | Composite indexes: `orders(uid+createdAt DESC)`, `orders(driverId+createdAt DESC)` |
| M | `storage.rules` | Product images: admin write, public read |
| M | `firebase.json` | Rules + indexes + storage + functions + hosting |
| M | `README.md` | Full backend guide: setup, deployment, lifecycle, security model |

---

## 4. Root docs

| Status | File | What changed |
| --- | --- | --- |
| M | `README.md` | v1.2.0 architecture, quick start, EAS build, deploy guides, security model |
| M | `TESTING.md` | End-to-end test script covering all 16 sections |

---

## Deployment status (as of this document)

| Component | Status |
| --- | --- |
| Source code (GitHub `bhhookh-box-mvp`, `bhhookh-box-admin`) | ✅ pushed, tags `v1.0.0` `v1.1.0` `v1.2.0` |
| TypeScript / production builds (app · admin · functions) | ✅ all exit 0 |
| Admin dashboard on GitHub Pages | ✅ deployed (v1.2.0, corrected API key verified live) |
| Firebase Auth (Email/Password) | ✅ enabled, API key validated |
| **Cloud Functions (8 callables)** | ⬜ **requires `firebase deploy --only functions` with your Firebase login** |
| **Firestore rules + indexes** | ⬜ requires `firebase deploy --only firestore:rules,firestore:indexes` |
| Customer APK v1.2.0 | ⬜ requires `eas build` (or local Gradle — see `customer-android/BUILD-RELEASE.md`) |
