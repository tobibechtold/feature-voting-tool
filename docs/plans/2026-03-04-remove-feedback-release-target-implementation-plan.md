# Remove Feedback Release Target Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to remove an individual assigned version/platform target from a feedback or bug item.

**Architecture:** Add a dedicated React Query mutation in release hooks that deletes a single `feedback_release_targets` row and then re-syncs the legacy `feedback.version` column based on remaining targets. Expose an admin-only remove control for each target badge in feedback detail that calls this mutation. Keep public UI unchanged and rely on query invalidation for consistency.

**Tech Stack:** React 18, TypeScript, TanStack Query, Supabase JS, Vitest, Testing Library

---

### Task 1: Add mutation tests for per-target removal behavior

**Files:**
- Create: `src/hooks/useReleases.remove-target.test.ts`
- Reference: `src/hooks/useReleases.ts`
- Reference: `src/test/setup.ts`

**Step 1: Write the failing test for removing the last target**

```ts
it('clears feedback.version when removed target is the last one', async () => {
  // mock supabase delete success
  // mock follow-up query returns []
  // expect feedback.update({ version: null })
});
```

**Step 2: Run test to verify it fails**
Run: `npm test -- src/hooks/useReleases.remove-target.test.ts`
Expected: FAIL because `useRemoveFeedbackReleaseTarget` does not exist.

**Step 3: Write the failing test for removing one of many targets**

```ts
it('keeps feedback.version set when targets remain', async () => {
  // mock remaining targets with release_group.semver = '1.2.3'
  // expect feedback.update({ version: '1.2.3' })
});
```

**Step 4: Run test to verify failure reason is implementation missing**
Run: `npm test -- src/hooks/useReleases.remove-target.test.ts`
Expected: FAIL with missing export or unmet expectations.

**Step 5: Commit**
```bash
git add src/hooks/useReleases.remove-target.test.ts
git commit -m "test: cover release target removal mutation behavior"
```

### Task 2: Implement `useRemoveFeedbackReleaseTarget` in release hooks

**Files:**
- Modify: `src/hooks/useReleases.ts`
- Test: `src/hooks/useReleases.remove-target.test.ts`

**Step 1: Implement minimal mutation to satisfy tests**

```ts
export function useRemoveFeedbackReleaseTarget() {
  return useMutation({
    mutationFn: async ({ targetId, feedbackId, appId }) => {
      // delete target row
      // fetch remaining targets + release_group.semver
      // sync feedback.version -> null or remaining semver
    },
    onSuccess: (_, vars) => {
      // invalidate release-groups, feedback-release-targets, feedback, changelog
    },
  });
}
```

**Step 2: Run focused test suite**
Run: `npm test -- src/hooks/useReleases.remove-target.test.ts`
Expected: PASS.

**Step 3: Run broader hook regression check**
Run: `npm test -- src/hooks/useReleases.remove-target.test.ts src/lib/platforms.test.ts`
Expected: PASS.

**Step 4: Commit**
```bash
git add src/hooks/useReleases.ts src/hooks/useReleases.remove-target.test.ts
git commit -m "feat: add per-target feedback release removal mutation"
```

### Task 3: Add admin remove control in feedback detail UI

**Files:**
- Modify: `src/pages/FeedbackDetail.tsx`
- Reference: `src/components/ui/badge.tsx`
- Reference: `src/components/ui/button.tsx`

**Step 1: Write the failing UI test**
- Create test asserting:
- admin users see remove control on each release target badge
- non-admin users do not see remove control
- clicking control calls mutation with selected target id

**Proposed test file:** `src/pages/FeedbackDetail.release-targets.test.tsx`

**Step 2: Run test to verify failure**
Run: `npm test -- src/pages/FeedbackDetail.release-targets.test.tsx`
Expected: FAIL because control/callback is not implemented.

**Step 3: Implement minimal UI changes**
- Import and wire `useRemoveFeedbackReleaseTarget`.
- Add admin-only remove button/icon inside each rendered release target badge.
- Disable control while mutation is pending.
- Add success/error toasts.

**Step 4: Run focused UI test**
Run: `npm test -- src/pages/FeedbackDetail.release-targets.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/pages/FeedbackDetail.tsx src/pages/FeedbackDetail.release-targets.test.tsx
git commit -m "feat: add admin remove action for feedback release targets"
```

### Task 4: Verification and cleanup

**Files:**
- Modify (if needed): `src/lib/i18n.ts`
- Modify (if needed): `README.md`

**Step 1: Decide localization handling**
- If adding new translation keys (`versionRemoved`), update all locales.
- If reusing existing generic key, no i18n file edits needed.

**Step 2: Run full test suite**
Run: `npm test`
Expected: PASS all tests.

**Step 3: Run lint**
Run: `npm run lint`
Expected: PASS with no new lint errors.

**Step 4: Manual smoke check**
Run: `npm run dev`
Expected:
- Admin can remove one target without affecting others.
- Removing final target removes all version badges.
- Non-admin view has no remove controls.

**Step 5: Final commit (if Task 4 changed files)**
```bash
git add src/lib/i18n.ts README.md
git commit -m "chore: polish release target removal copy/docs"
```
