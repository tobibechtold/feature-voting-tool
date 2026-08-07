# Agent MCP API: add_comment Design

## Goal

Let agents post comments on feedback items through the MCP server. Reading comments already works via `get_feedback`. Agent comments are indistinguishable from admin comments (`is_admin: true`, no schema change) — the agent acts as the admin's delegate.

## Product Decisions

- Every valid API token may comment (consistent with `update_status`; no scopes).
- Content rules match the public comment path in `verify-comment`: non-empty after trimming, max 5000 characters. Violations return a tool error before any insert.
- Notification parity with the admin UI (`useCreateComment` in `src/hooks/useComments.ts`):
  1. `admin_comment` to the submitter if `notify_on_updates` and `submitter_email` are set.
  2. `admin_reply_to_comment` to each user commenter on the thread with `notify_on_reply` and a `commenter_email`, deduplicated, excluding the submitter's email.
- Each notification send is best-effort: failures never fail the comment; the response's `notifications_sent` count reflects successful sends only.

## Architecture

### Tool

`add_comment(id: uuid, content: string)` registered in `supabase/functions/mcp-server/index.ts`. Returns `{ comment: { id, content, is_admin, created_at }, notifications_sent: number }`. Unknown feedback id returns the same helpful-error style as `get_feedback`.

### Handler (pure, Vitest-tested)

In `supabase/functions/mcp-server/tools.ts`:

```ts
export type NotificationSender = (payload: unknown) => Promise<void>;

export async function addComment(
  serviceClient: SupabaseLike,
  feedbackId: string,
  content: string,
  notify: NotificationSender
): Promise<ToolOutcome>;
```

Flow (all on the service-role client; comment insert requires admin RLS, the reads are public data anyway):

1. Validate content (trimmed non-empty, <= 5000 chars) — tool error otherwise.
2. Fetch feedback (`id, type, title, submitter_email, notify_on_updates, app_id`); missing → unknown-id error.
3. Insert `{ feedback_id, content: trimmed, is_admin: true }`, selecting `id, content, is_admin, created_at`.
4. Fetch the app (`name, slug`) for payloads.
5. Build the notification list per the product decisions above; send each via `notify(...)` in try/catch, counting successes. `admin_reply_to_comment` payloads include `commenterEmail` per recipient, matching `useCreateComment`.
6. Return the created comment (no emails anywhere in the output) plus `notifications_sent`.

`StatusNotifier` is retired in favor of the payload-agnostic `NotificationSender` for both `updateStatus` and `addComment` (the `updateStatus` signature keeps its typed payload construction internally; only the parameter type generalizes).

### Wiring (index.ts)

The existing `sendStatusChangeNotification` is renamed `sendNotificationPayload` (it already POSTs an arbitrary payload to `send-notification` with the service key) and passed to both write tools. New tool registration uses `z.string().uuid()` for `id` and `z.string()` for `content` (length rules live in the handler where they are unit-tested).

## Docs

- `docs/agent-api.md`: `add_comment` section; note under `get_feedback` that it returns the full comment thread (the read side of comments).
- `README.md`: feature bullet and section 11 mention posting admin comments.

## Testing

- Vitest handler tests: comment created with both notification types sent (payload shapes asserted, dedupe and submitter-exclusion covered), opted-out submitter/commenters produce zero sends, notifier failure reduces the count without failing, empty and >5000-char content rejected, unknown id error, no email addresses in output.
- E2E after deploy: post a comment on a low-stakes item via the live endpoint, confirm it via `get_feedback`, verify it renders as an admin comment in the UI, then delete it from the UI. Also round-trip `update_status` live (left over from the previous feature's E2E).
