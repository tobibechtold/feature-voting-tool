
## Goals
Fix three issues:
1) Deleting a “feature” (likely a feedback item of type `feature`, or possibly an app) fails.
2) Upvotes sometimes don’t increase (and/or you see conflicts / stale counts).
3) In Preview, the UI sometimes stays on skeletons until you publish.

## What I found in the codebase (current behavior)
### Voting (src/hooks/useFeedback.ts)
- `useVote()` currently:
  1) checks if a vote already exists
  2) inserts into `votes`
  3) reads `feedback.vote_count`
  4) writes `feedback.vote_count + 1`
- This can still fail / look wrong if:
  - The `feedback` table UPDATE is blocked by RLS (very common), so the vote row inserts but `vote_count` never changes.
  - Two-step “check then insert” can still race in rare cases (double-click / two tabs) and create conflicts.
  - `vote_count` is denormalized and maintained by the client, which is fragile.

### Deleting “feature”
There are two deletion flows in the app:
- Delete feedback item (FeedbackDetail page) uses `useDeleteFeedback()` which manually deletes:
  - votes -> comments -> feedback
- Delete app (Admin page) uses `useDeleteApp()` which deletes the app row only.

Both can fail if:
- There are foreign key constraints (feedback references app; votes/comments reference feedback) and the DB is set to restrict deletes, or
- RLS policies do not allow deletes/updates for the current user/role.

### Skeleton “only goes away after publish”
Given your earlier symptom “`[useApps] Data logged` but still skeletons”, this strongly suggests Preview is getting into a “bad client state” where:
- data arrives, but the UI doesn’t transition away from loading reliably, OR
- the page that shows skeletons is a different query than the one logging data (e.g. `/app/intake` uses `useApp(slug)` + `useFeedback(app.id)` which currently has no logging), OR
- HMR (Preview’s hot reload) is causing state to become inconsistent (publish forces a clean reload + new build, which “fixes” it).

## Proposed solution (high-confidence, fixes root causes)

### A) Make voting atomic and authoritative (no client-maintained counter)
Instead of “insert vote then separately update vote_count”, move vote-count maintenance to the database so:
- You never get “vote inserted but count didn’t change”.
- You never get races updating `vote_count`.
- You can remove most client-side complexity.

Two good options (I recommend Option A1):

#### Option A1 (Recommended): DB function (RPC) that does “insert-if-not-exists + update count” in one transaction
1) Create a SQL function in Supabase, e.g. `public.vote_for_feedback(feedback_id uuid, voter_id text)`
   - `INSERT INTO votes ... ON CONFLICT DO NOTHING`
   - `UPDATE feedback SET vote_count = (SELECT count(*) FROM votes WHERE feedback_id=...)`
   - Return the new count (or the full feedback row)
2) Update the client `useVote()` to call `supabase.rpc('vote_for_feedback', { ... })` and then invalidate queries.

This eliminates:
- 409 conflicts (handled via `ON CONFLICT DO NOTHING`)
- non-incrementing counts (the DB recalculates it)
- the “check then insert” race

#### Option A2: Stop storing `vote_count` and compute it on read
- Fetch feedback with a count of related votes and display that.
- This can be clean, but requires correct relationships + query shape and may be more changes across the UI.

Client-side improvements we’ll also implement:
- Disable the vote button while `useVote` is pending to prevent double clicks.
- Optional optimistic UI update: immediately increment the visible count while the request is in-flight, then reconcile on refetch.

### B) Fix deletion robustly (and make it atomic)
We’ll cover both likely meanings of “delete a feature”:

#### B1) If you mean “delete a feedback item (feature request)”
Current code deletes votes/comments/feedback in three separate requests, so it can leave partial deletes if any step fails.

Fix:
- Create a DB function like `public.delete_feedback_cascade(feedback_id uuid)` that deletes in a single transaction:
  - delete from votes where feedback_id = ...
  - delete from comments where feedback_id = ...
  - delete from feedback where id = ...
- Update `useDeleteFeedback()` to call the RPC instead of doing 3 calls.

Additionally:
- Add proper error surfacing (toast) for delete failures (including the DB error message).
- Ensure the UI invalidates the right queries and navigates away cleanly.

#### B2) If you mean “delete an app”
Admin currently calls `DELETE FROM apps WHERE id=...` without removing related feedback, which will fail if the DB restricts deletes.

