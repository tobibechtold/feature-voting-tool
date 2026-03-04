# Remove Set Version From Feedback/Bug (Per Target) - Design

## Context
Admins can assign release versions to feedback/bug items via `feedback_release_targets`, but cannot remove an existing assignment from the feedback detail view. The requested behavior is per-target removal (remove one specific platform/version target while keeping others).

## Goals
- Allow admins to remove an individual release target from a feedback item.
- Keep public/non-admin behavior unchanged.
- Keep legacy `feedback.version` column synchronized to avoid stale data.

## Non-Goals
- No schema changes.
- No soft-delete/audit trail implementation.
- No changelog UI redesign.

## Approach Options
1. Delete target row directly (recommended)
- Delete one `feedback_release_targets` row by `id`.
- Recompute `feedback.version` based on remaining targets.
- Minimal change, aligns with existing schema and UI data.

2. Reassign/overwrite targets via existing assign mutation
- More complex control flow and brittle replacement semantics.
- Higher regression risk.

3. Soft delete with `deleted_at`
- Adds schema and query complexity not needed for current scope.

## Recommended Design
Use direct target deletion with a dedicated mutation and per-target remove affordance in the admin UI.

## Data Flow
### New mutation: `useRemoveFeedbackReleaseTarget` in `src/hooks/useReleases.ts`
Inputs:
- `targetId: string`
- `feedbackId: string`
- `appId: string`

Mutation steps:
1. Delete `feedback_release_targets` row where `id = targetId`.
2. Query remaining targets for `feedbackId`, including `release_group.semver`.
3. Sync legacy `feedback.version`:
- If no remaining targets: set `version = null`.
- If targets remain: set `version` to one remaining semver.
4. Invalidate related queries:
- `['release-groups', appId]`
- `['feedback-release-targets', feedbackId]`
- `['feedback']`
- `['changelog']`

## UI Changes
### `src/pages/FeedbackDetail.tsx`
- In release target badges, show an admin-only remove button/icon per target.
- Keep non-admin rendering unchanged.
- On click, call `useRemoveFeedbackReleaseTarget.mutateAsync` for that target.
- Disable button(s) while mutation pending to prevent duplicate submissions.
- Show success/error toast.

## Edge Cases
- Removing one of many targets: remaining targets still display and keep feedback versioned.
- Removing final target: `feedback.version` becomes `null`.
- Mutation failure: show error toast; no optimistic mutation required.

## Testing Plan
1. Add unit tests for removal mutation behavior:
- final target removed => `feedback.version = null`
- target removed with others remaining => `feedback.version` stays populated
2. Add UI behavior test for admin remove action calling mutation with selected target id.
3. Run existing test suite to ensure no regressions.

## Rollout/Risk
- Low risk: additive mutation + small admin-only UI control.
- Main compatibility concern is legacy `feedback.version` synchronization, handled explicitly.
