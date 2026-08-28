import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@learnin/cache/";

interface CacheEnvelope<T> {
  data: T;
  cachedAt: number;
}

export async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { data, cachedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(envelope));
  } catch {
    // best-effort — a failed write just means this response won't be available offline
  }
}

/**
 * Network-first with an offline fallback: runs `fetcher`, caches a
 * successful result under `key`, and — only if the request itself fails
 * (no connection, server error, etc.) — falls back to whatever was cached
 * last, so the screen still has something to show. Rethrows the original
 * error when there's no cache to fall back to.
 */
export async function cachedRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    writeCache(key, data).catch(() => {});
    return data;
  } catch (err) {
    const cached = await readCache<T>(key);
    if (cached) return cached.data;
    throw err;
  }
}