Fix options:
- Preferred: add `ON DELETE CASCADE` foreign keys:
  - feedback.app_id -> apps.id ON DELETE CASCADE
  - votes.feedback_id -> feedback.id ON DELETE CASCADE
  - comments.feedback_id -> feedback.id ON DELETE CASCADE
- Or: implement an RPC `delete_app_cascade(app_id uuid)` that deletes children then parent atomically.

### C) Resolve the Preview skeleton issue (make loading deterministic + expose the real error)
We’ll do two things: “prevent getting stuck” and “make it obvious why it’s stuck”.

1) Add error-aware UI states:
   - For `Index` (apps list) and `AppFeedback` (app + feedback list):
     - show skeleton only when loading AND no cached data
     - show an error card if the query errors (with a “Retry” button calling `refetch()`)

2) Add a “Loading too long” fallback:
   - If a query is still loading after ~10 seconds, show a message:
     - “Still loading… Retry” and “Hard refresh”
   - This avoids “infinite skeleton” with no clue.

3) Make React Query client stable across HMR
   - In Preview, HMR can replace modules; if the QueryClient is recreated unexpectedly, it can contribute to weird “loading” UI.
   - We’ll move QueryClient creation into a small singleton module and (in dev only) keep it on `window` so it persists across HMR updates.

4) Remove / reduce noisy warnings that can obscure real errors
   - You still have ref-warnings around DropdownMenu/Skeleton in earlier logs. Even if not fatal, we’ll ensure our custom UI wrappers consistently use `forwardRef`, and that any `asChild` usage isn’t passing refs to non-forwardRef components.

## RLS / Permissions (very likely the real reason deletes and vote counts “don’t work”)
Because this is an external Supabase project (hardcoded URL/key) and my schema-inspection tool can’t fetch your policies here, we’ll validate via the browser Network tab:
- For vote: check whether the `PATCH/UPDATE feedback` step is failing due to RLS.
- For delete: check whether the deletes are failing due to RLS or FK constraints.

Then we’ll apply the minimal safe policies needed.

If your product is a public feedback board (no PII), a typical approach is:
- Allow public SELECT on `apps` and `feedback`
- Allow public INSERT on `votes` (and optionally `feedback` if you want public submissions)
- Restrict UPDATE/DELETE of `feedback` and INSERT on `comments` to admins only

If you want voting to be public but still safe, the DB-function approach above reduces the surface area of what needs to be permitted.

## Implementation steps (what I will change after you approve)
1) Voting
   - Replace `useVote()` with an RPC-based mutation:
     - remove “check then insert” query
     - call `vote_for_feedback` RPC
     - invalidate:
       - `['feedback', appId]`
       - `['feedback','item', feedbackId]`
       - `['votes', voterId]`
   - Update `VoteButton` usage to pass `disabled={vote.isPending || voted}` (and ensure list + detail both do this)

2) Deletion
   - Confirm which deletion is failing (feedback item vs app) by adding better error toasts + checking network responses.
   - Implement either:
     - RPC `delete_feedback_cascade` and switch `useDeleteFeedback()` to use it, and/or
     - cascade delete for apps (either via FK cascade or RPC), and update `useDeleteApp()` accordingly.

3) Skeleton issue
   - Add query error UI and a “Retry” button on:
     - Index apps list
     - AppFeedback app+feedback queries
   - Add “loading too long” timeout fallback UI
   - Make QueryClient stable across HMR (singleton module)

4) Cleanup
   - Remove temporary debug logging once stable (or keep only behind a dev flag).

## QA checklist (end-to-end)
1) Preview:
   - Load `/` and confirm apps appear (no infinite skeleton).
   - Load `/app/intake` and confirm header + feedback list renders.
2) Voting:
   - Click upvote once: count increases by 1 and stays increased after refresh.
   - Click again: no error, count does not increase again.
   - Verify no `409 Conflict` in Network.
3) Deletion:
   - As admin, delete a feedback item:
     - item disappears from list
     - detail page redirects back to app page
   - (If relevant) delete an app in Admin:
     - app disappears from `/`
     - no FK/RLS errors.
4) Publish:
   - Repeat quick smoke test on the published URL.

## Risks / tradeoffs
- Moving vote counting to DB functions/triggers is the most reliable fix, but requires running SQL in your Supabase project.
- If RLS is currently very restrictive, we’ll need to adjust policies. For public boards (no PII), that’s usually acceptable. If you want stricter security, we may need authenticated voting instead of anonymous `voter_id` in localStorage.
