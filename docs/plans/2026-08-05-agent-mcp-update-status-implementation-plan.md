# Agent MCP update_status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `update_status` write tool to the existing MCP server, with admin-UI-parity submitter notifications.

**Architecture:** A pure `updateStatus` handler in `tools.ts` (service-role client + injected notifier), wired in `index.ts` with a fetch-based notifier that calls the existing `send-notification` function. No migration, no UI change.

**Tech Stack:** Existing mcp-server edge function, Vitest.

**Spec:** `docs/plans/2026-08-05-agent-mcp-update-status-design.md`

## Global Constraints

- Tool output must never include `submitter_email`, `notify_on_updates`, or `app_id`.
- Notification failure must never fail the status change (`notified: false` instead).
- Pure modules stay Deno-free (Vitest under Node); only `index.ts` uses Deno APIs.
- TDD; `npm run test` and `npm run lint` pass before each commit.

---

### Task 1: `updateStatus` handler (TDD)

**Files:**
- Modify: `supabase/functions/mcp-server/tools.ts`
- Test: `supabase/functions/mcp-server/tools.test.ts` (append; add `'update'` to the mock builder's method list)

**Interfaces:**
- Produces:

```ts
export type StatusNotifier = (payload: {
  type: 'status_change';
  feedback: { id: string; type: string; title: string; status: string; submitter_email: string; notify_on_updates: boolean };
  appName: string;
  appSlug: string;
}) => Promise<void>;
export async function updateStatus(
  serviceClient: SupabaseLike,
  feedbackId: string,
  status: string,
  notify: StatusNotifier
): Promise<ToolOutcome>;
// success data: { feedback: <FEEDBACK_COLUMNS fields>, notified: boolean }
```

- [ ] **Step 1: Failing tests.** In the test helper `createBuilder`, extend the method list to `['select', 'eq', 'is', 'order', 'maybeSingle', 'update']`. Append (import `updateStatus` from `./tools`):

```ts
describe('updateStatus', () => {
  const UPDATED_ROW = {
    id: 'f-1', type: 'bug', title: 'Crash', description: 'It crashes', status: 'completed',
    vote_count: 3, platform: 'web', version: '1.3.0', created_at: '2026-06-01T00:00:00Z',
    app_id: 'app-1', submitter_email: 'user@example.com', notify_on_updates: true,
  };

  it('updates the status and notifies an opted-in submitter', async () => {
    const notify = vi.fn(async () => undefined);
    const client = createClient({
      feedback: [createBuilder({ data: UPDATED_ROW, error: null })],
      apps: [createBuilder({ data: { id: 'app-1', name: 'My App', slug: 'my-app' }, error: null })],
    });

    const outcome = await updateStatus(client, 'f-1', 'completed', notify);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = outcome.data as any;
      expect(data.notified).toBe(true);
      expect(data.feedback.status).toBe('completed');
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain('submitter_email');
      expect(serialized).not.toContain('user@example.com');
      expect(serialized).not.toContain('app_id');
    }
    expect(notify).toHaveBeenCalledWith({
      type: 'status_change',
      feedback: { id: 'f-1', type: 'bug', title: 'Crash', status: 'completed', submitter_email: 'user@example.com', notify_on_updates: true },
      appName: 'My App',
      appSlug: 'my-app',
    });
  });

  it('skips notification when the submitter opted out', async () => {
    const notify = vi.fn(async () => undefined);
    const client = createClient({
      feedback: [createBuilder({ data: { ...UPDATED_ROW, notify_on_updates: false }, error: null })],
    });

    const outcome = await updateStatus(client, 'f-1', 'completed', notify);

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).notified).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it('returns notified false when the notifier throws, without failing', async () => {
    const notify = vi.fn(async () => { throw new Error('smtp down'); });
    const client = createClient({
      feedback: [createBuilder({ data: UPDATED_ROW, error: null })],
      apps: [createBuilder({ data: { id: 'app-1', name: 'My App', slug: 'my-app' }, error: null })],
    });

    const outcome = await updateStatus(client, 'f-1', 'completed', notify);

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).notified).toBe(false);
  });

  it('returns a helpful error for an unknown id', async () => {
    const notify = vi.fn(async () => undefined);
    const client = createClient({ feedback: [createBuilder({ data: null, error: null })] });

    const outcome = await updateStatus(client, 'missing-id', 'completed', notify);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("No feedback item with id 'missing-id'");
    expect(notify).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run `npx vitest run supabase/functions/mcp-server/tools.test.ts`** — expect the new tests to FAIL (no export).
- [ ] **Step 3: Implement** (append to `tools.ts`):

```ts
export type StatusNotifier = (payload: {
  type: 'status_change';
  feedback: { id: string; type: string; title: string; status: string; submitter_email: string; notify_on_updates: boolean };
  appName: string;
  appSlug: string;
}) => Promise<void>;

export async function updateStatus(
  serviceClient: SupabaseLike,
  feedbackId: string,
  status: string,
  notify: StatusNotifier
): Promise<ToolOutcome> {
  const { data: updated, error } = await serviceClient
    .from('feedback')
    .update({ status })
    .eq('id', feedbackId)
    .select(`${FEEDBACK_COLUMNS}, app_id, submitter_email, notify_on_updates`)
    .maybeSingle();
  throwIfError(error);
  if (!updated) {
    return {
      ok: false,
      error: `No feedback item with id '${feedbackId}'. Use list_feedback to find valid ids.`,
    };
  }

  let notified = false;
  if (updated.submitter_email && updated.notify_on_updates) {
    const { data: app, error: appError } = await serviceClient
      .from('apps')
      .select('id, name, slug')
      .eq('id', updated.app_id)
      .maybeSingle();
    throwIfError(appError);
    if (app) {
      try {
        await notify({
          type: 'status_change',
          feedback: {
            id: updated.id,
            type: updated.type,
            title: updated.title,
            status: updated.status,
            submitter_email: updated.submitter_email,
            notify_on_updates: updated.notify_on_updates,
          },
          appName: app.name,
          appSlug: app.slug,
        });
        notified = true;
      } catch (_err) {
        // Best effort: the status change already succeeded.
        notified = false;
      }
    }
  }

  const { app_id: _appId, submitter_email: _email, notify_on_updates: _optIn, ...publicFields } = updated;
  return { ok: true, data: { feedback: publicFields, notified } };
}
```

- [ ] **Step 4: Run the tests** — expect PASS, plus `npm run test` and `npm run lint` at baseline.
- [ ] **Step 5: Commit** `feat: add update_status tool handler`.

---

### Task 2: Wire the tool in `index.ts`

**Files:**
- Modify: `supabase/functions/mcp-server/index.ts`

**Interfaces:**
- Consumes: `updateStatus`, `StatusNotifier` from `./tools.ts`.

- [ ] **Step 1:** Add `updateStatus` (and `type StatusNotifier` if needed) to the `./tools.ts` import. Add the notifier below `corsHeaders`:

```ts
async function sendStatusChangeNotification(payload: unknown): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`send-notification failed: ${response.status}`);
  }
}
```

- [ ] **Step 2:** Change `buildServer(dataClient)` to `buildServer(dataClient, serviceClient)` (update the call site in the handler to pass the existing `service` client) and register the tool inside `buildServer`:

```ts
  server.registerTool(
    "update_status",
    {
      description: "Change the status of a feedback item. Sends the same status-change email to opted-in submitters as the admin UI. Returns the updated item and whether a notification was sent.",
      inputSchema: {
        id: z.string().uuid().describe("Feedback item id"),
        status: z.enum(FEEDBACK_STATUSES).describe("New status"),
      },
    },
    async ({ id, status }: { id: string; status: string }) =>
      toToolResult(await updateStatus(serviceClient, id, status, sendStatusChangeNotification))
  );
