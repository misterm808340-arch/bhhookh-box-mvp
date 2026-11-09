/**
 * React-Native-only exports of `firebase/auth`.
 *
 * Metro (the Expo/React Native bundler) resolves `firebase/auth` to the
 * @firebase/auth RN entry (package.json "react-native" field), which DOES
 * export `getReactNativePersistence`. The default TypeScript types for the
 * web entry omit it, so this augmentation adds the missing declaration —
 * matching the real runtime signature (AsyncStorage-backed persistence).
 */
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  interface ReactNativeStorageLike {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }
  export function getReactNativePersistence(storage: ReactNativeStorageLike): Persistence;
}
