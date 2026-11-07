# BHHOOKH BOX — Customer App (Android)

Premium food delivery app built with **React Native + Expo (TypeScript)** and **Firebase Firestore**. All food photography is bundled locally, so browsing works offline; placing an order writes a real document to the shared `orders` Firestore collection that the admin dashboard watches in real time.

## Features

- **Home**: brand header, live search, category chips (Burgers, Rolls, South Indian, Biryani, Rice & Bowls, Beverages), "Popular near you" carousel, all-items list with veg/non-veg marks, ratings and prep times.
- **Menu**: Veg Burger ₹99 · Paneer Roll ₹129 · Masala Dosa ₹119 · Chicken Biryani ₹199 · Chole Rice ₹109 · Cold Coffee ₹89.
- **Cart**: add / remove, per-item quantity steppers, automatic subtotal + ₹20 delivery fee + final payable amount, floating cart bar.
- **Checkout**: full name, 10-digit mobile (`+91` prefix, digit-only input), complete address — all validated inline to match the Firestore rules. Payment: **Cash on Delivery (testing only)**.
- **Place Order**: generates a unique human-readable order id (`BHB-XXXXXXX-XXX`), writes the order (customer, items, quantities, prices, subtotal, delivery fee, total, `COD`, `Pending`, server timestamp) to Firestore, shows a confirmation screen with the order ID.
- Clear **setup screen** if Firebase env vars are missing — connectivity is never simulated.

## Run it

```bash
npm install
cp .env.example .env    # paste your Firebase web app config values
npx expo start          # scan with Expo Go, or press "a" for an emulator
```

> Use the **same Firebase project** as the admin dashboard so orders appear there instantly.

## Build an APK

```bash
# Cloud build (no Android Studio required)
npm install -g eas-cli
eas build -p android --profile preview      # preview = installable APK

# Local build (requires Android SDK + JDK 17)
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

## Project layout

```
App.tsx                 navigation + config guard
src/
├── screens/            Home, Cart, Checkout, OrderSuccess, ConfigError
├── components/         FoodCard, PopularCard, CartBar, QtyStepper, …
├── context/CartContext # cart state + totals
├── data/menu.ts        sample menu (edit to add dishes — images in assets/foods)
├── lib/firebase.ts     lazy Firestore init (long-polling autodetect for Expo Go)
├── lib/orders.ts       validation, id generation, order write
└── theme.ts            dark-green + lime design tokens
```
