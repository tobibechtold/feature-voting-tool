# Feedback Overview Sorting And Version Filter Design

## Goal

Extend the app feedback overview so users can:
- sort items by date, popularity, or version (highest version first)
- filter by version (`All versions`, specific version, `No version`)

The page must keep current behavior where `completed` and `wont_do` stay below non-closed items.

## Scope

- Route: `src/pages/AppFeedback.tsx`
- Shared logic extracted to a utility for testability
- i18n labels for new controls
- Unit tests for sorting/filtering behavior

## Behavior

1. Sort options:
- `Popularity` (default): descending `vote_count`
- `Date`: descending `created_at` (newest first)
- `Version`: highest semantic version first, unversioned items last

2. Grouping behavior:
- Items with status `open`, `planned`, `progress` are grouped first
- Items with status `completed`, `wont_do` are grouped second
- Selected sort applies within each group

3. Version filter options:
- `All versions` (default): no version filtering
- Specific version (`1.2.0`, etc.): only items with that version
- `No version`: only items where `version` is null/empty

4. Version list source:
- Derived from currently loaded feedback items
- Unique values, sorted by version descending

## Technical Approach

- Add a pure helper in `src/lib/feedbackOverview.ts`:
  - `getVersionOptions(items)`
  - `filterAndSortFeedback(items, options)`
- Keep `AppFeedback.tsx` focused on UI state and rendering.
- Add tests in `src/lib/feedbackOverview.test.ts` to validate:
  - closed/wont_do remain at bottom
  - each sort mode ordering
  - version filter (`specific` and `none`)

## Risks And Mitigation

- Version strings may include `v` prefix or non-semver forms.
- Mitigation: normalize prefix and compare numeric segments safely; fall back to lexical compare when needed.

## Validation

- `npm test`
- `npm run build`
