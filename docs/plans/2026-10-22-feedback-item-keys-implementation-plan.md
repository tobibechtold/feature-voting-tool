# Feedback Item Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every feedback item gets a Jira-style key (`INTAKE-42`) usable in the UI, URLs, search, the agent MCP tools, and notification emails.

**Architecture:** The DB stores a per-app `apps.item_key` prefix plus a per-app sequential `feedback.number` (assigned by trigger, backfilled); the key is always composed as `${item_key}-${number}`. One pure TS module (`supabase/functions/_shared/itemKey.ts`) owns format/parse/derive and is re-exported to the frontend. UUID stays the primary key everywhere; keys are resolved to UUIDs at the edges (route, MCP tool input).

**Tech Stack:** Supabase Postgres (migrations, triggers, pgTAP via `supabase test db`), React 18 + TanStack Query, Vitest, Deno edge functions.

**Spec:** `docs/plans/2026-10-22-feedback-item-keys-design.md`

## Global Constraints

- Key prefix format: `^[A-Z][A-Z0-9]{1,9}$` (2-10 chars, uppercase letters/digits, starts with a letter, no hyphen).
- Key string: `${item_key}-${number}`; parsing is case-insensitive, trims whitespace, splits on the last `-`.
- Slug derivation: uppercase, strip every non `[A-Z0-9]` char, prefix `X` if it starts with a digit, pad with `X` to 2 chars, truncate to 10. On collision append `2`, `3`, ... re-truncating the base so the total stays <= 10.
- Numbers start at 1 per app, never reused, immutable; backfill order `created_at, id`.
- Old UUID URLs and UUID MCP inputs keep working.
- Migrations are append-only; do not edit old migration files.
- Release/changelog semantics unchanged (per-platform targets, `all`, published vs planned).
- ASCII only in edited files.
- No PII (`submitter_email`, `notify_on_updates`) in MCP output.

## Review Focus

1. Anonymous user inserts feedback with a forged `number` -> the trigger overwrites it with the next counter value (Task 1, pgTAP).
2. Lowercase / padded key in URL or agent input (`/app/intake/intake-42`, `" INTAKE-42 "`) -> resolves to the same item (Tasks 2, 3, 6).
3. Key with another app's prefix under this app's slug (`/app/intake/FOO-42`) -> not found, never another app's item (Tasks 3, 6).
4. Two apps whose slugs derive to the same key (`roadmap-tool`, `roadmaptool`) -> second gets `ROADMAPTO2`, both inserts succeed (Task 1, pgTAP: add `insert roadmap-tool, roadmaptool -> 'ROADMAPTOO', 'ROADMAPTO2'`).
5. Notification payload from an old caller without `number`/`appKey` -> email still sends with the current subject and UUID URL (Task 7).

---

### Task 1: Schema - item keys and numbers

**Files:**
- Create: `supabase/migrations/20261022120000_add_feedback_item_keys.sql`
- Create: `supabase/tests/item_keys_test.sql` (pgTAP)
- Modify: `src/types/database.ts` (`apps` Row/Insert/Update, `feedback` Row/Insert/Update)
- Modify: `src/types/index.ts` (`App.item_key: string`, `FeedbackItem.number: number`)

**Interfaces:**
- Produces: columns `apps.item_key text NOT NULL UNIQUE`, `apps.next_item_number integer NOT NULL DEFAULT 1`, `feedback.number integer NOT NULL`, `UNIQUE (app_id, number)`; SQL function `public.derive_item_key(p_slug text) returns text` (base derivation incl. collision suffix against existing rows).
- In `database.ts`: `item_key` optional in `apps.Insert`; `number` and `next_item_number` optional in Insert/Update types.

- [ ] **Step 1: Start local Supabase**

Run: `supabase start && supabase db reset`
Expected: existing migrations apply cleanly.

- [ ] **Step 2: Write the failing pgTAP test** `supabase/tests/item_keys_test.sql` (`begin; select plan(n); ... select * from finish(); rollback;`). Assertions:
  - `has_column('public','apps','item_key')`, `has_column('public','feedback','number')`
  - run before any app inserts: `derive_item_key('roadmap-tool') = 'ROADMAPTOO'` (truncated to 10); `derive_item_key('intake') = 'INTAKE'`; `derive_item_key('9lives') = 'X9LIVES'`; `derive_item_key('a') = 'AX'`
  - insert app slug `intake` without key -> `item_key = 'INTAKE'`; insert app slug `in-take` -> `item_key = 'INTAKE2'`
  - insert app with explicit `item_key = 'abc'` -> throws (`check_violation`); `item_key = 'A-B'` -> throws
  - insert 3 feedback rows into one app -> numbers `1,2,3`; insert into a second app -> `1`
  - insert feedback with `number = 999` -> stored number is next counter value, not 999
  - delete the feedback with number 3, insert another -> number `4`
  - `update feedback set number = 50` -> number unchanged
  - insert feedback as role `anon` (`set local role anon`) succeeds and gets a number (trigger is SECURITY DEFINER)

