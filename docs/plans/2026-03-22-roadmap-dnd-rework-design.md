# Roadmap Drag And Drop Rework Design

## Goal

Fix roadmap drag-and-drop reliability and replace the current drop-zone-based interaction with a sortable board that:

- uses manual ordering as the only roadmap ordering model
- removes the roadmap sort dropdown
- shows a visible insertion preview while dragging
- lets admins drag a card from anywhere on the card surface

## Current Context

The roadmap feature already exists, with:

- a public roadmap page in `src/pages/Roadmap.tsx`
- board and lane components in `src/components/roadmap/`
- persisted `feedback.roadmap_position`
- admin drag/drop support implemented with native HTML drag events

The current interaction mixes lane-level drop targets and small in-between drop zones. This is brittle, does not always resolve the intended destination correctly, and does not provide a strong preview of where the card will land.

## Product Decisions

### Ordering Model

- Roadmap ordering is manual only.
- Remove the roadmap sort dropdown entirely.
- The roadmap page no longer stores or reads a roadmap sort preference.
- The roadmap renders each lane by persisted `roadmap_position`.
- `status` continues to define lane membership.

### Legacy Data

- Existing rows that have null, duplicate, or otherwise unusable `roadmap_position` values should still render deterministically.
- For those rows, derive a stable initial order from the current lane order once.
- After that, admin drag-and-drop becomes the source of truth for ordering.

### Drag Interaction

- Use a dedicated sortable drag-and-drop library instead of native drag events.
- The entire roadmap card is draggable for admins, not just a handle.
- Non-admins continue to see the same board, but without drag behavior.
- While dragging, the board must show a clear insertion preview and visually move cards out of the way.
- Same-lane reorder and cross-lane moves must both be supported.

## Recommended Library

Use `@dnd-kit`:

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`

This fits the current React architecture, supports multi-container sortable boards, and handles full-card dragging, collision detection, drag overlays, and sortable previews without forcing a custom event model.

## UI Architecture

### Roadmap Page

- Keep `src/pages/Roadmap.tsx` as the page shell.
- Remove the roadmap sort selector and its local state.
- The roadmap page should pass the normalized lane data into the board and handle the mutation result as it does today.

### Roadmap Board

- Refactor `src/components/roadmap/RoadmapBoard.tsx` to own drag session state from `@dnd-kit`.
- Replace the current `dragState` and `onDropAt` wiring with sortable lane and card contexts.
- Compute optimistic board state directly from lane arrays and the current drag destination.
- Render a drag overlay or sortable placeholder so the target position is obvious during drag.

### Roadmap Lanes

- Refactor `src/components/roadmap/RoadmapLane.tsx` into a droppable sortable container.
- Remove explicit drop strips and lane-level native drop handlers.
- Each lane renders its ordered items and accepts cross-lane insertions via the sortable context.

### Roadmap Cards

- Keep the current list-card parity content in `src/components/roadmap/RoadmapCard.tsx`.
- Add sortable wiring to the card container so the whole card is draggable for admins.
- Preserve in-place vote behavior, comment count display, and detail-page linking.

## Data Flow

### Reads

- Roadmap rendering should stop using popularity/date/version sorting.
- Add a helper in `src/lib/feedbackOverview.ts` or a roadmap-specific utility that:
  - buckets items by status
  - sorts each lane strictly by `roadmap_position`
  - applies a deterministic fallback for missing or conflicting positions

### Writes

- Keep persistence in `src/hooks/useFeedback.ts`.
- Reuse the existing roadmap move mutation entry point, but treat the destination lane index as the only ordering input from the UI.
- Same-lane moves update sibling positions only.
- Cross-lane moves update both `status` and lane positions.
- Mutation failure reverts the optimistic board state and shows the existing toast.

## Local Storage

- Remove roadmap sort persistence from `src/lib/roadmapPreferences.ts`.
- Keep grouped-list local-storage behavior untouched.

## Error Handling

- Cancelled drags leave the board unchanged.
- Non-admin users must never get draggable semantics.
- Cards must still allow vote and link interactions after sortable behavior is added.
- If `@dnd-kit` cannot resolve a valid destination, the board should snap back to the pre-drag state.

## Testing Strategy

Add or update tests for:

- roadmap lane ordering driven only by `roadmap_position`
- deterministic normalization of null or duplicate `roadmap_position` values
- removal of roadmap sort UI and storage usage
- same-lane reorder through sortable drag interactions
- cross-lane moves through sortable drag interactions
- visible insertion preview or displaced-card behavior during drag
- non-admin read-only roadmap rendering
- preserved vote/comment behavior on roadmap cards

Required verification for the implementation:

- `npm test`
- `npm run build`
- `npm run supabase:db:push` only if any additional schema work is introduced
- `npm run supabase:functions:deploy` only if any function changes are introduced
