# Feedback Item Keys Design

## Goal

Give every feedback item a short, human-readable key in Jira style, e.g. `INTAKE-42`, so items can be referenced when talking to the agent ("set INTAKE-42 to planned") and in commit messages ("fix: crash on save (INTAKE-42)") instead of UUIDs.

## Product Decisions (from Tobias)

- Each app has its own short key prefix (e.g. `INTAKE`), editable by the admin. When none is set explicitly, it is derived from the app's slug.
- Keys are composed from the app's current prefix plus the item number. Prefixes are not expected to change; if one does, old keys stop resolving. No alias history.
- Existing items get keys too (backfilled by the migration).
- Keys work in URLs: `/app/:slug/INTAKE-42`. Existing UUID URLs keep working.
- Keys are searchable in the app.
- Keys appear in notification emails.

## Non-Goals

- Renaming history / aliases for old prefixes.
- Changing the agent's or UI's use of UUIDs internally; UUID remains the primary key everywhere.
- Global (cross-app) numbering.

## Data Model

New migration in `supabase/migrations/` (append-only).

### `apps.item_key`

- `text NOT NULL`, unique.
- Format: `^[A-Z][A-Z0-9]{1,9}$` (2-10 chars, uppercase letters/digits, starts with a letter; no hyphen so `KEY-N` parses unambiguously by splitting on the last `-`). Enforced by a CHECK constraint.
- "Default from slug" is implemented as a prefill, not a nullable fallback (builder's call, see below): on create, if no key is supplied, a `BEFORE INSERT` trigger sets `item_key = derive(slug)`. Backfill for existing apps uses the same derivation.
- `derive(slug)`: uppercase, strip every non `[A-Z0-9]` char, prefix `X` if it starts with a digit or is shorter than 2 chars (pad with `X` until 2 chars), truncate to 10 chars. If that collides with an existing key, append `2`, `3`, ... (re-truncating to keep length <= 10).

### `apps.next_item_number`

- `integer NOT NULL DEFAULT 1`. Per-app counter. Never decremented, so numbers are never reused, even after deletion.

### `feedback.number`

- `integer NOT NULL`, `UNIQUE (app_id, number)`.
- Assigned by a `BEFORE INSERT` trigger on `feedback`, `SECURITY DEFINER` (anonymous users insert feedback, but cannot update `apps`):
  `UPDATE apps SET next_item_number = next_item_number + 1 WHERE id = NEW.app_id RETURNING next_item_number - 1 INTO NEW.number;`
  The row lock on `apps` serializes concurrent inserts per app. Any client-supplied `number` is overwritten (the "Anyone can create feedback" policy must not let users pick numbers).
- A `BEFORE UPDATE` trigger keeps `number` immutable (`NEW.number := OLD.number`).
- Backfill: per app, `row_number() OVER (PARTITION BY app_id ORDER BY created_at, id)`; then set each app's `next_item_number = max(number) + 1` (or 1 for apps without items). Add the NOT NULL / UNIQUE constraints after backfill.

### Types

Update `src/types/database.ts` (`apps.item_key`, `apps.next_item_number`, `feedback.number`) and the app-level `App` / `Feedback` types.

## Shared Key Logic

`src/lib/itemKey.ts` (pure, unit-tested), with a Deno-importable twin or shared copy for edge functions (`supabase/functions/_shared/itemKey.ts` if the build allows importing; otherwise duplicated with identical tests):

- `formatItemKey(appKey, number) -> "INTAKE-42"`
- `parseItemKey(input) -> { appKey, number } | null` - case-insensitive, trims whitespace, splits on the last `-`.
- `isUuid(input)`.

## Frontend

- **Display:** key shown on `FeedbackCard`, `RoadmapCard`, the `FeedbackDetail` header, and changelog item rows, as a muted monospace label (e.g. `INTAKE-42`) before the title. A click-to-copy on the detail page is the builder's call.
- **Links:** all internal item links (`FeedbackCard.tsx`, `RoadmapCard.tsx`, `Changelog.tsx`) switch to `/app/${slug}/${key}`.
- **Routing:** `/app/:slug/:id` stays. `FeedbackDetail` resolves `:id`: UUID -> fetch by id (as today); parsed key -> fetch by `app_id` (from slug) + `number`. The key's prefix must match the app's current `item_key`, otherwise not found. Resolution lives in `useFeedbackItem` (hook), not in the page. Downstream hooks that take the UUID (`useComments`, `useAttachments`, release targets) use the resolved `item.id`.
- **Admin:** app create/edit dialog in `Admin.tsx` gains a "Key" field: prefilled live from the slug while creating (until the user edits it), validated against the format, uniqueness error surfaced from the DB. Helper text shows an example key.
- **Search:** there is currently no text search on the feedback overview. Add a search input to `AppFeedback` filtering client-side via `filterAndSortFeedback`: a query that parses as a key (or a bare number, e.g. `42` / `#42`) matches by number; otherwise case-insensitive substring match on title and description. Typing an exact key that exists could navigate directly - builder's call; filtering to one result is the minimum.

## Agent (MCP server)

- Every tool taking an item `id` (`get_feedback`, `update_status`, `set_version`, `add_comment`) accepts either a UUID or a key. Zod schema becomes `z.string()` with description "Feedback item id (UUID) or key, e.g. 'INTAKE-42'". A `resolveFeedbackId(client, input)` helper in `tools.ts` returns the UUID or a helpful error ("No feedback item 'INTAKE-999'. Use list_feedback to find valid keys.").
- All feedback payloads returned by tools include `key` (add `number` to `FEEDBACK_COLUMNS` and compose `key` from the app's `item_key`). `list_apps` returns `item_key`.
- Update `docs/agent-api.md` and the MCP tool descriptions so the agent knows keys are preferred in conversation.

## Emails

`send-notification` receives `feedback.number` and the app's `item_key` in the payload (callers in `src/hooks/*` and `mcp-server/tools.ts` updated). Subjects become e.g. `[INTAKE-42] New Feature Request: <title>` and `Your feature request INTAKE-42 is now Planned`; bodies show the key next to the title; `feedbackUrl` uses the key form. If either field is missing (old caller), fall back to the current text and UUID URL.

## Release Semantics

No change to release/changelog logic. The changelog view/queries only gain `number` for display; per-platform targets, `all`, and published/planned state are untouched.

## Testing

- `src/lib/itemKey.test.ts`: format/parse (case, whitespace, last-hyphen split, invalid input), slug derivation incl. digits-first and truncation.
- `useFeedbackItem` resolves both UUID and key; key with wrong prefix -> not found.
- `filterAndSortFeedback` search: key, bare number, `#n`, text.
- `FeedbackCard` / detail render the key; links use the key form.
- Admin dialog: key prefill from slug, format validation.
- MCP `tools.test.ts`: `resolveFeedbackId` (UUID, key, unknown key, wrong prefix), tool outputs include `key`.
- Migration verified against local Supabase (`supabase db reset`): backfill ordering, counter continues after backfill, concurrent-safe insert path, client-supplied `number` ignored, `number` immutable on update.
- `send-notification`: subject/body/URL with and without key fields.
- Required: `npm test`, `npm run build`, `npm run supabase:db:push`, `npm run supabase:functions:deploy`; E2E: create an item, check its key in UI, URL, email, and via the agent.

## Builder's Calls

- Prefill on create instead of a nullable column with runtime fallback (keeps uniqueness enforceable in the DB).
- Key format and slug derivation rules above.
- Visual treatment of the key label.
- Search UI placement and whether an exact key match navigates directly.
