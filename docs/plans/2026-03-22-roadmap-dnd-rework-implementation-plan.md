# Roadmap Drag And Drop Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the roadmap's native drag/drop behavior with a reliable sortable board driven only by persisted manual ordering.

**Architecture:** Refactor the roadmap board to use `@dnd-kit` multi-container sortable interactions. Remove roadmap sort state entirely, normalize lane order from `roadmap_position`, and keep persistence in the existing roadmap move mutation so cross-lane moves and same-lane reorders remain shared and durable.

**Tech Stack:** React 18, TypeScript, React Router, TanStack Query, `@dnd-kit/core`, `@dnd-kit/sortable`, Vitest, Testing Library, Supabase Postgres

---

### Task 1: Remove roadmap sort state from the page shell

**Files:**
- Modify: `src/pages/Roadmap.tsx`
- Modify: `src/pages/Roadmap.test.tsx`
- Modify: `src/lib/roadmapPreferences.ts`
- Modify: `src/lib/roadmapPreferences.test.ts`
- Test: `src/pages/Roadmap.test.tsx`
- Test: `src/lib/roadmapPreferences.test.ts`

**Step 1: Write the failing test**

Add tests proving:
- the roadmap page no longer renders the sort selector
- roadmap sort helpers are no longer read or written

**Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/Roadmap.test.tsx src/lib/roadmapPreferences.test.ts`
Expected: FAIL because roadmap still renders and persists sort state.

**Step 3: Write minimal implementation**

- Remove `sortMode` state from `Roadmap.tsx`
- Remove roadmap sort helper exports or trim the file to grouped-list preferences only
- Update roadmap tests and mocks to reflect the simpler page shell

**Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/Roadmap.test.tsx src/lib/roadmapPreferences.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/Roadmap.tsx src/pages/Roadmap.test.tsx src/lib/roadmapPreferences.ts src/lib/roadmapPreferences.test.ts
git commit -m "refactor: remove roadmap sort state"
```

### Task 2: Normalize roadmap lane ordering around roadmap_position only

**Files:**
- Modify: `src/lib/feedbackOverview.ts`
- Modify: `src/lib/feedbackOverview.grouping.test.ts`
- Test: `src/lib/feedbackOverview.grouping.test.ts`

**Step 1: Write the failing test**

Add tests proving:
- roadmap lane items are ordered only by `roadmap_position`
- items with null positions get a deterministic fallback order
- duplicate positions are normalized deterministically

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/feedbackOverview.grouping.test.ts`
Expected: FAIL because roadmap ordering still falls back to sort modes.

**Step 3: Write minimal implementation**

Add helpers that:
- bucket roadmap items by status
- sort by `roadmap_position`
- break ties and fill missing positions deterministically using stable fallback attributes

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/feedbackOverview.grouping.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/feedbackOverview.ts src/lib/feedbackOverview.grouping.test.ts
git commit -m "refactor: make roadmap ordering manual only"
```

### Task 3: Add DnD library dependencies and a sortable test seam

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/roadmap/RoadmapBoard.test.tsx`
- Test: `src/components/roadmap/RoadmapBoard.test.tsx`

**Step 1: Write the failing test**

Extend roadmap board tests to cover:
- a drag session that changes the projected target index
- same-lane reorder intent
- cross-lane move intent without relying on native drop-strip elements

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: FAIL because the board still uses native drag handlers and has no sortable behavior.

**Step 3: Write minimal implementation**

- Add `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`
- Update the test setup so board interaction tests can drive sortable drag events

**Step 4: Run test to verify the dependency/test seam is ready**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: still FAIL, but now only because the sortable board implementation is missing.

**Step 5: Commit**

```bash
git add package.json package-lock.json src/components/roadmap/RoadmapBoard.test.tsx
git commit -m "build: add sortable roadmap dependencies"
```

### Task 4: Refactor the roadmap board to use sortable multi-lane drag state

**Files:**
- Modify: `src/components/roadmap/RoadmapBoard.tsx`
- Modify: `src/components/roadmap/RoadmapBoard.test.tsx`
- Test: `src/components/roadmap/RoadmapBoard.test.tsx`

**Step 1: Write the failing test**

Add tests proving:
- dragging within a lane updates the projected insertion index
- dragging across lanes updates the projected lane
- cancelling a drag restores the original board state

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: FAIL because `RoadmapBoard` still uses native drag state and drop handlers.

**Step 3: Write minimal implementation**

- Replace native drag state with `DndContext` state
- Keep optimistic lane arrays in board state
- On drag end, compute destination lane and index from sortable context data
- Reuse the existing mutation contract for persistence

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/roadmap/RoadmapBoard.tsx src/components/roadmap/RoadmapBoard.test.tsx
git commit -m "refactor: use sortable drag state on roadmap board"
```

