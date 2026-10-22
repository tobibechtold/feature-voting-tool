import { describe, expect, it, vi } from 'vitest';
import { addComment, getFeedback, getVersionPlan, listApps, listFeedback, resolveFeedbackRef, resolveTargetPlatforms, setVersion, updateStatus } from './tools';

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
  for (const method of ['select', 'eq', 'is', 'or', 'order', 'maybeSingle', 'update', 'insert', 'upsert', 'delete', 'not']) {
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

const APP = { id: 'app-1', name: 'My App', slug: 'my-app', item_key: 'MYAPP' };
const FEEDBACK_UUID = '6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b';
// What resolveFeedbackRef reads: the feedback row (id, number, app_id) and the app's item_key.
const REF_ROW = { id: 'f-1', number: 7, app_id: 'app-1' };
const REF_APP = { id: 'app-1', item_key: 'MYAPP' };

function selectArgOf(builder: ReturnType<typeof createBuilder>): string {
  return String(builder.calls.find(([m]: [string, unknown[]]) => m === 'select')?.[1][0]);
}

function eqArgsOf(builder: ReturnType<typeof createBuilder>): unknown[][] {
  return builder.calls.filter(([m]: [string, unknown[]]) => m === 'eq').map(([, a]: [string, unknown[]]) => a);
}

describe('resolveFeedbackRef', () => {
  it('resolves a uuid by id and composes the key from the app', async () => {
    const feedbackBuilder = createBuilder({ data: { ...REF_ROW, id: FEEDBACK_UUID }, error: null });
    const appBuilder = createBuilder({ data: REF_APP, error: null });
    const client = createClient({ feedback: [feedbackBuilder], apps: [appBuilder] });

    const outcome = await resolveFeedbackRef(client, FEEDBACK_UUID);

    expect(outcome).toEqual({ ok: true, id: FEEDBACK_UUID, key: 'MYAPP-7' });
    expect(eqArgsOf(feedbackBuilder)).toContainEqual(['id', FEEDBACK_UUID]);
    expect(selectArgOf(feedbackBuilder)).toBe('id, number, app_id');
    expect(eqArgsOf(appBuilder)).toContainEqual(['id', 'app-1']);
    expect(selectArgOf(appBuilder)).toContain('item_key');
  });

  it('resolves a lowercase, padded key by app item_key and number', async () => {
    const appBuilder = createBuilder({ data: { id: 'app-9', item_key: 'INTAKE' }, error: null });
    const feedbackBuilder = createBuilder({ data: { id: 'f-42', number: 42, app_id: 'app-9' }, error: null });
    const client = createClient({ apps: [appBuilder], feedback: [feedbackBuilder] });

    const outcome = await resolveFeedbackRef(client, ' intake-42 ');

    expect(outcome).toEqual({ ok: true, id: 'f-42', key: 'INTAKE-42' });
    expect(eqArgsOf(appBuilder)).toContainEqual(['item_key', 'INTAKE']);
    expect(eqArgsOf(feedbackBuilder)).toContainEqual(['app_id', 'app-9']);
    expect(eqArgsOf(feedbackBuilder)).toContainEqual(['number', 42]);
  });

  it('returns the unknown-item error for a key whose app does not exist', async () => {
    const client = createClient({ apps: [createBuilder({ data: null, error: null })] });

    const outcome = await resolveFeedbackRef(client, 'NOPE-1');

    expect(outcome).toEqual({ ok: false, error: "No feedback item 'NOPE-1'. Use list_feedback to find valid keys." });
  });

  it('returns the unknown-item error for a key whose number does not exist', async () => {
    const client = createClient({
      apps: [createBuilder({ data: { id: 'app-9', item_key: 'INTAKE' }, error: null })],
      feedback: [createBuilder({ data: null, error: null })],
    });

    const outcome = await resolveFeedbackRef(client, 'INTAKE-999');

    expect(outcome).toEqual({ ok: false, error: "No feedback item 'INTAKE-999'. Use list_feedback to find valid keys." });
  });

  it('returns the unknown-item error for an unknown uuid', async () => {
    const client = createClient({ feedback: [createBuilder({ data: null, error: null })] });

    const outcome = await resolveFeedbackRef(client, FEEDBACK_UUID);

    expect(outcome).toEqual({ ok: false, error: `No feedback item '${FEEDBACK_UUID}'. Use list_feedback to find valid keys.` });
  });

  it('rejects malformed input without querying', async () => {
    const client = createClient({});

    for (const ref of ['not-a-key', '42', 'INTAKE-', 'INTAKE-0', '']) {
      const outcome = await resolveFeedbackRef(client, ref);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.error).toContain('list_feedback');
    }
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe('listApps', () => {
  it('returns all apps including their item_key', async () => {
    const apps = [{ id: 'app-1', name: 'My App', slug: 'my-app', item_key: 'MYAPP', description: null, platforms: ['web'] }];
    const appsBuilder = createBuilder({ data: apps, error: null });
    const client = createClient({ apps: [appsBuilder] });

    const outcome = await listApps(client);

    expect(outcome).toEqual({ ok: true, data: { apps } });
    expect(selectArgOf(appsBuilder)).toContain('item_key');
  });

  it('throws on database error', async () => {
    const client = createClient({ apps: [createBuilder({ data: null, error: new Error('boom') })] });
    await expect(listApps(client)).rejects.toThrow('boom');
  });
});

describe('listFeedback', () => {
  it('returns feedback for an app with keys, applying filters', async () => {
    const items = [{ id: 'f-1', number: 7, type: 'bug', title: 'Crash', description: 'It crashes', status: 'open', vote_count: 3, platform: 'web', version: null, created_at: '2026-08-01T00:00:00Z' }];
    const appBuilder = createBuilder({ data: APP, error: null });
    const feedbackBuilder = createBuilder({ data: items, error: null });
    const client = createClient({ apps: [appBuilder], feedback: [feedbackBuilder] });

    const outcome = await listFeedback(client, 'my-app', { status: 'open', type: 'bug' });

    expect(outcome).toEqual({ ok: true, data: { app: APP, feedback: [{ ...items[0], key: 'MYAPP-7' }] } });
    expect(selectArgOf(appBuilder)).toContain('item_key');
    // status and type filters were applied on top of the app_id filter
    const eqArgs = eqArgsOf(feedbackBuilder);
    expect(eqArgs).toContainEqual(['app_id', 'app-1']);
    expect(eqArgs).toContainEqual(['status', 'open']);
    expect(eqArgs).toContainEqual(['type', 'bug']);
    // newest first
    expect(feedbackBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    // number selected, no PII columns selected
    const selectArg = selectArgOf(feedbackBuilder);
    expect(selectArg).toContain('number');
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
  const PLAN_ITEM = { id: 'f-1', number: 7, type: 'bug', title: 'Crash', description: 'It crashes', status: 'planned', vote_count: 3, platform: 'web', version: '1.3.0', created_at: '2026-06-01T00:00:00Z' };
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
      { platform: 'web', feedback: { ...PLAN_ITEM } },
      { platform: 'ios', feedback: { ...PLAN_ITEM } },
    ],
  };

  it('returns release info with keyed feedback deduped across target platforms', async () => {
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
      expect(data.items[0].key).toBe('MYAPP-7');
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
  const ITEM = { id: 'f-42', number: 42, type: 'feature', title: 'Dark mode', description: 'Please add dark mode', status: 'planned', vote_count: 12, platform: null, version: '1.3.0', created_at: '2026-05-01T00:00:00Z' };

  it('returns the item by key with its key, comments and attachment urls', async () => {
    const comments = [{ id: 'c-1', content: 'Working on it', is_admin: true, created_at: '2026-05-02T00:00:00Z' }];
    const commentsBuilder = createBuilder({ data: comments, error: null });
    const itemBuilder = createBuilder({ data: ITEM, error: null });
    const client = createClient({
      apps: [createBuilder({ data: { id: 'app-9', item_key: 'INTAKE' }, error: null })],
      feedback: [createBuilder({ data: { id: 'f-42', number: 42, app_id: 'app-9' }, error: null }), itemBuilder],
      comments: [commentsBuilder],
      feedback_attachments: [createBuilder({ data: [{ image_url: 'https://x/img.png' }], error: null })],
    });

    const outcome = await getFeedback(client, 'INTAKE-42');

    expect(outcome).toEqual({
      ok: true,
      data: { feedback: { ...ITEM, key: 'INTAKE-42' }, comments, attachments: ['https://x/img.png'] },
    });
    expect(eqArgsOf(itemBuilder)).toContainEqual(['id', 'f-42']);
    expect(eqArgsOf(commentsBuilder)).toContainEqual(['feedback_id', 'f-42']);
    // no PII selected
    expect(selectArgOf(itemBuilder)).not.toContain('submitter_email');
    expect(selectArgOf(commentsBuilder)).not.toContain('commenter_email');
    expect(selectArgOf(commentsBuilder)).not.toContain('notify_on_reply');
  });

  it('still accepts a uuid', async () => {
    const client = createClient({
      feedback: [createBuilder({ data: { ...REF_ROW, id: FEEDBACK_UUID }, error: null }), createBuilder({ data: { ...ITEM, id: FEEDBACK_UUID, number: 7 }, error: null })],
      apps: [createBuilder({ data: REF_APP, error: null })],
      comments: [createBuilder({ data: [], error: null })],
      feedback_attachments: [createBuilder({ data: [], error: null })],
    });

    const outcome = await getFeedback(client, FEEDBACK_UUID);

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).feedback.key).toBe('MYAPP-7');
  });

  it('returns a helpful error for an unknown key', async () => {
    const client = createClient({ apps: [createBuilder({ data: null, error: null })] });

    const outcome = await getFeedback(client, 'NOPE-1');

    expect(outcome).toEqual({ ok: false, error: "No feedback item 'NOPE-1'. Use list_feedback to find valid keys." });
  });
});

describe('updateStatus', () => {
  const UPDATED_ROW = {
    id: 'f-1', number: 7, type: 'bug', title: 'Crash', description: 'It crashes', status: 'completed',
    vote_count: 3, platform: 'web', version: '1.3.0', created_at: '2026-06-01T00:00:00Z',
    app_id: 'app-1', submitter_email: 'user@example.com', notify_on_updates: true,
  };
  const NOTIFY_APP = { id: 'app-1', name: 'My App', slug: 'my-app', item_key: 'MYAPP' };

  function buildClient(updatedRow: unknown) {
    const updateBuilder = createBuilder({ data: updatedRow, error: null });
    const client = createClient({
      apps: [createBuilder({ data: REF_APP, error: null }), createBuilder({ data: NOTIFY_APP, error: null })],
      feedback: [createBuilder({ data: REF_ROW, error: null }), updateBuilder],
    });
    return { client, updateBuilder };
  }

  it('updates the status by key and notifies an opted-in submitter with the key parts', async () => {
    const notify = vi.fn(async () => undefined);
    const { client, updateBuilder } = buildClient(UPDATED_ROW);

    const outcome = await updateStatus(client, 'MYAPP-7', 'completed', notify);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = outcome.data as any;
      expect(data.notified).toBe(true);
      expect(data.feedback.status).toBe('completed');
      expect(data.feedback.key).toBe('MYAPP-7');
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain('submitter_email');
      expect(serialized).not.toContain('notify_on_updates');
      expect(serialized).not.toContain('user@example.com');
      expect(serialized).not.toContain('app_id');
    }
    expect(updateBuilder.update).toHaveBeenCalledWith({ status: 'completed' });
    expect(eqArgsOf(updateBuilder)).toContainEqual(['id', 'f-1']);
    expect(notify).toHaveBeenCalledWith({
      type: 'status_change',
      feedback: { id: 'f-1', number: 7, type: 'bug', title: 'Crash', status: 'completed', submitter_email: 'user@example.com', notify_on_updates: true },
      appName: 'My App',
      appSlug: 'my-app',
      appKey: 'MYAPP',
    });
  });

  it('skips notification when the submitter opted out', async () => {
    const notify = vi.fn(async () => undefined);
    const { client } = buildClient({ ...UPDATED_ROW, notify_on_updates: false });

    const outcome = await updateStatus(client, 'MYAPP-7', 'completed', notify);

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).notified).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it('returns notified false when the notifier throws, without failing', async () => {
    const notify = vi.fn(async () => { throw new Error('smtp down'); });
    const { client } = buildClient(UPDATED_ROW);

    const outcome = await updateStatus(client, 'MYAPP-7', 'completed', notify);

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).notified).toBe(false);
  });

  it('returns a helpful error for an unknown item without updating', async () => {
    const notify = vi.fn(async () => undefined);
    const client = createClient({ feedback: [createBuilder({ data: null, error: null })] });

    const outcome = await updateStatus(client, FEEDBACK_UUID, 'completed', notify);

    expect(outcome).toEqual({ ok: false, error: `No feedback item '${FEEDBACK_UUID}'. Use list_feedback to find valid keys.` });
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('addComment', () => {
  const FEEDBACK_ROW = {
    id: 'f-1', number: 7, type: 'bug', title: 'Crash',
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
      apps: [
        createBuilder({ data: REF_APP, error: null }),
        createBuilder({ data: { id: 'app-1', name: 'My App', slug: 'my-app', item_key: 'MYAPP' }, error: null }),
      ],
      feedback: [
        createBuilder({ data: REF_ROW, error: null }),
        createBuilder({ data: overrides?.feedbackRow === undefined ? FEEDBACK_ROW : overrides.feedbackRow, error: null }),
      ],
      comments: [
        createBuilder({ data: CREATED, error: null }),
        createBuilder({ data: overrides?.commenters ?? COMMENTERS, error: null }),
      ],
    });
  }

  it('creates the comment by key and sends both notification types with dedupe', async () => {
    const notify = vi.fn(async () => undefined);
    const client = buildClient();

    const outcome = await addComment(client, 'myapp-7', 'Fixed in 1.3.0', notify);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = outcome.data as any;
      expect(data.comment).toEqual(CREATED);
      // submitter + alice + bob (deduped, submitter excluded from reply list)
      expect(data.notifications_sent).toBe(3);
      expect(JSON.stringify(data)).not.toContain('@example.com');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commentsInsert = (client.from as any).mock.results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.value)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .find((b: any) => b.insert.mock.calls.length > 0);
    expect(commentsInsert.insert).toHaveBeenCalledWith({ feedback_id: 'f-1', content: 'Fixed in 1.3.0', is_admin: true });
    const payloads = notify.mock.calls.map(([p]) => p);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const types = payloads.map((p: any) => p.type);
    expect(types.filter((t: string) => t === 'admin_comment')).toHaveLength(1);
    expect(types.filter((t: string) => t === 'admin_reply_to_comment')).toHaveLength(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const replies = payloads.filter((p: any) => p.type === 'admin_reply_to_comment') as any[];
    expect(replies.map((p) => p.commenterEmail).sort()).toEqual(['alice@example.com', 'bob@example.com']);
    for (const reply of replies) {
      expect(reply.appKey).toBe('MYAPP');
      expect(reply.feedback.number).toBe(7);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminComment = payloads.find((p: any) => p.type === 'admin_comment') as any;
    expect(adminComment.feedback.submitter_email).toBe('reporter@example.com');
    expect(adminComment.feedback.number).toBe(7);
    expect(adminComment.comment).toBe('Fixed in 1.3.0');
    expect(adminComment.appName).toBe('My App');
    expect(adminComment.appSlug).toBe('my-app');
    expect(adminComment.appKey).toBe('MYAPP');
  });

  it('sends nothing when submitter opted out and no reply subscribers', async () => {
    const notify = vi.fn(async () => undefined);
    const client = buildClient({ feedbackRow: { ...FEEDBACK_ROW, notify_on_updates: false }, commenters: [] });

    const outcome = await addComment(client, 'MYAPP-7', 'Noted', notify);

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).notifications_sent).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it('counts only successful sends when the notifier fails intermittently', async () => {
    const notify = vi.fn(async () => undefined)
      .mockRejectedValueOnce(new Error('smtp down'));

    const outcome = await addComment(buildClient(), 'MYAPP-7', 'Fixed in 1.3.0', notify);

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).notifications_sent).toBe(2);
  });

  it('rejects empty and too-long content', async () => {
    const notify = vi.fn(async () => undefined);

    const empty = await addComment(buildClient(), 'MYAPP-7', '   ', notify);
    expect(empty.ok).toBe(false);

    const long = await addComment(buildClient(), 'MYAPP-7', 'x'.repeat(5001), notify);
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toContain('5000');
  });

  it('returns a helpful error for an unknown item', async () => {
    const notify = vi.fn(async () => undefined);
    const client = createClient({ feedback: [createBuilder({ data: null, error: null })] });

    const outcome = await addComment(client, FEEDBACK_UUID, 'Hello', notify);

    expect(outcome).toEqual({ ok: false, error: `No feedback item '${FEEDBACK_UUID}'. Use list_feedback to find valid keys.` });
    expect(client.from).not.toHaveBeenCalledWith('comments');
  });
});

describe('resolveTargetPlatforms', () => {
  const APP_PLATFORMS = ['ios', 'android'];

  it('gives a feature every platform of the app', () => {
    expect(resolveTargetPlatforms({ type: 'feature', platform: null, appPlatforms: APP_PLATFORMS }))
      .toEqual({ ok: true, platforms: ['ios', 'android'] });
  });

  it('gives a bug its own platform', () => {
    expect(resolveTargetPlatforms({ type: 'bug', platform: 'android', appPlatforms: APP_PLATFORMS }))
      .toEqual({ ok: true, platforms: ['android'] });
  });

  it('falls back to every platform for a bug without one', () => {
    expect(resolveTargetPlatforms({ type: 'bug', platform: null, appPlatforms: APP_PLATFORMS }))
      .toEqual({ ok: true, platforms: ['ios', 'android'] });
  });

  it('lets an explicit list override the default, deduplicated', () => {
    expect(resolveTargetPlatforms({ requested: ['all', 'all'], type: 'bug', platform: 'android', appPlatforms: APP_PLATFORMS }))
      .toEqual({ ok: true, platforms: ['all'] });
  });

  it('rejects a platform the app does not have', () => {
    const outcome = resolveTargetPlatforms({ requested: ['web'], type: 'feature', platform: null, appPlatforms: APP_PLATFORMS });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toContain("Unknown platform(s) web. Allowed: ios, android, all.");
  });
});

describe('setVersion', () => {
  const BUG = { id: 'f-1', type: 'bug', platform: 'android', app_id: 'app-1' };
  const FEATURE = { id: 'f-2', type: 'feature', platform: null, app_id: 'app-1' };
  const APP_ROW = { ...APP, platforms: ['ios', 'android'] };
  const GROUP = { id: 'rg-1', semver: '2.6.1' };
  const UPDATED = {
    id: 'f-1', number: 7, type: 'bug', title: 'Crash', description: 'It crashes', status: 'completed',
    vote_count: 3, platform: 'android', version: '2.6.1', created_at: '2026-06-01T00:00:00Z',
  };

  // Resolving a key reads apps[0] then feedback[0]; setVersion's own reads follow.
  function clientFor(feedback: { id: string }, targetsPerPlatform: number) {
    const platformBuilders = [] as ReturnType<typeof createBuilder>[];
    const targetBuilders = [] as ReturnType<typeof createBuilder>[];
    for (let i = 0; i < targetsPerPlatform; i++) {
      platformBuilders.push(createBuilder({ data: { status: 'released', released_at: '2026-09-01T00:00:00Z' }, error: null }));
      platformBuilders.push(createBuilder({ data: null, error: null }));
      targetBuilders.push(createBuilder({ data: null, error: null }));
      targetBuilders.push(createBuilder({ data: null, error: null }));
    }
    const builders = {
      feedback: [
        createBuilder({ data: { ...REF_ROW, id: feedback.id }, error: null }),
        createBuilder({ data: feedback, error: null }),
        createBuilder({ data: { ...UPDATED, id: feedback.id }, error: null }),
      ],
      apps: [createBuilder({ data: REF_APP, error: null }), createBuilder({ data: APP_ROW, error: null })],
      release_groups: [createBuilder({ data: GROUP, error: null })],
      release_group_platforms: platformBuilders,
      feedback_release_targets: targetBuilders,
    };
    return { client: createClient(builders), builders };
  }

  it('targets a bug at its own platform and mirrors the legacy version column', async () => {
    const { client, builders } = clientFor(BUG, 1);

    const outcome = await setVersion(client, 'MYAPP-7', '2.6.1');

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = outcome.data as any;
      expect(data.target_platforms).toEqual(['android']);
      expect(data.release.semver).toBe('2.6.1');
      expect(data.feedback.version).toBe('2.6.1');
      expect(data.feedback.key).toBe('MYAPP-7');
      expect(JSON.stringify(data)).not.toContain('app_id');
    }
    // Existing platform row keeps its released state.
    expect(builders.release_group_platforms[1].upsert).toHaveBeenCalledWith(
      { release_group_id: 'rg-1', platform: 'android', version: '2.6.1', status: 'released', released_at: '2026-09-01T00:00:00Z' },
      { onConflict: 'release_group_id,platform' }
    );
    // A per-platform target replaces that platform's and any "all" target.
    expect(builders.feedback_release_targets[0].delete).toHaveBeenCalled();
    expect(builders.feedback_release_targets[0].or).toHaveBeenCalledWith('platform.eq.android,platform.eq.all');
    expect(builders.feedback_release_targets[1].upsert).toHaveBeenCalledWith(
      { feedback_id: 'f-1', release_group_id: 'rg-1', platform: 'android' },
      { onConflict: 'feedback_id,release_group_id,platform' }
    );
    expect(builders.feedback[2].update).toHaveBeenCalledWith({ version: '2.6.1' });
  });

  it('targets a feature at every platform of the app', async () => {
    const { client, builders } = clientFor(FEATURE, 2);

    const outcome = await setVersion(client, 'MYAPP-7', '2.6.1');

    expect(outcome.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (outcome.ok) expect((outcome.data as any).target_platforms).toEqual(['ios', 'android']);
    expect(builders.feedback_release_targets[1].upsert).toHaveBeenCalledWith(
      expect.objectContaining({ feedback_id: 'f-2', platform: 'ios' }), expect.anything()
    );
    expect(builders.feedback_release_targets[3].upsert).toHaveBeenCalledWith(
      expect.objectContaining({ feedback_id: 'f-2', platform: 'android' }), expect.anything()
    );
  });

  it('replaces every per-platform target when assigning to all', async () => {
    const { client, builders } = clientFor(BUG, 1);

    const outcome = await setVersion(client, 'MYAPP-7', '2.6.1', ['all']);

    expect(outcome.ok).toBe(true);
    expect(builders.feedback_release_targets[0].delete).toHaveBeenCalled();
    expect(builders.feedback_release_targets[0].or).not.toHaveBeenCalled();
  });

  it('refuses an unknown release and lists the existing ones', async () => {
    const client = createClient({
      feedback: [createBuilder({ data: REF_ROW, error: null }), createBuilder({ data: BUG, error: null })],
      apps: [createBuilder({ data: REF_APP, error: null }), createBuilder({ data: APP_ROW, error: null })],
      release_groups: [
        createBuilder({ data: null, error: null }),
        createBuilder({ data: [{ semver: '2.6.1' }, { semver: '2.6.0' }], error: null }),
      ],
    });

    const outcome = await setVersion(client, 'MYAPP-7', '9.9.9');

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe("No release '9.9.9' for this app. Available versions: 2.6.1, 2.6.0. Create new releases in the admin UI.");
    expect(client.from).not.toHaveBeenCalledWith('feedback_release_targets');
  });

  it('returns a helpful error for an unknown item', async () => {
    const client = createClient({ apps: [createBuilder({ data: null, error: null })] });

    const outcome = await setVersion(client, 'NOPE-1', '2.6.1');

    expect(outcome).toEqual({ ok: false, error: "No feedback item 'NOPE-1'. Use list_feedback to find valid keys." });
    expect(client.from).not.toHaveBeenCalledWith('release_groups');
  });
});