- [ ] **Step 3: Run to verify it fails**

Run: `supabase test db`
Expected: FAIL (columns/function missing).

- [ ] **Step 4: Write the migration**

Order inside the file:
1. `alter table apps add column item_key text, add column next_item_number integer not null default 1;`
2. `create function public.derive_item_key(p_slug text) returns text` (plpgsql, `stable`): base per Global Constraints; while `exists (select 1 from apps where item_key = candidate)` try suffixes `2..` with `left(base, 10 - length(suffix)) || suffix`.
3. Backfill apps: loop `for r in select id, slug from apps order by created_at, id` -> `update apps set item_key = derive_item_key(r.slug) where id = r.id` (sequential so collisions see earlier rows).
4. `alter table apps alter column item_key set not null`, `add constraint apps_item_key_key unique (item_key)`, `add constraint apps_item_key_format check (item_key ~ '^[A-Z][A-Z0-9]{1,9}$')`.
5. Trigger `apps_set_item_key` BEFORE INSERT on apps: `if new.item_key is null then new.item_key := derive_item_key(new.slug); end if;`
6. `alter table feedback add column number integer;` backfill with `row_number() over (partition by app_id order by created_at, id)`; `update apps set next_item_number = coalesce((select max(number) from feedback where app_id = apps.id), 0) + 1;` then `set not null` and `add constraint feedback_app_id_number_key unique (app_id, number)`.
7. Function `public.assign_feedback_number()` `security definer set search_path = public`; BEFORE INSERT trigger `feedback_assign_number`: `update apps set next_item_number = next_item_number + 1 where id = new.app_id returning next_item_number - 1 into new.number;`
8. Function `public.keep_feedback_number()`; BEFORE UPDATE trigger `feedback_keep_number`: `new.number := old.number;`

- [ ] **Step 5: Run tests**

Run: `supabase db reset && supabase test db`
Expected: PASS.

