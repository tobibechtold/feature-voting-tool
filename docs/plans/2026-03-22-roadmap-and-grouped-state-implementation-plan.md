# Roadmap And Grouped State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a grouped-by-state mode to the feedback list and a separate public roadmap page with admin drag-and-drop status and order management.

**Architecture:** Keep the current feedback list page as the default experience and layer grouped sections on top of the existing filtered list. Add a dedicated roadmap page that uses the shared feedback query plus a persisted `roadmap_position` field so drag-and-drop order is stable for all viewers.

**Tech Stack:** React 18, TypeScript, React Router, TanStack Query, Vitest, Testing Library, Supabase Postgres/RLS

---

### Task 1: Add the roadmap ordering schema

**Files:**
- Create: `supabase/migrations/2026xxxxxxxxxx_add_feedback_roadmap_position.sql`
- Modify: `src/types/database.ts`
- Modify: `src/types/index.ts`
- Test: `src/hooks/useFeedback.roadmap-mutation.test.ts`

**Step 1: Write the failing test**

Create `src/hooks/useFeedback.roadmap-mutation.test.ts` covering a roadmap move that changes `status` and assigns the moved item a position at the end of the destination lane.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useFeedback.roadmap-mutation.test.ts`
Expected: FAIL because the roadmap mutation and type support do not exist yet.

**Step 3: Write minimal migration and type updates**

- Add `roadmap_position bigint` or another numeric type on `public.feedback`.
- Backfill existing rows with deterministic values per app and status.
- Update database and app-level types to expose `roadmap_position`.

**Step 4: Run test to verify the type/mutation gap is now isolated**

Run: `npm test -- src/hooks/useFeedback.roadmap-mutation.test.ts`
Expected: still FAIL, but now only because the mutation implementation is missing.

**Step 5: Commit**

```bash
git add supabase/migrations src/types/database.ts src/types/index.ts src/hooks/useFeedback.roadmap-mutation.test.ts
git commit -m "feat: add roadmap ordering field"
```

### Task 2: Add shared grouping and roadmap ordering utilities

**Files:**
- Modify: `src/lib/feedbackOverview.ts`
- Create: `src/lib/feedbackOverview.grouping.test.ts`
- Test: `src/lib/feedbackOverview.grouping.test.ts`

**Step 1: Write the failing test**

Add tests for:
- bucket order by status
- default collapsed states for `completed` and `wont_do`
- roadmap lane ordering behavior using `roadmap_position`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/feedbackOverview.grouping.test.ts`
Expected: FAIL because the grouping and roadmap helpers do not exist yet.

**Step 3: Write minimal implementation**

Add helpers that:
- return grouped sections from the filtered list
- return default section expansion state
- sort roadmap items inside each lane using persisted order and the selected roadmap sort mode

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/feedbackOverview.grouping.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/feedbackOverview.ts src/lib/feedbackOverview.grouping.test.ts
git commit -m "feat: add grouped feedback overview helpers"
```

### Task 3: Persist grouped-list and roadmap UI preferences

**Files:**
- Modify: `src/lib/sortPreference.ts`
- Create: `src/lib/roadmapPreferences.ts`
- Create: `src/lib/roadmapPreferences.test.ts`
- Test: `src/lib/roadmapPreferences.test.ts`

**Step 1: Write the failing test**

Add tests for:
- grouped-list enabled state persistence by slug
- grouped section expansion map persistence by slug
- roadmap sort mode persistence by slug

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/roadmapPreferences.test.ts`
Expected: FAIL because the new preference helpers do not exist yet.

**Step 3: Write minimal implementation**

Create explicit local-storage helpers for grouped-list and roadmap page preferences. Keep roadmap storage keys separate from the existing list sort key.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/roadmapPreferences.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/sortPreference.ts src/lib/roadmapPreferences.ts src/lib/roadmapPreferences.test.ts
git commit -m "feat: persist roadmap and grouped-list preferences"
```

### Task 4: Add the grouped-by-state feedback list mode

**Files:**
- Modify: `src/pages/AppFeedback.tsx`
- Create: `src/components/feedback/FeedbackStateSections.tsx`
- Create: `src/components/feedback/FeedbackStateSections.test.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `src/components/feedback/FeedbackStateSections.test.tsx`

