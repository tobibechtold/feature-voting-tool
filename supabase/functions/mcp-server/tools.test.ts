import { describe, expect, it, vi } from 'vitest';
import { addComment, getFeedback, getVersionPlan, listApps, listFeedback, updateStatus } from './tools';

type QueryResult = { data: unknown; error: Error | null };

// Chainable mock: every builder method returns the builder; the builder is
// awaitable and resolves to `result`. Mirrors the postgrest-js API shape.
function createBuilder(result: QueryResult) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    calls: [] as Array<[string, unknown[]]>,
    then(resolve: (value: QueryResult) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };
  for (const method of ['select', 'eq', 'is', 'order', 'maybeSingle', 'update', 'insert', 'not']) {
    builder[method] = vi.fn((...args: unknown[]) => {
      builder.calls.push([method, args]);
      return method === 'maybeSingle' ? Promise.resolve(result) : builder;
    });
  }
  return builder;
}

function createClient(tables: Record<string, ReturnType<typeof createBuilder>[]>) {
  const counters: Record<string, number> = {};
  return {
    from: vi.fn((table: string) => {
      const list = tables[table];
      if (!list) throw new Error(`Unexpected table ${table}`);
      const index = counters[table] ?? 0;
      counters[table] = index + 1;
      return list[Math.min(index, list.length - 1)];
    }),
  };
}

const APP = { id: 'app-1', name: 'My App', slug: 'my-app' };

describe('listApps', () => {
  it('returns all apps', async () => {
    const apps = [{ id: 'app-1', name: 'My App', slug: 'my-app', description: null, platforms: ['web'] }];
    const client = createClient({ apps: [createBuilder({ data: apps, error: null })] });

    const outcome = await listApps(client);

    expect(outcome).toEqual({ ok: true, data: { apps } });
  });

  it('throws on database error', async () => {
    const client = createClient({ apps: [createBuilder({ data: null, error: new Error('boom') })] });
    await expect(listApps(client)).rejects.toThrow('boom');
  });
});

describe('listFeedback', () => {
  it('returns feedback for an app, applying filters', async () => {
    const items = [{ id: 'f-1', type: 'bug', title: 'Crash', description: 'It crashes', status: 'open', vote_count: 3, platform: 'web', version: null, created_at: '2026-08-01T00:00:00Z' }];
    const appBuilder = createBuilder({ data: APP, error: null });
    const feedbackBuilder = createBuilder({ data: items, error: null });
    const client = createClient({ apps: [appBuilder], feedback: [feedbackBuilder] });

    const outcome = await listFeedback(client, 'my-app', { status: 'open', type: 'bug' });

    expect(outcome).toEqual({ ok: true, data: { app: APP, feedback: items } });
    // status and type filters were applied on top of the app_id filter
    const eqArgs = feedbackBuilder.calls.filter(([m]: [string, unknown[]]) => m === 'eq').map(([, a]: [string, unknown[]]) => a);
    expect(eqArgs).toContainEqual(['app_id', 'app-1']);
    expect(eqArgs).toContainEqual(['status', 'open']);
    expect(eqArgs).toContainEqual(['type', 'bug']);
    // newest first
    expect(feedbackBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    // no PII columns selected
    const selectArg = String(feedbackBuilder.calls.find(([m]: [string, unknown[]]) => m === 'select')?.[1][0]);
    expect(selectArg).not.toContain('submitter_email');
    expect(selectArg).not.toContain('notify_on_updates');
  });

  it('returns a helpful error for an unknown app slug', async () => {
    const client = createClient({ apps: [createBuilder({ data: null, error: null })] });

    const outcome = await listFeedback(client, 'nope', {});

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain("No app with slug 'nope'");
      expect(outcome.error).toContain('list_apps');
    }
  });
});

describe('getVersionPlan', () => {
  const GROUP_ROW = {
    id: 'rg-1',
    semver: '1.3.0',
    title: 'Summer release',
    notes: 'Focus on stability',
    created_at: '2026-07-01T00:00:00Z',
    release_group_platforms: [
      { platform: 'web', version: '1.3.0', status: 'planned', released_at: null },
    ],
    feedback_release_targets: [
      {
        platform: 'web',
        feedback: { id: 'f-1', type: 'bug', title: 'Crash', description: 'It crashes', status: 'planned', vote_count: 3, platform: 'web', version: '1.3.0', created_at: '2026-06-01T00:00:00Z' },
      },
      {
        platform: 'ios',
        feedback: { id: 'f-1', type: 'bug', title: 'Crash', description: 'It crashes', status: 'planned', vote_count: 3, platform: 'web', version: '1.3.0', created_at: '2026-06-01T00:00:00Z' },
      },
    ],
  };

  it('returns release info with feedback deduped across target platforms', async () => {
    const client = createClient({
      apps: [createBuilder({ data: APP, error: null })],
      release_groups: [createBuilder({ data: GROUP_ROW, error: null })],
    });

    const outcome = await getVersionPlan(client, 'my-app', '1.3.0');

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = outcome.data as any;
      expect(data.release).toEqual({ semver: '1.3.0', title: 'Summer release', notes: 'Focus on stability', created_at: '2026-07-01T00:00:00Z' });
      expect(data.platforms).toHaveLength(1);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe('f-1');
      expect(data.items[0].target_platforms).toEqual(['web', 'ios']);
    }
  });

  it('lists available versions when the version is unknown', async () => {
    const client = createClient({
      apps: [createBuilder({ data: APP, error: null })],
      release_groups: [
        createBuilder({ data: null, error: null }),
        createBuilder({ data: [{ semver: '1.2.0' }, { semver: '1.1.0' }], error: null }),
      ],
    });

    const outcome = await getVersionPlan(client, 'my-app', '9.9.9');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain("No release '9.9.9'");
      expect(outcome.error).toContain('1.2.0');
      expect(outcome.error).toContain('1.1.0');
    }
  });

  it('returns a helpful error for an unknown app slug', async () => {
    const client = createClient({ apps: [createBuilder({ data: null, error: null })] });

    const outcome = await getVersionPlan(client, 'nope', '1.0.0');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("No app with slug 'nope'");
  });
});

describe('getFeedback', () => {
  const ITEM = { id: 'f-1', type: 'feature', title: 'Dark mode', description: 'Please add dark mode', status: 'planned', vote_count: 12, platform: null, version: '1.3.0', created_at: '2026-05-01T00:00:00Z' };

  it('returns the item with comments and attachment urls', async () => {
    const comments = [{ id: 'c-1', content: 'Working on it', is_admin: true, created_at: '2026-05-02T00:00:00Z' }];
    const commentsBuilder = createBuilder({ data: comments, error: null });
    const client = createClient({
      feedback: [createBuilder({ data: ITEM, error: null })],
      comments: [commentsBuilder],
      feedback_attachments: [createBuilder({ data: [{ image_url: 'https://x/img.png' }], error: null })],
    });

    const outcome = await getFeedback(client, 'f-1');

    expect(outcome).toEqual({
      ok: true,
      data: { feedback: ITEM, comments, attachments: ['https://x/img.png'] },
    });
    // no commenter PII selected
    const selectArg = String(commentsBuilder.calls.find(([m]: [string, unknown[]]) => m === 'select')?.[1][0]);
    expect(selectArg).not.toContain('commenter_email');
    expect(selectArg).not.toContain('notify_on_reply');
  });

  it('returns a helpful error for an unknown id', async () => {
    const client = createClient({ feedback: [createBuilder({ data: null, error: null })] });

    const outcome = await getFeedback(client, 'missing-id');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("No feedback item with id 'missing-id'");
  });
});

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
