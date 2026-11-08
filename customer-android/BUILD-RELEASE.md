# Building the BHHOOKH BOX Customer App (Android)

The v1.0.0 artifacts (`BHHOOKH-BOX-customer-v1.0.0.apk` / `.aab`) are attached to the
[GitHub Releases page](https://github.com/misterm808340-arch/bhhookh-box-mvp/releases).
This doc shows exactly how they were produced and how to reproduce them.

## What was built (v1.0.0)

| Field | Value |
| --- | --- |
| Package | `com.bhhookhbox.app` |
| Version | 1.0.0 (versionCode 1) |
| Min Android | 7.0 (API 24) |
| ABIs | `arm64-v8a`, `armeabi-v7a` (covers all modern phones) |
| JS engine | Hermes |
| Stack | Expo SDK 54, React Native 0.81.5, Firebase JS SDK 13 |
| Firebase project | `bhhookh-box` — config read from `EXPO_PUBLIC_FIREBASE_*` at build time |

## 1. Prerequisites

- Node 20+ and npm (or bun)
- JDK 17, Android SDK (compileSdk 36, build-tools installed)
- `customer-android/.env` with the six `EXPO_PUBLIC_FIREBASE_*` values
  (see `.env.example`; the same Firebase project as the admin dashboard)

## 2. Debug build (no signing needed)

```bash
cd customer-android
npm install
npx expo prebuild -p android     # regenerates android/ if you changed native config
cd android
./gradlew assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
```

## 3. Release build (signed APK + AAB)

The signing properties and the release keystore are **intentionally not committed**.
Set them locally (untracked `android/gradle.properties`, `~/.gradle/gradle.properties`,
or CI secret variables):

```properties
BHHOOKH_UPLOAD_STORE_FILE=bhhookh-release.keystore
BHHOOKH_UPLOAD_STORE_PASSWORD=<store password>
BHHOOKH_UPLOAD_KEY_ALIAS=<key alias>
BHHOOKH_UPLOAD_KEY_PASSWORD=<key password>
```

and place the keystore file at `customer-android/android/app/bhhookh-release.keystore`.
`android/app/build.gradle` picks the release signing config up automatically whenever
`BHHOOKH_UPLOAD_STORE_FILE` is present; without it, release builds fall back to the
debug key (fine for testing, NOT for Play Store).

```bash
cd customer-android/android
./gradlew assembleRelease        # → app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease          # → app/build/outputs/bundle/release/app-release.aab
```

## 4. Keystore rules (READ THIS ONCE, REMEMBER FOREVER)

- Never commit `bhhookh-release.keystore` or the four signing properties.
- Every future Play Store update MUST be signed with the same keystore — keep a
  private backup (password manager / encrypted drive), not a public repo.
- `android/app/debug.keystore` (committed) is the standard React Native debug key —
  development only, safe to be public.
