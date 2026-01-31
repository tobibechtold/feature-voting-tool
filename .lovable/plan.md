
## Diagnosis (based on current code + your symptom)
You’re seeing “skeletons everywhere” only after logging in as admin and then hard reloading. That points to **Supabase auth/session restoration** on page load getting stuck, and because the app uses the same `supabase` client for *all* reads, **every query ends up waiting forever**.

Important detail: our current “timeout” implementation mainly uses `abortSignal()` to cancel the underlying fetch, but if Supabase gets stuck *before* the fetch starts (e.g., waiting on `auth.getSession()` / token refresh / internal lock), **the promise can remain pending forever**, which keeps React Query in `isLoading: true` and therefore skeletons never stop.

Also, some screens (notably `FeedbackDetail.tsx`) still show skeletons based on `appLoading || itemLoading` and don’t have offline/error escape hatches, so once any query hangs, those screens are guaranteed to stay on skeletons.

## Goals
1) No more “infinite skeleton” states anywhere (Home, App page, Feedback detail, Admin).
2) If Supabase/auth hangs, the UI should degrade gracefully (error + retry), not freeze.
3) Login state should not prevent public data from loading (apps list, feedback list, etc).

---

## Implementation plan

### A) Make timeouts *deterministic* (timeout the whole promise, not only the fetch)
**Why:** `abortSignal()` only helps if fetch actually starts. We need a timeout that forces the `queryFn` to settle even if Supabase hangs upstream.

**Changes:**
- Update `src/lib/queryCache.ts`:
  - Add a helper like `promiseWithTimeout(promise, ms)` that rejects with `TimeoutError` after `ms` no matter what.
  - Keep `AbortController` usage as best-effort cancellation, but rely on `promiseWithTimeout` to guarantee settlement.

**Result:** React Query will always transition to either `success` or `error`, never “pending forever”.

---

### B) Split Supabase into two clients: authenticated vs public (prevents admin-session issues from breaking public reads)
**Why:** Public pages (`/`, `/app/:slug`, feedback lists, comment reads) should not depend on auth/session restoration. If auth is stuck, we still want the app to work as an anonymous viewer.

**Changes:**
- Update `src/integrations/supabase/client.ts` to export:
  - `supabase` (current behavior, supports auth for admin operations)
  - `publicSupabase` (same URL/key, but with auth persistence disabled), e.g.
    - `auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }`
- Switch “public” query hooks to use `publicSupabase`:
  - Reads on `/`: apps list
  - Reads on `/app/:slug`: app + feedback
  - Feedback item read, comments reads, vote reads, etc.

**Keep admin-only mutations using `supabase`:**
- Create/update/delete app
- Update feedback status
- Delete feedback
- Storage operations (logos) if protected by RLS

**Result:** Even if admin session restoration hangs, public data still loads normally.

---

### C) Apply deterministic timeouts across *all* data hooks (not just apps/feedback list)
Right now only:
- `useApps()` and `useFeedback(appId)` have abort/timeouts

But these still can hang if Supabase hangs before fetch, and other queries (comments, feedback item, votes) have no timeouts at all.

**Changes:**
- Update hooks to wrap Supabase calls with `promiseWithTimeout(...)`:
  - `src/hooks/useApps.ts`
    - `useApps()`, `useApp(slug)`
  - `src/hooks/useFeedback.ts`
    - `useFeedbackItem(id)`
    - `useVotedItems()`
    - (optional but recommended) add timeouts to vote-related reads used in vote fallback
  - `src/hooks/useComments.ts`
    - `useComments(feedbackId)`, `useCommentCount(feedbackId)`
- Keep the localStorage cache (`initialData`) for lists, but ensure timeouts still work when there is no cached data.

**Result:** No query can keep React Query stuck in “pending” indefinitely.

---

### D) Make `useAuth()` non-blocking and resilient (so `/admin` can’t freeze forever)
`useAuth()` currently:
- Awaits the role query inside `onAuthStateChange`, and
- Does not have timeouts / try-catch, so `loading` can remain `true` forever if anything hangs.

**Changes:**
- Update `src/hooks/useAuth.ts`:
  1) Wrap `supabase.auth.getSession()` in `promiseWithTimeout`.
  2) Ensure `setLoading(false)` happens in a `finally` block (or after timeout) so the app never stays in auth loading forever.
  3) Make the admin-role check:
     - Run in a separate async function
     - Wrapped with `promiseWithTimeout`
     - `try/catch` protected
  4) If role lookup fails/times out, default to `isAdmin = false` (secure default).

**Result:** Reload can’t leave the app in an “auth initializing forever” state.

---

### E) Update remaining pages that still “skeleton forever” based on raw `isLoading`
Some pages still show skeletons without offline/error handling.

**Changes:**
- `src/pages/FeedbackDetail.tsx`
  - Replace `if (appLoading || itemLoading)` with a deterministic state machine like:
    - if paused → show `OfflineState`
    - else if error → show `QueryErrorState`
    - else if loading with no data → show skeleton
    - else render content
  - Apply similar logic to comments section (commentsLoading currently shows skeleton without paused/error handling).
- `src/pages/Admin.tsx`
  - For apps table loading state: handle error/paused (instead of only `isLoading`).
  - Keep `authLoading` gating, but it should no longer be able to hang after fixing `useAuth()`.

**Result:** Even if something goes wrong, user sees an actionable error/offline UI instead of endless skeletons.

---

### F) Reduce/avoid retries on timeouts (prevents “it looks infinite” due to long retry cycles)
With `retry: 2` and a 10s timeout, the UI could effectively “load” for ~30s before showing error.

**Changes:**
- Update `src/lib/queryClient.ts`:
  - Replace `retry: 2` with a function:
    - Don’t retry `TimeoutError`
    - Retry other transient errors a small number of times

**Result:** If something is stuck/hanging, users see error + retry quickly instead of a long skeleton period.

---

## Verification checklist (what you’ll test after implementation)
1) Login as admin → reload `/`:
   - Expected: apps render from cache immediately if available, otherwise skeleton briefly then either data or an error (no infinite skeleton).
2) Navigate `/app/:slug` and reload:
   - Expected: same behavior (never infinite).
3) Navigate `/app/:slug/:id` and reload:
   - Expected: item + comments should show offline/error states if blocked; never infinite skeleton.
4) Simulate “Offline” in DevTools:
   - Expected: `OfflineState` appears (not skeleton forever).
5) Hard refresh with a blocked Supabase domain (adblock/VPN scenario):
   - Expected: timeout → `QueryErrorState` and Retry button works.

---

## Notes / likely root cause you’ll see once fixed
After this change, if Supabase auth/session restoration is what’s hanging, you’ll start seeing deterministic `TimeoutError` (instead of infinite skeletons), which confirms the diagnosis. From there, the split client approach (`publicSupabase`) ensures the rest of the app remains usable regardless of auth issues.