- [ ] **Step 6: Update `src/types/database.ts` and `src/types/index.ts`** per Interfaces. Run `npm run build` - expected PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261022120000_add_feedback_item_keys.sql supabase/tests/item_keys_test.sql src/types/database.ts src/types/index.ts
git commit -m "feat(db): add per-app item keys and feedback numbers"
```

---

### Task 2: Shared item key module

**Files:**
- Create: `supabase/functions/_shared/itemKey.ts` (pure TS, no imports - Deno and Vitest both load it)
- Create: `supabase/functions/_shared/itemKey.test.ts`
- Create: `src/lib/itemKey.ts` (`export * from '../../supabase/functions/_shared/itemKey.ts';` plus the frontend-only helper below)
- Create: `src/lib/itemKey.test.ts`

**Interfaces:**
- Produces (shared):
  - `ITEM_KEY_PATTERN: RegExp` (`/^[A-Z][A-Z0-9]{1,9}$/`)
  - `formatItemKey(appKey: string, number: number): string`
  - `parseItemKey(input: string): { appKey: string; number: number } | null` (uppercases appKey; number must be a positive integer; appKey must match `ITEM_KEY_PATTERN`)
  - `isUuid(input: string): boolean`
  - `deriveItemKey(slug: string): string` (base derivation only, no collision suffix - mirrors the SQL base)
  - `isValidItemKey(key: string): boolean`
- Produces (frontend, `src/lib/itemKey.ts`):
  - `type FeedbackLookup = { by: 'id'; id: string } | { by: 'number'; appId: string; number: number } | { by: 'none' }`
  - `resolveFeedbackLookup(idOrKey: string | undefined, app: { id: string; item_key: string } | null | undefined): FeedbackLookup`

- [ ] **Step 1: Write failing tests** in `itemKey.test.ts` (shared):
  - `formatItemKey('INTAKE', 42) === 'INTAKE-42'`
  - `parseItemKey('INTAKE-42')` -> `{ appKey: 'INTAKE', number: 42 }`; `parseItemKey(' intake-42 ')` -> same; `parseItemKey('INTAKE-0')`, `parseItemKey('INTAKE-')`, `parseItemKey('42')`, `parseItemKey('A-B-1')`, `parseItemKey('INTAKE-4x')` -> `null`
  - `isUuid('3f2b...')` true for a v4 uuid, false for `'INTAKE-42'`
  - `deriveItemKey('roadmap-tool') === 'ROADMAPTOO'`, `deriveItemKey('intake') === 'INTAKE'`, `deriveItemKey('9lives') === 'X9LIVES'`, `deriveItemKey('a') === 'AX'`
  - `isValidItemKey('INTAKE')` true; `'abc'`, `'A'`, `'A-B'`, `'ABCDEFGHIJK'` false

  and in `src/lib/itemKey.test.ts`:
  - uuid input -> `{ by: 'id', id }` even when `app` is undefined
  - `'intake-7'` with app `{ id: 'a1', item_key: 'INTAKE' }` -> `{ by: 'number', appId: 'a1', number: 7 }`
  - `'FOO-7'` with that app -> `{ by: 'none' }`; key with `app` undefined -> `{ by: 'none' }`; `undefined` -> `{ by: 'none' }`

- [ ] **Step 2: Run to verify fail**: `npx vitest run supabase/functions/_shared/itemKey.test.ts src/lib/itemKey.test.ts` - FAIL (module not found).
- [ ] **Step 3: Implement** both files per Interfaces.
- [ ] **Step 4: Run** same command - PASS. Then `npm run build` - PASS (confirms Vite resolves the cross-folder import).
- [ ] **Step 5: Commit** `feat: add shared item key helpers`

---

### Task 3: Resolve keys in item URLs

**Files:**
- Modify: `src/hooks/useFeedback.ts` (`useFeedbackItem`)
- Modify: `src/pages/FeedbackDetail.tsx:51-62`
- Test: `src/hooks/useFeedback.item-lookup.test.tsx`

**Interfaces:**
- Consumes: `resolveFeedbackLookup` (Task 2).
- Produces: `useFeedbackItem(idOrKey: string | undefined, app: Pick<App, 'id' | 'item_key'> | null | undefined)`; query key `['feedback', 'item', lookup]`; enabled only when `lookup.by !== 'none'`; returns `null` (not found) when `idOrKey` is a key that resolves to `by: 'none'` once `app` is loaded.

- [ ] **Step 1: Write failing tests** (mock `publicSupabase` like `useFeedback.roadmap-mutation.test.ts`):
  - uuid -> query uses `.eq('id', uuid)`
  - `'intake-7'` with app `{ id: 'a1', item_key: 'INTAKE' }` -> query uses `.eq('app_id','a1')` and `.eq('number', 7)`
  - `'FOO-7'` with that app -> no query issued, `data` is `null`
- [ ] **Step 2: Run** `npx vitest run src/hooks/useFeedback.item-lookup.test.tsx` - FAIL.
- [ ] **Step 3: Implement** the hook change. In `FeedbackDetail`, pass `app` to `useFeedbackItem(id, app)`; every downstream hook that takes the feedback UUID (`useComments`, `useAttachments`, `useFeedbackReleaseTargets`) gets `item?.id` instead of the route param.
- [ ] **Step 4: Run** test - PASS; `npm test` - PASS.
- [ ] **Step 5: Commit** `feat: open feedback items by key in URL`

---

### Task 4: Show keys and link by key

**Files:**
- Create: `src/components/ItemKeyLabel.tsx`, `src/components/ItemKeyLabel.test.tsx`
- Modify: `src/components/FeedbackCard.tsx`, `src/components/roadmap/RoadmapCard.tsx`, `src/components/roadmap/RoadmapLane.tsx`, `src/components/roadmap/RoadmapBoard.tsx`, `src/components/feedback/FeedbackStateSections.tsx`, `src/pages/AppFeedback.tsx`, `src/pages/Roadmap.tsx`, `src/pages/FeedbackDetail.tsx`, `src/pages/Changelog.tsx:302`, `src/hooks/useReleases.ts` (nested `feedback:feedback_id (...)` select gains `number`)
- Test: extend `src/pages/AppFeedback.test.tsx`, `src/pages/Changelog.test.tsx`

**Interfaces:**
- Consumes: `formatItemKey` (Task 2), `App.item_key`, `FeedbackItem.number` (Task 1).
- Produces: `ItemKeyLabel({ appKey: string; number: number; className?: string })` renders the key in `font-mono text-xs text-muted-foreground`. New prop `appKey: string` threaded next to every existing `appSlug` prop on the cards/lanes/board/sections.

- [ ] **Step 1: Write failing tests**:
  - `ItemKeyLabel` with `appKey='INTAKE' number={42}` renders text `INTAKE-42`
  - `AppFeedback.test.tsx`: item card shows `INTAKE-42` and its link `href` is `/app/intake/INTAKE-42`
  - `Changelog.test.tsx`: item row link `href` uses the key form
- [ ] **Step 2: Run** those tests - FAIL.
- [ ] **Step 3: Implement**: label before the title on `FeedbackCard`, `RoadmapCard`, `FeedbackDetail` header, changelog rows; all item links become `/app/${slug}/${formatItemKey(appKey, item.number)}`.
- [ ] **Step 4: Run** `npm test` - PASS.
- [ ] **Step 5: Commit** `feat: show item keys and link items by key`

---

### Task 5: Search feedback by key or text

**Files:**
- Modify: `src/lib/feedbackOverview.ts` (`FilterAndSortOptions`, `filterAndSortFeedback`)
- Modify: `src/pages/AppFeedback.tsx` (search input above the filter tabs)
- Modify: `src/lib/i18n.ts` (`searchFeedback`: en `'Search by key or text'`, de `'Nach Schluessel oder Text suchen'`)
- Test: `src/lib/feedbackOverview.test.ts` (create if absent), `src/pages/AppFeedback.test.tsx`

**Interfaces:**
- Consumes: `parseItemKey` (Task 2).
- Produces: `FilterAndSortOptions` gains `searchQuery?: string; appKey?: string`. Matching: empty/whitespace -> no filter; `parseItemKey(q)` with `appKey` equal to `options.appKey` -> `item.number === n`, with other appKey -> no matches; `/^#?\d+$/` -> `item.number === n`; otherwise case-insensitive substring of `title` or `description`.

