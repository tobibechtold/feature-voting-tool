// localStorage-based cache for React Query initialData
// Provides instant data on hard reloads while React Query refetches in background

const CACHE_PREFIX = 'query_cache:';
const CACHE_MAX_AGE = 1000 * 60 * 60; // 1 hour max age

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

export function getCachedData<T>(key: string): { data: T; updatedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    
    const entry: CacheEntry<T> = JSON.parse(raw);
    
    // Don't use cache older than max age
    if (Date.now() - entry.updatedAt > CACHE_MAX_AGE) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    
    return { data: entry.data, updatedAt: entry.updatedAt };
  } catch {
    return null;
  }
}

export function setCachedData<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      updatedAt: Date.now(),
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable - ignore
  }
}

export function clearCachedData(key: string): void {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch {
    // ignore
  }
}

// Helper to create a query with timeout
export function createTimeoutSignal(ms: number = 10000): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, ms);
  
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeoutId),
  };
}

export class TimeoutError extends Error {
  constructor(message = 'Request timed out. Please check your connection and try again.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// Deterministic timeout wrapper - forces promise to settle even if Supabase hangs upstream
export function promiseWithTimeout<T>(promise: Promise<T>, ms: number, abortController?: AbortController): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      // Best-effort cancellation
      abortController?.abort();
      reject(new TimeoutError());
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
