# App Navigation Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the crowded app header button row with shared app-level navigation plus a single `New Feedback` action.

**Architecture:** Extract a shared app navigation/header component used by the feedback list, roadmap, and changelog pages. Move `Feedback`, `Roadmap`, and `Changelog` into that local navigation, and consolidate `Create Feature` / `Create Bug` into one feedback entry point that chooses type inside the dialog flow.

**Tech Stack:** React 18, TypeScript, React Router, shadcn/ui, TanStack Query, Vitest, Testing Library

---

### Task 1: Add a neutral feedback-dialog entry flow

**Files:**
- Modify: `src/components/CreateFeedbackDialog.tsx`
- Modify: `src/pages/AppFeedback.tsx`
- Test: `src/pages/AppFeedback.tsx` tests or a dialog-focused test file near `src/components/`

**Step 1: Write the failing test**

Add a test proving:
- the app header exposes a single `New Feedback` action
- opening the dialog no longer requires a preselected type
- the user can still choose `Feature` or `Bug`

**Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/AppFeedback.test.tsx`
Expected: FAIL because the page still renders separate create buttons or the dialog requires a preset type.

**Step 3: Write minimal implementation**

- Make the dialog support a neutral launch state
- Move type selection into the dialog flow
- Replace the separate header buttons with one `New Feedback` trigger on the feedback page

**Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/AppFeedback.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/CreateFeedbackDialog.tsx src/pages/AppFeedback.tsx src/pages/AppFeedback.test.tsx
git commit -m "feat: consolidate feedback creation entry point"
```

### Task 2: Introduce a shared app navigation component

**Files:**
- Create: `src/components/AppPageNavigation.tsx`
- Create: `src/components/AppPageNavigation.test.tsx`
- Test: `src/components/AppPageNavigation.test.tsx`

**Step 1: Write the failing test**

Add tests proving:
- the component renders `Feedback`, `Roadmap`, and `Changelog`
- the active route is highlighted correctly
- the nav remains structurally usable on narrow layouts

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/AppPageNavigation.test.tsx`
Expected: FAIL because the shared component does not exist.

**Step 3: Write minimal implementation**

- Build a reusable app-level nav component
- Use link-based navigation with an active-state prop or route-aware styling
- Keep the mobile pattern as horizontal overflow rather than a menu

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/AppPageNavigation.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/AppPageNavigation.tsx src/components/AppPageNavigation.test.tsx
git commit -m "feat: add shared app page navigation"
```

### Task 3: Extract a shared app header shell

**Files:**
- Create: `src/components/AppPageHeader.tsx`
- Create: `src/components/AppPageHeader.test.tsx`
- Modify: `src/pages/AppFeedback.tsx`
- Modify: `src/pages/Roadmap.tsx`
- Modify: `src/pages/Changelog.tsx`
- Test: `src/components/AppPageHeader.test.tsx`

**Step 1: Write the failing test**

Add tests proving:
- the shared header renders app identity plus the local navigation row
- the CTA area is optional
- the layout supports the feedback page and read-only pages

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/AppPageHeader.test.tsx`
Expected: FAIL because the shared header shell does not exist.

**Step 3: Write minimal implementation**

- Extract the repeated app page header structure into one shared component
- Compose it with `AppPageNavigation`
- Pass an optional action slot for `New Feedback`

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/AppPageHeader.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/AppPageHeader.tsx src/components/AppPageHeader.test.tsx src/pages/AppFeedback.tsx src/pages/Roadmap.tsx src/pages/Changelog.tsx
git commit -m "refactor: share app page header layout"
```

### Task 4: Move page navigation out of the feedback action area

**Files:**
- Modify: `src/pages/AppFeedback.tsx`
- Modify: `src/pages/Roadmap.tsx`
- Modify: `src/pages/Roadmap.test.tsx`
- Modify: `src/pages/Changelog.tsx`
- Test: `src/pages/Roadmap.test.tsx`
- Test: changelog page test file if present, otherwise add a focused page test

**Step 1: Write the failing test**

Add tests proving:
- `Roadmap` and `Changelog` no longer render as standalone header action buttons on the feedback page
- all three pages render the shared local navigation with the correct active item

**Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/Roadmap.test.tsx`
Expected: FAIL because the pages still use their current independent header layouts.

**Step 3: Write minimal implementation**

- Remove standalone page-destination buttons from the feedback header
- Render the shared local navigation on feedback, roadmap, and changelog
- Ensure active-state wiring is correct per route

**Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/Roadmap.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/AppFeedback.tsx src/pages/Roadmap.tsx src/pages/Roadmap.test.tsx src/pages/Changelog.tsx
git commit -m "refactor: move app destinations into shared navigation"
```

### Task 5: Final verification and cleanup

**Files:**
- Review: `src/components/AppPageNavigation.tsx`
- Review: `src/components/AppPageHeader.tsx`
- Review: `src/pages/AppFeedback.tsx`
- Review: `src/pages/Roadmap.tsx`
- Review: `src/pages/Changelog.tsx`

**Step 1: Run targeted tests**

Run: `npm test -- src/components/AppPageNavigation.test.tsx src/components/AppPageHeader.test.tsx src/pages/Roadmap.test.tsx src/pages/AppFeedback.test.tsx`
Expected: PASS

**Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 3: Run production build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit final polish**

```bash
git add src/components/AppPageNavigation.tsx src/components/AppPageHeader.tsx src/pages/AppFeedback.tsx src/pages/Roadmap.tsx src/pages/Changelog.tsx
git commit -m "refactor: simplify app page navigation"
```
