
# Fix Auth Race Condition Causing Infinite Skeletons

## Root Cause Analysis

The console shows two related issues:
1. **"Multiple GoTrueClient instances detected"** - Two Supabase clients (`supabase` and `publicSupabase`) share the same storage key, causing interference
2. **"Admin role check failed/timed out: TimeoutError"** - The role check races with itself due to both `onAuthStateChange` and `initSession` calling it simultaneously

The network logs prove the role check actually succeeds (returns `[{"role":"admin"}]`), but the hook's promise handling gets confused by the race condition.

## The Race Condition Flow (current buggy behavior)

1. Component mounts, `useAuth` effect runs
2. `onAuthStateChange` is set up - it immediately fires with the restored session
3. `onAuthStateChange` callback calls `await checkAdminRole()` - blocks until timeout
4. Meanwhile, `initSession()` also runs and calls `await checkAdminRole()`
5. Two role checks race, and state updates interleave unpredictably
6. The 5-second timeout fires before proper resolution

## Solution: Separate Initial Load from Ongoing Changes

Based on the Supabase auth best-practices pattern, we need to restructure `useAuth`:

| Concern | Initial Load | Ongoing Changes |
|---------|--------------|-----------------|
| Controls `isLoading` | Yes | No |
| Awaits role check | Yes, before setting `isLoading=false` | No, fire-and-forget |
| Source | `getSession()` on mount | `onAuthStateChange` listener |

---

## Implementation Plan

### 1. Fix `src/hooks/useAuth.ts` - Separate initial load from ongoing changes

**Key changes:**
- `onAuthStateChange` should NOT await the role check - it should fire-and-forget
- `onAuthStateChange` should NOT control `isLoading`
- Only `initSession` controls `isLoading` and awaits the role check
- Keep the timeout protection, but remove the race condition that triggers it

```text
BEFORE (race condition):
┌─────────────────────────────────────────┐
│ onAuthStateChange fires immediately     │
│   → await checkAdminRole() (blocks)     │
│                                         │
│ initSession() runs in parallel          │
│   → await checkAdminRole() (also blocks)│
│                                         │
│ Race condition → timeout before resolve │
└─────────────────────────────────────────┘

AFTER (fixed):
┌─────────────────────────────────────────┐
│ initSession() runs first                │
│   → await getSession()                  │
│   → await checkAdminRole()              │
│   → setLoading(false) in finally        │
│                                         │
│ onAuthStateChange (for future changes)  │
│   → update session/user immediately     │
│   → checkAdminRole() fire-and-forget    │
│   → does NOT touch isLoading            │
└─────────────────────────────────────────┘
```

### 2. Fix `src/integrations/supabase/client.ts` - Use different storage keys

**Key change:**
- Give `publicSupabase` a different storage key to avoid the "Multiple GoTrueClient" interference

```typescript
export const publicSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'public-supabase-auth',  // Different key to avoid conflicts
  },
});
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/useAuth.ts` | Restructure to separate initial load from ongoing auth changes; `onAuthStateChange` fires role check without awaiting |
| `src/integrations/supabase/client.ts` | Add `storageKey` to `publicSupabase` to prevent GoTrueClient conflicts |

## Expected Outcome

After this fix:
1. No more "Multiple GoTrueClient" warning (different storage keys)
2. No more admin role timeout (no race condition)
3. `isLoading` becomes `false` reliably after initial session + role check
4. Subsequent logins/logouts update state correctly via `onAuthStateChange`