- [ ] **Step 1: Write failing tests** (items numbered 1..3, app key `INTAKE`): `'INTAKE-2'`, `'intake-2'`, `'2'`, `'#2'` -> only item 2; `'FOO-2'` -> none; `'crash'` matches title `'App Crash'` and description containing `'CRASH'`; `''` -> all. Page test: typing `INTAKE-2` in the search box leaves one card.
- [ ] **Step 2: Run** - FAIL.
- [ ] **Step 3: Implement** matching in `filterAndSortFeedback`; page holds `searchQuery` state and passes `appKey: app.item_key`. Exact-match navigation is out of scope.
- [ ] **Step 4: Run** `npm test` - PASS.
- [ ] **Step 5: Commit** `feat: search feedback by key or text`

---

### Task 6: App key in admin

**Files:**
- Create: `src/components/AppKeyField.tsx`, `src/components/AppKeyField.test.tsx`
- Modify: `src/pages/Admin.tsx` (form state, create/edit submit), `src/hooks/useApps.ts` (`useCreateApp`/`useUpdateApp` accept `item_key?: string`), `src/lib/i18n.ts` (`appKey`: en `'Item key'`, de `'Eintragsschluessel'`; `appKeyInvalid`: en `'2-10 uppercase letters or digits, starting with a letter'`, de equivalent; `appKeyTaken`: en `'This key is already used by another app'`)

**Interfaces:**
- Consumes: `deriveItemKey`, `isValidItemKey`, `formatItemKey` (Task 2).
- Produces: `AppKeyField({ value: string; onChange(value: string): void; error?: string })` - input uppercases on change, shows helper `Example: ${formatItemKey(value || 'KEY', 42)}`, shows `error` when given.

- [ ] **Step 1: Write failing tests**: typing `intake` calls `onChange('INTAKE')`; helper shows `Example: INTAKE-42`; `error` prop text is rendered.
- [ ] **Step 2: Run** - FAIL.
- [ ] **Step 3: Implement** the component and wire it in `Admin.tsx`: when creating, key follows `deriveItemKey(slug)` until the user edits the key field (`keyTouched` state); when editing, prefill `app.item_key`. Block submit with `appKeyInvalid` if `!isValidItemKey`. Map Postgres unique violation (`error.code === '23505'` mentioning `apps_item_key_key`) to `appKeyTaken`.
- [ ] **Step 4: Run** `npm test` - PASS.
- [ ] **Step 5: Commit** `feat: edit app item key in admin`

---

### Task 7: Keys in notification emails

**Files:**
- Create: `supabase/functions/send-notification/emails.ts`, `supabase/functions/send-notification/emails.test.ts`
- Modify: `supabase/functions/send-notification/index.ts` (handler calls `buildNotificationEmail`, then `sendEmail`)
- Modify: `src/lib/notificationService.ts` (payload `feedback.number?: number`, `appKey?: string`), `src/hooks/useFeedback.ts` (create + status change), `src/hooks/useComments.ts`, and their page callers to pass `appKey`

