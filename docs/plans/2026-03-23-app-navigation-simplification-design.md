# App Navigation Simplification Design

## Goal

Reduce header clutter on the app feedback pages by separating page navigation from page actions.

The target state is:

- one primary action: `New Feedback`
- one shared app-level navigation row: `Feedback`, `Roadmap`, `Changelog`
- the same navigation pattern across the feedback list, roadmap, and changelog pages
- a mobile-friendly navigation pattern that keeps these destinations visible without a separate drawer

## Current Problem

The feedback list header currently exposes four peer buttons:

- `Changelog`
- `Roadmap`
- `Create Feature`
- `Create Bug`

This overloads the header with mixed concepts:

- `Changelog` and `Roadmap` are page destinations
- `Create Feature` and `Create Bug` are actions

Treating them with the same visual weight makes the UI harder to scan and weakens the hierarchy.

## Product Decisions

### Information Architecture

- `Feedback`, `Roadmap`, and `Changelog` are app-level destinations.
- They should be presented as local navigation, not as standalone action buttons.
- `Create Feature` and `Create Bug` should be consolidated into a single `New Feedback` entry point.

### Feedback Creation Flow

- `New Feedback` becomes the only primary CTA in the app header area.
- The feedback type selection (`Feature` vs `Bug`) moves into the dialog flow rather than being chosen from separate header buttons.
- No feedback capability is removed; only the launch path changes.

### Mobile Navigation

- Do not introduce a separate hamburger or drawer just for these three app-level destinations.
- Use a horizontally scrollable local navigation row on small screens.
- Keep the active destination visibly highlighted on all screen sizes.

## UI Architecture

### Shared App Header

Introduce a shared app-level header/navigation component used by:

- `src/pages/AppFeedback.tsx`
- `src/pages/Roadmap.tsx`
- `src/pages/Changelog.tsx`

This shared shell should render:

- the back link
- app identity (logo, name, description where applicable)
- the optional `New Feedback` CTA
- the local app navigation row

### Desktop Layout

On larger screens:

- app identity stays on the left
- `New Feedback` sits on the right
- the local nav appears as a row below the header content

This keeps navigation separate from actions and makes the page hierarchy easier to parse.

### Mobile Layout

On smaller screens:

- keep the app identity and `New Feedback` button in the top content block
- render the same local nav as a horizontally scrollable tab row beneath

This avoids hiding key destinations while still keeping the layout compact.

## Interaction Design

### Local Navigation

- The nav should show `Feedback`, `Roadmap`, and `Changelog`.
- The active page should use clear visual emphasis.
- The same component and ordering should be reused on every app-level page.

### New Feedback Action

- The feedback page should no longer show separate `Create Feature` and `Create Bug` buttons.
- `New Feedback` should open the feedback dialog in a neutral entry state.
- The dialog flow should ask the user to choose `Feature` or `Bug` inside the modal before or as part of the form.

## Data And State

- No backend or schema changes are needed.
- Existing feedback creation hooks can stay in place.
- Any existing dialog state that assumes a preselected type will need a neutral/default launch path.

## Error Handling

- Pages without the `New Feedback` action should still render the local navigation consistently.
- The dialog should not open in an invalid state if no type is preselected.
- Mobile overflow for the nav row should remain keyboard accessible and not clip the active state.

## Testing Strategy

Add or update tests for:

- shared app navigation rendering on feedback, roadmap, and changelog pages
- correct active nav item on each page
- removal of separate `Create Feature` / `Create Bug` header buttons
- presence of the single `New Feedback` action
- feedback dialog launch flow still supporting both `Feature` and `Bug`

Required verification for implementation:

- `npm test`
- `npm run build`
