# Feedback Overview Sorting And Version Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add overview sorting (date, popularity, version) and version filtering (`all`, specific version, `no version`) while preserving non-closed-first grouping.

**Architecture:** Move filtering/sorting behavior into a pure utility module to keep UI components thin and make behavior testable. Wire the page to utility functions via local state for sort mode and version filter. Keep existing data fetching unchanged.

**Tech Stack:** React 18, TypeScript, Vite, Vitest.

---

### Task 1: Add failing tests for overview sorting and version filtering

**Files:**
- Create: `src/lib/feedbackOverview.test.ts`
- Test: `src/lib/feedbackOverview.test.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `filterAndSortFeedback` keeps `completed` and `wont_do` at the bottom
- popularity/date/version sort modes work as expected
- version filter handles specific version and no-version items
- `getVersionOptions` returns unique versions sorted highest-first

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/feedbackOverview.test.ts`
Expected: FAIL because module/functions do not exist yet.

**Step 3: Commit**

```bash
git add src/lib/feedbackOverview.test.ts
git commit -m "test: add failing feedback overview sorting specs"
```

### Task 2: Implement minimal utility logic to satisfy tests

**Files:**
- Create: `src/lib/feedbackOverview.ts`
- Test: `src/lib/feedbackOverview.test.ts`

**Step 1: Write minimal implementation**

Implement:
- `OverviewSortMode` and `OverviewVersionFilter` types
- `getVersionOptions(items)`
- `filterAndSortFeedback(items, options)`

with:
- non-closed (`open`, `planned`, `progress`) before closed (`completed`, `wont_do`)
- sort comparator for popularity/date/version
- version normalization/comparison helper

**Step 2: Run targeted test to verify it passes**

Run: `npm test -- src/lib/feedbackOverview.test.ts`
Expected: PASS.

**Step 3: Commit**

```bash
git add src/lib/feedbackOverview.ts src/lib/feedbackOverview.test.ts
git commit -m "feat: add feedback overview sort and version filter utility"
```

### Task 3: Wire AppFeedback UI controls to utility logic

**Files:**
- Modify: `src/pages/AppFeedback.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `src/lib/feedbackOverview.test.ts`

**Step 1: Update page state and derived data**

Add state for:
- sort mode (default popularity)
- version filter (default all)

Use utility functions in `useMemo`:
- compute version options from current feedback set
- compute filtered/sorted list from current filters

**Step 2: Add UI controls**

In the filters row add:
- sort dropdown (`Popularity`, `Date`, `Version`)
- version dropdown (`All versions`, specific versions, `No version`)

**Step 3: Add i18n keys**

Add EN/DE labels for:
- sort label and options
- version filter label and options

**Step 4: Run relevant tests**

Run: `npm test -- src/lib/feedbackOverview.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/pages/AppFeedback.tsx src/lib/i18n.ts
git commit -m "feat: add overview sort and version filter controls"
```

### Task 4: Full verification

**Files:**
- Verify only

**Step 1: Run required test suite**

Run: `npm test`
Expected: PASS.

**Step 2: Run required build**

Run: `npm run build`
Expected: PASS.

**Step 3: Final status**

Report changed files and command outcomes.
