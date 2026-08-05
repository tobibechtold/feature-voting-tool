import { describe, expect, it, vi } from 'vitest';
import { getVersionPlan, listApps, listFeedback } from './tools';

type QueryResult = { data: unknown; error: Error | null };

// Chainable mock: every builder method returns the builder; the builder is
// awaitable and resolves to `result`. Mirrors the postgrest-js API shape.
function createBuilder(result: QueryResult) {
  const builder: any = {
    calls: [] as Array<[string, unknown[]]>,
    then(resolve: (value: QueryResult) => unknown) {
      return Promise.resolve(result).then(resolve);
    },
  };
  for (const method of ['select', 'eq', 'is', 'order', 'maybeSingle']) {
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
