
## What’s happening (why skeletons can become “infinite”)
Right now the UI shows skeletons when React Query reports `(isLoading || isPlaceholderData)`.

That can get stuck if the underlying fetch never “settles” (success or error). Two common real-world reasons:
1) **The request is paused** (browser thinks you’re offline / network is blocked). React Query can keep the query in a “pending/paused” state, which keeps `isLoading`/placeholder UI forever.
2) **The request hangs** (CORS/network/extension/VPN) and the promise never resolves, so `isPlaceholderData` never flips off.

So the fix needs to do two things:
- Stop using “placeholderData + isPlaceholderData = skeleton” as the core strategy (it’s too easy to wedge).
- Add deterministic “escape hatches”: offline/paused UI + request timeouts + show cached data on reload.

---

## Goals
1) No more indefinite skeleton screens.
2) Reloading the deployed site feels fast (shows last known data immediately when possible).
3) When loading can’t complete (offline/hanging), show a clear message and a Retry action.

---

## Plan (code changes)

### 1) Replace `placeholderData: []` with persisted `initialData` (fast reloads without placeholder-stuck risk)
**Files:**  
- `src/hooks/useApps.ts`  
- `src/hooks/useFeedback.ts`

**What we’ll do:**
- Remove `placeholderData: []` from `useApps()` and `useFeedback()`.
- Add a tiny localStorage cache:
  - On successful fetch, store `{ updatedAt, data }` for:
    - apps list
    - feedback list per app (`feedback:${appId}`)
  - On hook mount, read the cache and supply it via:
    - `initialData`
    - `initialDataUpdatedAt`

**Result:**
- On a hard reload of the deployed page, users immediately see the last loaded apps/feedback (no skeleton).
- React Query will still refetch in the background to keep data fresh.

---

### 2) Add an explicit request timeout using Supabase PostgREST `abortSignal` (prevents hanging forever)
**Files:**  
- `src/hooks/useApps.ts`  
- `src/hooks/useFeedback.ts`  
- (optionally) `src/hooks/useApps.ts` for `useApp(slug)` too

**What we’ll do:**
- Wrap Supabase queries with an `AbortController` and `setTimeout` (e.g. 10s).
- Use `.abortSignal(controller.signal)` on the PostgREST builder so the fetch is cancelled.
- If aborted, throw a clear error like `Request timed out. Please retry.`

**Result:**
- Even if something causes the network request to hang, the query will reliably enter an **error** state (instead of skeleton forever).
- Your existing `QueryErrorState` on `/` can then display a Retry UI.

---

### 3) Handle “paused/offline” state explicitly in the UI (no more endless skeleton when offline)
**Files:**  
- `src/pages/Index.tsx`  
- `src/pages/AppFeedback.tsx`

**What we’ll do:**
- Read React Query’s `fetchStatus` (and/or `isPaused` depending on availability) from the query results.
- If `fetchStatus === 'paused'`, show a friendly “Looks like you’re offline / blocked” message with:
  - Retry button (`refetch()`)
  - Optional “Reload page” button

**Result:**
- When the browser/network pauses the query, the UI will not sit on skeletons forever.

---

### 4) Update skeleton conditions to be data-aware (never cover real data with skeletons)
**Files:**  
- `src/pages/Index.tsx`  
- `src/pages/AppFeedback.tsx`

**What we’ll do:**
- Stop using `isPlaceholderData` in the pages (since we’ll remove `placeholderData`).
- Show skeleton only when:
  - the query is loading **and** there is **no** usable data to render yet.
- If cached `initialData` exists, render the list immediately and optionally show a small “Refreshing…” indicator (using `isFetching`) instead of skeletons.

**Result:**
- Reload experience: content first, refresh second.
- No more “No apps available” flash caused by placeholder arrays.

---

## Testing checklist (what you should verify after I implement)
1) **Deployed site hard reload** (`Cmd/Ctrl+Shift+R`) on `/`:
   - You should see either cached apps immediately OR a skeleton briefly, but never indefinite.
2) **Deployed site hard reload** on `/app/:slug`:
   - Same behavior for feedback list.
3) **Simulate offline** (Chrome DevTools → Network → Offline):
   - Instead of skeleton forever, you should see an offline/paused message + Retry.
4) **Normal online load**:
   - No “No apps available” flash while real data is still loading.
5) **End-to-end flow**:
   - Navigate around (Home → App page → back) and ensure no regressions.

---

## Notes / why this is the most reliable approach
- `placeholderData` is great for preventing “undefined” UI, but it can keep `isPlaceholderData` true until a fetch succeeds. If the fetch is paused/hanging, that’s a recipe for infinite skeletons.
- `initialData` + localStorage cache gives you the “fast reload” you actually want, without pretending empty arrays are real data.
- Abort timeouts + offline UI make the app behave predictably even under bad network conditions.