### Task 5: Refactor roadmap lanes into sortable containers

**Files:**
- Modify: `src/components/roadmap/RoadmapLane.tsx`
- Modify: `src/components/roadmap/RoadmapBoard.test.tsx`
- Test: `src/components/roadmap/RoadmapBoard.test.tsx`

**Step 1: Write the failing test**

Add a test proving:
- the old drop strips are gone
- each lane accepts sortable insertions across lanes
- dropping anywhere in a lane resolves through sortable container logic

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: FAIL because lanes still render native drop zones.

**Step 3: Write minimal implementation**

- Remove `DropZone`
- Add sortable/droppable lane wiring
- Render lane contents from ordered item ids rather than manual drop-strip markup

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/roadmap/RoadmapLane.tsx src/components/roadmap/RoadmapBoard.test.tsx
git commit -m "refactor: make roadmap lanes sortable containers"
```

### Task 6: Make roadmap cards fully sortable and preserve existing actions

**Files:**
- Modify: `src/components/roadmap/RoadmapCard.tsx`
- Modify: `src/components/roadmap/RoadmapBoard.test.tsx`
- Test: `src/components/roadmap/RoadmapBoard.test.tsx`

**Step 1: Write the failing test**

Add tests proving:
- admins can drag from the card surface rather than a handle
- vote and comment UI still render
- clicking vote still votes in place
- non-admin cards remain non-draggable

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: FAIL because cards still depend on native draggable attributes and handle-style affordances.

**Step 3: Write minimal implementation**

- Apply sortable item wiring to the card container
- Preserve link and vote interactions
- Keep current badges/footer parity with list cards

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/roadmap/RoadmapCard.tsx src/components/roadmap/RoadmapBoard.test.tsx
git commit -m "feat: make roadmap cards fully sortable"
```

### Task 7: Add live insertion preview and displaced-card feedback

**Files:**
- Modify: `src/components/roadmap/RoadmapBoard.tsx`
- Modify: `src/components/roadmap/RoadmapLane.tsx`
- Modify: `src/components/roadmap/RoadmapCard.tsx`
- Modify: `src/components/roadmap/RoadmapBoard.test.tsx`
- Test: `src/components/roadmap/RoadmapBoard.test.tsx`

**Step 1: Write the failing test**

Add tests proving:
- a visible insertion placeholder appears during drag
- cards shift to show the projected drop position
- the preview clears on drop or cancel

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: FAIL because the sortable board does not yet expose preview state in the UI.

**Step 3: Write minimal implementation**

- Add preview state derived from the current active/over sortable data
- Render a lane placeholder or insertion marker at the projected index
- Ensure the board resets preview state after drag end/cancel

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/roadmap/RoadmapBoard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/roadmap/RoadmapBoard.tsx src/components/roadmap/RoadmapLane.tsx src/components/roadmap/RoadmapCard.tsx src/components/roadmap/RoadmapBoard.test.tsx
git commit -m "feat: add roadmap drag preview states"
```

### Task 8: Tighten roadmap mutation expectations for manual ordering

**Files:**
- Modify: `src/hooks/useFeedback.ts`
- Modify: `src/hooks/useFeedback.roadmap-mutation.test.ts`
- Test: `src/hooks/useFeedback.roadmap-mutation.test.ts`

**Step 1: Write the failing test**

Extend mutation tests to cover:
- same-lane reorder based only on destination index
- cross-lane reorder after manual normalization
- deterministic sibling position updates without sort-mode input

**Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useFeedback.roadmap-mutation.test.ts`
Expected: FAIL because the mutation still assumes the old board ordering model.

**Step 3: Write minimal implementation**

Update the roadmap move mutation to align exactly with manual lane arrays and remove any sort-mode assumptions.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/useFeedback.roadmap-mutation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useFeedback.ts src/hooks/useFeedback.roadmap-mutation.test.ts
git commit -m "fix: align roadmap mutation with sortable ordering"
```

### Task 9: Run full verification and capture environment blockers

**Files:**
- Modify: `README.md` only if dependency or operator notes need to be documented

**Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS

**Step 2: Run the production build**

Run: `npm run build`
Expected: PASS

**Step 3: Run required Supabase commands if backend scope changed**

Run: `npm run supabase:db:push`
Expected: PASS if additional schema changes were introduced and Supabase is authenticated.

Run: `npm run supabase:functions:deploy`
Expected: PASS only if any function code changed and Supabase is authenticated.

**Step 4: Record blockers honestly**

If Supabase commands cannot run, document the exact auth or environment blocker in the final report.

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: capture roadmap dnd rollout notes"
```