```

- [ ] **Step 3:** `npm run test && npm run lint` at baseline (index.ts is Deno-only; deploy verifies types).
- [ ] **Step 4: Commit** `feat: expose update_status via mcp-server`.

---

### Task 3: Documentation

**Files:**
- Modify: `docs/agent-api.md` (retitle "Tools (all read-only)" to "Tools"; add `update_status` section; replace the read-only notes line)
- Modify: `README.md` (section 11 + feature bullet mention write)

- [ ] **Step 1:** In `docs/agent-api.md`: change the tools heading to `## Tools`; after the `get_feedback` section add:

```markdown
### update_status
Arguments: `id` (uuid), `status`
(`open|planned|progress|completed|wont_do`).
Changes the item's status — e.g. mark a bug `completed` after fixing it, or
move an implemented feature out of `progress`. If the submitter opted into
notifications, the same status-change email is sent as when an admin changes
the status in the UI; the response includes `notified` accordingly.
```

Replace the note `- Tokens grant read-only access; write tools may come later.` with `- Tokens grant read access and status-update write access.`

- [ ] **Step 2:** In `README.md`: in the feature bullet, change "can read version plans and feedback" to "can read version plans and feedback and update item statuses". In section 11, change "Agents can list apps, fetch every bug/feature planned for a version (including per-platform targets), and scan open feedback for duplicates or already-fixed bugs." to end with "..., and update item statuses (with submitter notifications)."
- [ ] **Step 3: Commit** `docs: document update_status agent tool`.

---

### Task 4: Deploy and verify end-to-end

Touches production; confirm with the user before deploying.

- [ ] **Step 1:** `supabase functions deploy mcp-server`.
- [ ] **Step 2:** With a valid token: `tools/list` includes `update_status`; pick a low-stakes feedback item, change its status, confirm via `get_feedback`, then revert to the original status. Verify `notified` is reported truthfully.
- [ ] **Step 3:** Push branch, open PR.
