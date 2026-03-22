# Roadmap And Grouped State Design

## Goal

Add two complementary planning views for feedback items:

- an optional grouped-by-state mode on the existing feedback list page
- a separate public roadmap page with one vertical swimlane per state

The roadmap must be readable by everyone and editable by admins through drag and drop.

## Current Context

The app currently has:

- a public feedback list at `src/pages/AppFeedback.tsx`
- a changelog page at `src/pages/Changelog.tsx`
- feedback sorting and filtering logic in `src/lib/feedbackOverview.ts`
- status updates handled through `useUpdateFeedbackStatus` in `src/hooks/useFeedback.ts`

There is no persisted per-lane ordering field for roadmap cards, no public roadmap route, and no grouped-by-state list mode.

## Product Decisions

### Existing Feedback Page

- The current flat list remains the default.
- Add a `Group by state` switch on the feedback page.
- When grouping is enabled, the filtered list is rendered as state sections in this order:
  - `open`
  - `planned`
  - `progress`
  - `completed`
  - `wont_do`
- Each section is expandable/collapsible.
- On first load, `completed` and `wont_do` are collapsed by default, while the other sections are expanded.
- The grouped-list enabled state and each section's expansion state are saved in local storage per app slug.
- Grouped sections continue using the same filter and sort controls as the list page.

### Roadmap Page

- Add a separate public route at `/app/:slug/roadmap`.
- Link to it alongside the changelog from the app header area.
- The roadmap always shows all items, split into one vertical swimlane per status.
- The roadmap has its own sort selector and persisted sort preference, separate from the list page.
- Anyone can view the roadmap.
- Only admins can drag and drop cards.
- Dragging supports:
  - moving a card to a different status lane
  - reordering within the same lane
- When a card is moved to a new lane, it is inserted at the end of that lane by default unless the drag target places it elsewhere during the same interaction.

## Data Model

Persisted lane ordering is required so the public roadmap shows the same order for everyone.

### Recommended Schema Change

Add a new numeric ordering column on `public.feedback`, for example `roadmap_position`.

This keeps roadmap ordering attached to the feedback item itself, avoids a second table, and makes drag operations a single-row update in most cases plus targeted reindexing for neighboring cards when needed.

### Type Updates

The following types must be updated when the schema changes:

- `src/types/database.ts`
- `src/types/index.ts`

## UI Architecture

### Feedback List Grouping

- Keep `src/pages/AppFeedback.tsx` as the page shell.
- Extract state grouping and default expansion logic into `src/lib/feedbackOverview.ts` or a nearby utility file.
- Reuse the existing feedback cards for grouped sections.
- Use the existing collapsible/accordion UI primitives in `src/components/ui/`.

### Roadmap

- Create a dedicated roadmap page component, for example `src/pages/Roadmap.tsx`.
- Build lane and card rendering with reusable components, for example:
  - `src/components/roadmap/RoadmapBoard.tsx`
  - `src/components/roadmap/RoadmapLane.tsx`
  - `src/components/roadmap/RoadmapCard.tsx`
- Reuse the existing feedback query and card metadata where possible, but keep drag interaction logic isolated from the list page.

## Data Flow

### Reads

- Continue to use `useFeedback(app?.id)` as the source for public feedback items.
- Add shared utilities to:
  - bucket items by status
  - sort items for list mode
  - sort roadmap lanes using persisted order plus the selected roadmap sort mode where applicable

### Writes

- Keep mutations in hooks, not page components.
- Add a roadmap-specific mutation in `src/hooks/useFeedback.ts` for admin drag-and-drop updates.
- The mutation must update:
  - the feedback item's `status`
  - its `roadmap_position`
  - any affected sibling positions needed to preserve lane order
- The mutation should invalidate the feedback query so the list page and roadmap stay in sync.

## Local Storage

Persist preferences per app slug using dedicated keys:

- list sort mode: existing key remains unchanged
- grouped-list enabled state
- grouped-list section expansion map
- roadmap sort mode

Roadmap preferences must not overwrite list preferences.

## Error Handling

- Drag failures must revert the optimistic board move and show an error toast.
- Non-admin users must not get drag handles or draggable semantics.
- Empty lanes should still render a visible drop area for admins.

## Testing Strategy

Add or update tests for:

- state grouping utility behavior
- grouped-list default expansion rules
- local-storage persistence for grouped-list settings
- roadmap lane assembly
- roadmap sorting behavior
- admin same-lane reordering
- admin cross-lane moves
- non-admin read-only roadmap rendering

Required verification for the implementation:

- `npm test`
- `npm run build`
- `npm run supabase:db:push`
- `npm run supabase:functions:deploy`

The Supabase commands are only required if schema/function changes are present and the project is linked/runnable in the local environment.
