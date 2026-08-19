import "react-native-get-random-values";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as aesjs from "aes-js";
import PocketBase, { AsyncAuthStore } from "pocketbase";
import Constants from "expo-constants";

const pocketbaseUrl = Constants.expoConfig?.extra?.pocketbaseUrl as string | undefined;
if (!pocketbaseUrl) {
  throw new Error("Missing PocketBase config — set extra.pocketbaseUrl in app.json");
}

const STORAGE_KEY = "pb_auth";

/**
 * PocketBase's auth token needs to persist across app launches, but
 * SecureStore alone caps out at 2048 bytes per key — too small for a
 * session blob. So: AES-encrypt it and store the ciphertext in AsyncStorage,
 * while the (small) AES key lives in the OS keystore via SecureStore. Same
 * pattern Supabase documents for Expo, adapted to PocketBase's AsyncAuthStore.
 */
async function encrypt(value: string): Promise<string> {
  const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(STORAGE_KEY, aesjs.utils.hex.fromBytes(encryptionKey));
  return aesjs.utils.hex.fromBytes(encryptedBytes);
}

async function decrypt(value: string): Promise<string> {
  const encryptionKeyHex = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!encryptionKeyHex) return "";
  const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
  const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
  return aesjs.utils.utf8.fromBytes(decryptedBytes);
}

// The store starts empty ("") — we hydrate it ourselves via initAuthStore()
// below instead of AsyncAuthStore's own `initial` option, so app code can
// deterministically await "has the persisted session loaded yet" rather
// than race the SDK's internal (fire-and-forget) initial-load queue.
const authStore = new AsyncAuthStore({
  save: async (serialized) => {
    const encrypted = await encrypt(serialized);
    await AsyncStorage.setItem(STORAGE_KEY, encrypted);
  },
  clear: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  },
});

export const pb = new PocketBase(pocketbaseUrl, authStore);

/** Loads any persisted session into pb.authStore. Call once at app startup, before trusting authStore state. */
export async function initAuthStore(): Promise<void> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return;
  try {
    const decrypted = await decrypt(stored);
    if (!decrypted) return;
    const parsed = JSON.parse(decrypted);
    pb.authStore.save(parsed.token || "", parsed.record || null);
  } catch {
    // corrupt or undecryptable — treat as logged out rather than crash
  }
}
