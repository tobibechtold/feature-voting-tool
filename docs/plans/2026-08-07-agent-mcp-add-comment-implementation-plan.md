# Agent MCP add_comment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `add_comment` write tool to the MCP server with admin-UI-parity notifications.

**Architecture:** Pure `addComment` handler in `tools.ts` (service client + injected `NotificationSender`); `index.ts` renames the notifier generic and registers the tool. No migration, no UI change.

**Spec:** `docs/plans/2026-08-07-agent-mcp-add-comment-design.md`

## Global Constraints

- Tool output must never include email addresses.
- Notification failures never fail the comment; `notifications_sent` counts successes.
- Pure modules stay Deno-free; TDD; `npm run test` and `npm run lint` at baseline before each commit.

---

### Task 1: `addComment` handler (TDD)

**Files:**
- Modify: `supabase/functions/mcp-server/tools.ts` (add `NotificationSender`, `addComment`; change `updateStatus`'s `notify` parameter type to `NotificationSender`, keeping its internally-typed payload)
- Test: `supabase/functions/mcp-server/tools.test.ts` (append; add `'insert'` and `'not'` to the mock builder method list)

**Interfaces:**
- Produces:

```ts
export type NotificationSender = (payload: unknown) => Promise<void>;
export async function addComment(
  serviceClient: SupabaseLike,
  feedbackId: string,
  content: string,
  notify: NotificationSender
): Promise<ToolOutcome>;
// success data: { comment: { id, content, is_admin, created_at }, notifications_sent: number }
```

- [ ] **Step 1: Failing tests.** Extend the builder method list to `['select', 'eq', 'is', 'order', 'maybeSingle', 'update', 'insert', 'not']`. Append (import `addComment`):

```ts
describe('addComment', () => {
  const FEEDBACK_ROW = {
    id: 'f-1', type: 'bug', title: 'Crash',
    submitter_email: 'reporter@example.com', notify_on_updates: true, app_id: 'app-1',
  };
  const CREATED = { id: 'c-9', content: 'Fixed in 1.3.0', is_admin: true, created_at: '2026-08-07T00:00:00Z' };
  const COMMENTERS = [
    { commenter_email: 'alice@example.com' },
    { commenter_email: 'alice@example.com' },
    { commenter_email: 'reporter@example.com' },
    { commenter_email: 'bob@example.com' },
  ];

  function buildClient(overrides?: { feedbackRow?: unknown; commenters?: unknown[] }) {
    return createClient({
      feedback: [createBuilder({ data: overrides?.feedbackRow === undefined ? FEEDBACK_ROW : overrides.feedbackRow, error: null })],
      comments: [
        createBuilder({ data: CREATED, error: null }),
        createBuilder({ data: overrides?.commenters ?? COMMENTERS, error: null }),
      ],
      apps: [createBuilder({ data: { id: 'app-1', name: 'My App', slug: 'my-app' }, error: null })],
    });
  }

  it('creates the comment and sends both notification types with dedupe', async () => {
    const notify = vi.fn(async () => undefined);

    const outcome = await addComment(buildClient(), 'f-1', 'Fixed in 1.3.0', notify);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = outcome.data as any;
      expect(data.comment).toEqual(CREATED);
      // submitter + alice + bob (deduped, submitter excluded from reply list)
      expect(data.notifications_sent).toBe(3);
      expect(JSON.stringify(data)).not.toContain('@example.com');
    }
    const payloads = notify.mock.calls.map(([p]) => p);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const types = payloads.map((p: any) => p.type);
    expect(types.filter((t: string) => t === 'admin_comment')).toHaveLength(1);
    expect(types.filter((t: string) => t === 'admin_reply_to_comment')).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const replyEmails = payloads.filter((p: any) => p.type === 'admin_reply_to_comment').map((p: any) => p.commenterEmail).sort();
    expect(replyEmails).toEqual(['alice@example.com', 'bob@example.com']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminComment = payloads.find((p: any) => p.type === 'admin_comment') as any;
    expect(adminComment.feedback.submitter_email).toBe('reporter@example.com');
    expect(adminComment.comment).toBe('Fixed in 1.3.0');
    expect(adminComment.appName).toBe('My App');
    expect(adminComment.appSlug).toBe('my-app');
  });

  it('sends nothing when submitter opted out and no reply subscribers', async () => {
    const notify = vi.fn(async () => undefined);
    const client = buildClient({ feedbackRow: { ...FEEDBACK_ROW, notify_on_updates: false }, commenters: [] });

    const outcome = await addComment(client, 'f-1', 'Noted', notify);

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).notifications_sent).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('counts only successful sends when the notifier fails intermittently', async () => {
    const notify = vi.fn(async () => undefined)
      .mockRejectedValueOnce(new Error('smtp down'));

    const outcome = await addComment(buildClient(), 'f-1', 'Fixed in 1.3.0', notify);

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).notifications_sent).toBe(2);
  });

  it('rejects empty and too-long content', async () => {
    const notify = vi.fn(async () => undefined);

    const empty = await addComment(buildClient(), 'f-1', '   ', notify);
    expect(empty.ok).toBe(false);

    const long = await addComment(buildClient(), 'f-1', 'x'.repeat(5001), notify);
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toContain('5000');
  });

  it('returns a helpful error for an unknown id', async () => {
    const notify = vi.fn(async () => undefined);
    const client = createClient({ feedback: [createBuilder({ data: null, error: null })] });

    const outcome = await addComment(client, 'missing-id', 'Hello', notify);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("No feedback item with id 'missing-id'");
  });
});
```

- [ ] **Step 2:** Run the tools test file — new tests FAIL (no export).
- [ ] **Step 3: Implement.** In `tools.ts`, add above `updateStatus`:

```ts
export type NotificationSender = (payload: unknown) => Promise<void>;
```

Change `updateStatus`'s fourth parameter to `notify: NotificationSender` and delete the old `StatusNotifier` type (update the `index.ts` import in Task 2). Append:

```ts
const MAX_COMMENT_LENGTH = 5000;

export async function addComment(
  serviceClient: SupabaseLike,
  feedbackId: string,
  content: string,
  notify: NotificationSender
): Promise<ToolOutcome> {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Comment content must not be empty.' };
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return { ok: false, error: `Comment too long (max ${MAX_COMMENT_LENGTH} characters).` };
  }

  const { data: feedback, error: feedbackError } = await serviceClient
    .from('feedback')
    .select('id, type, title, submitter_email, notify_on_updates, app_id')
    .eq('id', feedbackId)
    .maybeSingle();
  throwIfError(feedbackError);
  if (!feedback) {
    return {
      ok: false,
      error: `No feedback item with id '${feedbackId}'. Use list_feedback to find valid ids.`,
    };
  }

  const { data: created, error: insertError } = await serviceClient
    .from('comments')
    .insert({ feedback_id: feedbackId, content: trimmed, is_admin: true })
    .select('id, content, is_admin, created_at')
    .maybeSingle();
  throwIfError(insertError);

  const { data: app, error: appError } = await serviceClient
    .from('apps')
    .select('id, name, slug')
    .eq('id', feedback.app_id)
    .maybeSingle();
  throwIfError(appError);

  const payloads: unknown[] = [];
  if (app && feedback.submitter_email && feedback.notify_on_updates) {
    payloads.push({
      type: 'admin_comment',
      feedback: {
        id: feedback.id,
        type: feedback.type,
        title: feedback.title,
        submitter_email: feedback.submitter_email,
        notify_on_updates: feedback.notify_on_updates,
      },
      appName: app.name,
      appSlug: app.slug,
      comment: trimmed,
    });
  }

  if (app) {
    const { data: userComments, error: commentersError } = await serviceClient
      .from('comments')
      .select('commenter_email')
      .eq('feedback_id', feedbackId)
      .eq('is_admin', false)
      .eq('notify_on_reply', true)
      .not('commenter_email', 'is', null);
    throwIfError(commentersError);

    const uniqueEmails = [...new Set(
      (userComments ?? [])
        .map((row: { commenter_email: string | null }) => row.commenter_email)
        .filter((email: string | null): email is string =>
          email !== null && email !== feedback.submitter_email
        )
    )];
    for (const email of uniqueEmails) {
      payloads.push({
        type: 'admin_reply_to_comment',
        feedback: { id: feedback.id, type: feedback.type, title: feedback.title },
        appName: app.name,
        appSlug: app.slug,
        comment: trimmed,
        commenterEmail: email,
      });
    }
  }

  let notificationsSent = 0;
  for (const payload of payloads) {
    try {
      await notify(payload);
      notificationsSent += 1;
    } catch (_err) {
      // Best effort: the comment already exists.
    }
  }

  return { ok: true, data: { comment: created, notifications_sent: notificationsSent } };
}
```

- [ ] **Step 4:** Tests PASS; `npm run test` and `npm run lint` at baseline.
- [ ] **Step 5: Commit** `feat: add add_comment tool handler`.

---

### Task 2: Wire in `index.ts`

- [ ] **Step 1:** Rename `sendStatusChangeNotification` to `sendNotificationPayload` (update the `update_status` registration). Import `addComment`.
- [ ] **Step 2:** Register after `update_status`:

```ts
  server.registerTool(
    "add_comment",
    {
      description: "Post an admin comment on a feedback item (e.g. explain a fix or ask the reporter a question). Sends the same emails to opted-in submitters/commenters as admin comments from the UI.",
      inputSchema: {
        id: z.string().uuid().describe("Feedback item id"),
        content: z.string().describe("Comment text (max 5000 characters)"),
      },
    },
    async ({ id, content }: { id: string; content: string }) =>
      toToolResult(await addComment(serviceClient, id, content, sendNotificationPayload))
  );
```

- [ ] **Step 3:** `npm run test && npm run lint` at baseline. **Commit** `feat: expose add_comment via mcp-server`.

---

### Task 3: Docs

- [ ] **Step 1:** `docs/agent-api.md`: under `get_feedback`, append "This is also how agents read a ticket's comment thread." Add after `update_status`:

```markdown
### add_comment
Arguments: `id` (uuid), `content` (max 5000 chars).
Posts an admin comment on the item — e.g. explain what was fixed, or ask the
reporter for more detail. Opted-in submitters and commenters receive the same
emails as for admin comments written in the UI; the response includes
`notifications_sent`.
```

- [ ] **Step 2:** `README.md`: extend the feature bullet and section 11 sentence with "and post admin comments".
- [ ] **Step 3: Commit** `docs: document add_comment agent tool`.

---

### Task 4: Deploy, E2E, PR

- [ ] **Step 1:** `supabase functions deploy mcp-server` (confirm with user if not already authorized this session).
- [ ] **Step 2:** With a user-provided token: `tools/list` shows six tools; `add_comment` on a low-stakes item; confirm via `get_feedback`; user deletes the test comment in the UI. Also round-trip `update_status` (pending from the previous feature).
- [ ] **Step 3:** Push branch, open PR.
