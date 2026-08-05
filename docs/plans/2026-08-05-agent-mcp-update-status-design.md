# Agent MCP API: update_status Design

## Goal

Let agents change the status of a feedback item through the existing MCP server, with the same submitter notification behavior as the admin UI. This implements (and simplifies) the "write tools" future work from `2026-08-05-agent-mcp-api-design.md`.

## Product Decisions

- Every valid API token may write. No scopes column, no migration, no admin-UI change. (Revised from the original future-work sketch, which proposed a `scopes` column; per-token scoping can still be added later if ever needed.)
- Notification parity with the admin UI: if the submitter opted in (`notify_on_updates` and `submitter_email` set), the MCP server sends the same `status_change` payload to the existing `send-notification` edge function. Best-effort: a failed notification never fails the status change (mirrors `src/lib/notificationService.ts`, which swallows errors).
- All five statuses are allowed (`open`, `planned`, `progress`, `completed`, `wont_do`), enum-validated at the tool boundary like `list_feedback`.

## Architecture

### Tool

`update_status(id: uuid, status: enum)` registered in `supabase/functions/mcp-server/index.ts`. Returns the updated item with the same non-PII fields as the read tools (`FEEDBACK_COLUMNS` set) plus `notified: boolean` (whether a status-change email was dispatched). Unknown id returns the same helpful-error style as `get_feedback`.

### Handler (pure, Vitest-tested)

In `supabase/functions/mcp-server/tools.ts`:

```ts
export type StatusNotifier = (payload: {
  type: 'status_change';
  feedback: {
    id: string;
    type: string;
    title: string;
    status: string;
    submitter_email: string;
    notify_on_updates: boolean;
  };
  appName: string;
  appSlug: string;
}) => Promise<void>;

export async function updateStatus(
  serviceClient: SupabaseLike,
  feedbackId: string,
  status: string,
  notify: StatusNotifier
): Promise<ToolOutcome>;
```

Flow: update `feedback` by id on the **service-role** client (RLS restricts feedback updates to admins; the MCP server acts as the admin's delegate — reads elsewhere stay on the anon client), selecting the full row including `app_id`, `submitter_email`, `notify_on_updates`. If no row matched, return the unknown-id error. Then fetch the app (`id, name, slug`) for the notification payload. If the submitter opted in, call `notify(...)` inside try/catch (`notified` reflects whether the call succeeded); otherwise `notified: false`. Tool output strips PII: only `FEEDBACK_COLUMNS` fields plus `notified`.

### Notifier (Deno wiring)

In `index.ts`: a small function that POSTs the payload to `${SUPABASE_URL}/functions/v1/send-notification` with the service-role key as bearer, matching the payload shape in `src/lib/notificationService.ts`. Non-2xx responses throw so the handler records `notified: false`.

## Docs

- `docs/agent-api.md`: add the `update_status` tool section; change "Tools (all read-only)" and the read-only notes line to reflect read + write.
- `README.md` section 11: mention agents can also update item statuses.
- `docs/plans/2026-08-05-agent-mcp-api-design.md`: future-work section updated to note write support landed without scopes.

## Testing

- Vitest handler tests: happy path (status updated, output shape, PII stripped), unknown id error, opted-in submitter triggers notifier with the exact payload, opted-out submitter skips it, notifier failure yields `notified: false` without failing the tool.
- E2E after deploy: `tools/list` shows `update_status`; a real status change round-trips (verify via `get_feedback`) and is then reverted.
