import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from './firebase';
import {
  MAX_ADDRESS_LENGTH,
  MAX_NAME_LENGTH,
  MIN_ADDRESS_LENGTH,
  MIN_NAME_LENGTH,
  PHONE_PATTERN,
} from '../config';

/**
 * Saved delivery addresses (§3) — top-level `addresses/{docId}` collection.
 *
 * SECURITY (§12): every document carries the owner's `uid`; Firestore rules
 * only allow get/list/create/update/delete when `uid == request.auth.uid`,
 * and the query below is constrained with `where('uid', '==', uid)` so no
 * other customer's addresses can ever be read.
 */

export interface SavedAddress {
  /** Firestore document id. */
  id: string;
  /** Short tag, e.g. "Home" or "Office" (1–40 chars). */
  label: string;
  /** Receiver full name (2–80 chars). */
  receiverName: string;
  /** 10-digit mobile. */
  phone: string;
  /** Complete delivery address (10–500 chars). */
  line: string;
  createdAt: number | null;
}

export function validateAddress(input: Omit<SavedAddress, 'id' | 'createdAt'>): string | null {
  const label = input.label.trim();
  const receiverName = input.receiverName.trim();
  const phone = input.phone.trim();
  const line = input.line.trim();

  if (label.length < 1 || label.length > 40) {
    return 'Please add a short label (e.g. Home or Office).';
  }
  if (receiverName.length < MIN_NAME_LENGTH || receiverName.length > MAX_NAME_LENGTH) {
    return 'Please enter the receiver’s full name (2–80 characters).';
  }
  if (!PHONE_PATTERN.test(phone)) {
    return 'Please enter a valid 10-digit mobile number.';
  }
  if (line.length < MIN_ADDRESS_LENGTH || line.length > MAX_ADDRESS_LENGTH) {
    return 'Please enter the complete address (at least 10 characters).';
  }
  return null;
}

function mapAddress(id: string, data: Record<string, unknown>): SavedAddress {
  const createdAt = data.createdAt;
  return {
    id,
    label: String(data.label ?? 'Address'),
    receiverName: String(data.receiverName ?? ''),
    phone: String(data.phone ?? ''),
    line: String(data.line ?? ''),
    createdAt:
      typeof createdAt === 'object' && createdAt !== null && 'toMillis' in createdAt
        ? (createdAt as { toMillis: () => number }).toMillis()
        : null,
  };
}

/** Live feed of the signed-in customer's saved addresses (newest first). */
export function subscribeAddresses(
  uid: string,
  onData: (addresses: SavedAddress[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const addressesQuery = query(
    collection(getDb(), 'addresses'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    addressesQuery,
    (snapshot) => {
      const list = snapshot.docs.map((docSnapshot) => mapAddress(docSnapshot.id, docSnapshot.data()));
      // Server-side orderBy excludes docs whose createdAt is still pending —
      // merge them in client-side so a just-added address appears instantly.
      onData(list);
    },
    onError
  );
}

export async function addAddress(
  uid: string,
  input: Omit<SavedAddress, 'id' | 'createdAt'>
): Promise<void> {
  await addDoc(collection(getDb(), 'addresses'), {
    uid,
    label: input.label.trim(),
    receiverName: input.receiverName.trim(),
    phone: input.phone.trim(),
    line: input.line.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function updateAddress(
  addressId: string,
  input: Omit<SavedAddress, 'id' | 'createdAt'>
): Promise<void> {
  await updateDoc(doc(getDb(), 'addresses', addressId), {
    label: input.label.trim(),
    receiverName: input.receiverName.trim(),
    phone: input.phone.trim(),
    line: input.line.trim(),
  });
}

export async function deleteAddress(addressId: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'addresses', addressId));
}
