# Changelog Platform Badge Aggregation Design

## Goal

Ensure a feedback item appears only once per release group in the changelog even when it is assigned to multiple platform targets, while still showing all assigned platform badges on that single item.

## Current Behavior

`useReleaseGroups` returns one changelog item per `feedback_release_targets` row. When the same feedback item is assigned to multiple platforms in the same release group, `src/pages/Changelog.tsx` renders duplicate entries with one platform badge each.

## Desired Behavior

- A feedback item should appear once per release group.
- Version/platform badges should accumulate on that one entry.
- Release group ordering, release status badges, and release metadata must remain unchanged.

## Recommended Approach

Aggregate duplicate feedback rows inside `useReleaseGroups` by `feedback.id` within each release group and expose `target_platforms: string[]` instead of a single `target_platform`.

This keeps data shaping close to the query result, avoids duplicate-prone view models, and keeps the page component focused on rendering.

## Testing

- Add a failing test first for the aggregation behavior in `src/hooks/useReleases`.
- Verify that two targets for the same feedback item in the same release group produce one item with both platforms.
- Update rendering to show multiple badges for the aggregated item.