**Interfaces:**
- Consumes: `formatItemKey` from `../_shared/itemKey.ts`.
- Produces: `buildNotificationEmail(req: NotificationRequest, opts: { baseUrl: string; adminEmail: string }): { to: string[]; subject: string; html: string } | null` (null = no email, same conditions as today). `NotificationRequest` moves to `emails.ts`, gains `feedback.number?: number` and `appKey?: string`.

Copy (with key `K` = `formatItemKey(appKey, number)`; when either is missing use today's exact subjects/URL):
- new_feedback: `[K] New Feature Request: <title>`
- status_change: `Your feature request K is now Planned`
- admin_comment: `Admin replied to your feature request K`
- admin_reply_to_comment: `Admin replied on K "<title>"`
- Bodies: wherever the title appears, render `K: <title>`. URL: `${baseUrl}/app/${appSlug}/K`.

- [ ] **Step 1: Write failing tests**: one per type with key fields (subject, `to`, URL in html); one per type without key fields asserting the current subject and UUID URL; `status_change` without opt-in -> `null`.
- [ ] **Step 2: Run** `npx vitest run supabase/functions/send-notification/emails.test.ts` - FAIL.
- [ ] **Step 3: Implement** `emails.ts`, slim `index.ts` to parse -> build -> send; add `number`/`appKey` to all frontend callers (the inserted/updated rows already carry `number`).
- [ ] **Step 4: Run** `npm test` - PASS.
- [ ] **Step 5: Commit** `feat: include item keys in notification emails`

---

### Task 8: Keys in the agent MCP tools

**Files:**
- Modify: `supabase/functions/mcp-server/tools.ts`, `supabase/functions/mcp-server/tools.test.ts`, `supabase/functions/mcp-server/index.ts`
- Modify: `docs/agent-api.md`, `README.md` (agent section: keys accepted/returned)

**Interfaces:**
- Consumes: `parseItemKey`, `isUuid`, `formatItemKey` from `../_shared/itemKey.ts`.
- Produces:
  - `resolveFeedbackRef(client: SupabaseLike, ref: string): Promise<{ ok: true; id: string; key: string } | { ok: false; error: string }>` - uuid: feedback by id (`id, number, app_id`) then app `item_key`; key: app by `item_key` then feedback by `app_id` + `number`; neither: error. Unknown error text: `No feedback item '<ref>'. Use list_feedback to find valid keys.`
  - `getFeedback`, `updateStatus`, `setVersion`, `addComment` take `ref: string` in place of `feedbackId` and resolve first.
  - `FEEDBACK_COLUMNS` gains `number`; every returned feedback object gains `key`. `listApps` selects `item_key`. `findAppBySlug` selects `item_key` so `listFeedback`/`getVersionPlan` can compose keys.
  - Notification payloads from `updateStatus`/`addComment` include `feedback.number` and `appKey`.
  - In `index.ts`, the four tools use `z.string().describe("Feedback item key (e.g. 'INTAKE-42') or UUID")`; `list_apps` description mentions `item_key`.

- [ ] **Step 1: Write failing tests**: `resolveFeedbackRef` for uuid, `'intake-42'`, unknown key, malformed input; `getFeedback(client, 'INTAKE-42')` returns `feedback.key === 'INTAKE-42'`; `listFeedback` items carry `key`; `updateStatus` notification payload has `appKey` and `feedback.number`; output still has no `submitter_email`. Adjust existing handler tests for the extra resolve queries.
- [ ] **Step 2: Run** `npx vitest run supabase/functions/mcp-server` - FAIL.
- [ ] **Step 3: Implement** per Interfaces; update docs.
- [ ] **Step 4: Run** `npm test` - PASS.
- [ ] **Step 5: Commit** `feat(mcp): accept and return feedback item keys`

---

### Task 9: Verify and deploy

- [ ] **Step 1:** `npm test` and `npm run build` - both PASS. `npm run lint` - no new errors.
- [ ] **Step 2:** `supabase db reset && supabase test db` - PASS.
- [ ] **Step 3: Ask Tobias before touching production**, then `npm run supabase:db:push` and `npm run supabase:functions:deploy`.
- [ ] **Step 4: E2E**: existing items show keys in the overview; open an old UUID URL and a key URL for the same item; search a key; create a feedback item and confirm its key in the UI and admin email subject; via the MCP endpoint `get_feedback` with a key and `list_feedback` shows keys.
- [ ] **Step 5:** Open a PR (pushes to `main` are blocked) with what/why, migration impact (new columns, triggers, backfill), verification evidence, screenshots of the key label and search.