**Step 1: Write the failing test**

Add component tests proving:
- grouped sections render in status order
- `completed` and `wont_do` are collapsed by default
- user toggles persist across rerenders

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/feedback/FeedbackStateSections.test.tsx`
Expected: FAIL because the grouped section UI does not exist yet.

**Step 3: Write minimal implementation**

- Add the `Group by state` switch to `AppFeedback`.
- Render the current flat list when disabled.
- Render the grouped section component when enabled.
- Keep existing list filters and sort controls unchanged.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/feedback/FeedbackStateSections.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/AppFeedback.tsx src/components/feedback/FeedbackStateSections.tsx src/components/feedback/FeedbackStateSections.test.tsx src/lib/i18n.ts
git commit -m "feat: add grouped state sections to feedback list"
```

### Task 5: Add the public roadmap page shell and routing

**Files:**
- Create: `src/pages/Roadmap.tsx`
- Modify: `src/App.tsx`
- Modify: `src/pages/AppFeedback.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `src/pages/Roadmap.test.tsx`

**Step 1: Write the failing test**

Add tests for:
- roadmap route rendering
- public read-only lane rendering
- roadmap header link visibility from the app page

**Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/Roadmap.test.tsx`
Expected: FAIL because the route and page do not exist yet.

**Step 3: Write minimal implementation**

- Add `/app/:slug/roadmap` to the router.
- Add the roadmap link beside the changelog link.
- Render a basic roadmap page with status lanes and the roadmap sort selector.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/Roadmap.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/Roadmap.tsx src/App.tsx src/pages/AppFeedback.tsx src/lib/i18n.ts src/pages/Roadmap.test.tsx
git commit -m "feat: add public roadmap page"
```

### Task 6: Add admin roadmap drag-and-drop mutation support

**Files:**
- Modify: `src/hooks/useFeedback.ts`
- Modify: `src/hooks/useFeedback.roadmap-mutation.test.ts`
- Test: `src/hooks/useFeedback.roadmap-mutation.test.ts`

**Step 1: Write the failing test**

Extend the roadmap mutation test to cover:
- same-lane reorder
- cross-lane move
- destination insertion at lane end
- query invalidation after success

**Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useFeedback.roadmap-mutation.test.ts`
Expected: FAIL because the mutation does not yet reorder siblings correctly.

**Step 3: Write minimal implementation**

Add a roadmap mutation hook that performs the minimal set of feedback row updates needed to preserve lane ordering and status.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/useFeedback.roadmap-mutation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useFeedback.ts src/hooks/useFeedback.roadmap-mutation.test.ts
git commit -m "feat: support roadmap drag and drop updates"
```

### Task 7: Build roadmap lane and card components

**Files:**
- Create: `src/components/roadmap/RoadmapBoard.tsx`
- Create: `src/components/roadmap/RoadmapLane.tsx`
- Create: `src/components/roadmap/RoadmapCard.tsx`
- Create: `src/components/roadmap/RoadmapBoard.test.tsx`
- Test: `src/components/roadmap/RoadmapBoard.test.tsx`

**Step 1: Write the failing test**

Add tests for:
- lane rendering in status order
- non-admin read-only behavior
- admin drag affordances
- optimistic revert on mutation error

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: FAIL because the board components do not exist yet.

**Step 3: Write minimal implementation**

Build the board, lane, and card components with admin-only drag/drop wiring and non-admin read-only rendering.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/roadmap src/components/roadmap/RoadmapBoard.test.tsx
git commit -m "feat: add roadmap board interactions"
```

### Task 8: Run full verification and document any environment blockers

**Files:**
- Modify: `README.md` if new environment or operator notes are required

**Step 1: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 2: Run production build**

Run: `npm run build`
Expected: PASS

**Step 3: Run required Supabase verification**

Run: `npm run supabase:db:push`
Expected: PASS if the project is linked; otherwise document the blocker.

Run: `npm run supabase:functions:deploy`
Expected: PASS if required and runnable; otherwise document the blocker.

**Step 4: Commit verification-related documentation if needed**

```bash
git add README.md
git commit -m "docs: record roadmap rollout requirements"
```
