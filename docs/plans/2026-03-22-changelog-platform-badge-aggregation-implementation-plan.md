# Changelog Platform Badge Aggregation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make changelog entries unique per feedback item within a release group while accumulating all target platform badges on that single entry.

**Architecture:** Keep the fix in the frontend query layer by aggregating duplicate `feedback_release_targets` rows in `useReleaseGroups`. Update the changelog page to render the aggregated `target_platforms` array rather than one row per platform.

**Tech Stack:** React 18, TypeScript, TanStack Query, Vitest, Testing Library

---

### Task 1: Add a failing aggregation test

**Files:**
- Create: `src/hooks/useReleases.release-group-items.test.ts`
- Modify: `src/hooks/useReleases.ts`
- Test: `src/hooks/useReleases.release-group-items.test.ts`

**Step 1: Write the failing test**

Add a test that constructs release-target rows for one feedback item assigned to `ios` and `android` in the same release group and expects one aggregated changelog item with `target_platforms` equal to `['android', 'ios']` or the chosen stable order.

**Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useReleases.release-group-items.test.ts`
Expected: FAIL because duplicate rows are not yet aggregated.

### Task 2: Implement minimal aggregation

**Files:**
- Modify: `src/hooks/useReleases.ts`
- Modify: `src/pages/Changelog.tsx`
- Test: `src/hooks/useReleases.release-group-items.test.ts`

**Step 1: Write minimal implementation**

Add a small aggregation helper in `src/hooks/useReleases.ts` that groups release-group items by `feedback.id` and accumulates unique `target_platforms`.

**Step 2: Update rendering**

Render one changelog list item per aggregated feedback item and map over `target_platforms` to show multiple platform badges.

**Step 3: Run targeted tests**

Run: `npm test -- src/hooks/useReleases.release-group-items.test.ts`
Expected: PASS

### Task 3: Verify no regressions

**Files:**
- Modify: `src/hooks/useReleases.release-group-items.test.ts` if needed

**Step 1: Run full required verification**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS
