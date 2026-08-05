# Agent MCP API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A remote MCP server (Supabase Edge Function) that lets AI agents read apps, version plans, and feedback via admin-generated API tokens, plus the admin UI to manage those tokens.

**Architecture:** A new `api_tokens` table with a `SECURITY DEFINER` RPC for token creation; a `mcp-server` edge function using the official MCP TypeScript SDK over streamable HTTP in stateless mode, with pure logic modules (`auth.ts`, `tools.ts`) tested by Vitest; an "API Tokens" card on the Admin page backed by a `useApiTokens` hook.

**Tech Stack:** Supabase Postgres + RLS + Edge Functions (Deno), `@modelcontextprotocol/sdk`, React 18 + TanStack Query + shadcn/ui, Vitest.

**Spec:** `docs/plans/2026-08-05-agent-mcp-api-design.md`

## Global Constraints

- Migrations are append-only; never edit existing files in `supabase/migrations/`.
- Data fetching/mutations live in hooks (`src/hooks/*`), UI stays presentational.
- New table/RPC types must be added to `src/types/database.ts`.
- Tool outputs must never include `feedback.submitter_email`, `feedback.notify_on_updates`, `comments.commenter_email`, or `comments.notify_on_reply`.
- Pure modules under `supabase/functions/mcp-server/` must not use Deno-specific APIs (they run under Node in Vitest). Only `index.ts` may use Deno imports.
- ASCII only in edited files unless the file already requires Unicode (i18n.ts contains German text; that is fine).
- TDD: write the failing test first for every behavior change.
- Verification before completion: `npm run test` and `npm run lint` must pass before each commit.

---

### Task 1: `api_tokens` migration and `create_api_token` RPC

**Files:**
- Create: `supabase/migrations/20260805120000_add_api_tokens.sql`

**Interfaces:**
- Produces: table `public.api_tokens` (columns `id uuid`, `name text`, `token_hash text unique`, `created_by uuid`, `created_at timestamptz`, `last_used_at timestamptz null`, `revoked_at timestamptz null`) and RPC `public.create_api_token(p_name text) returns text` (plaintext token, admin-only). Later tasks rely on these exact names.

There is no automated Postgres test harness in this repo; this task is verified by review now and end-to-end in Task 10 (do NOT run `db push` here).

- [ ] **Step 1: Write the migration**

```sql
begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.api_tokens enable row level security;

drop policy if exists "Admins can view api tokens" on public.api_tokens;
create policy "Admins can view api tokens"
  on public.api_tokens for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins can update api tokens" on public.api_tokens;
create policy "Admins can update api tokens"
  on public.api_tokens for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- No insert/delete policies: creation goes through the RPC below (which
-- hashes the token), and tokens are revoked rather than deleted.

create or replace function public.create_api_token(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can create API tokens';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Token name is required';
  end if;

  v_token := 'fvt_' || encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.api_tokens (name, token_hash, created_by)
  values (trim(p_name), encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid());

  return v_token;
end;
$$;

revoke execute on function public.create_api_token(text) from public;
revoke execute on function public.create_api_token(text) from anon;
grant execute on function public.create_api_token(text) to authenticated;

commit;
```

- [ ] **Step 2: Review against existing patterns**

Compare policy style with `supabase/migrations/20260302033500_release_groups_per_platform_recovery.sql` (uses `drop policy if exists` + `create policy`, `begin;`/`commit;` wrapper). Confirm `has_role` is called as `public.has_role(auth.uid(), 'admin')` matching existing policies in `20260301014415_remote_schema.sql`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260805120000_add_api_tokens.sql
git commit -m "feat: add api_tokens table and create_api_token RPC"
```

---

### Task 2: Vitest coverage for edge function modules + auth helpers

**Files:**
- Modify: `vitest.config.ts` (include pattern)
- Create: `supabase/functions/mcp-server/auth.ts`
- Test: `supabase/functions/mcp-server/auth.test.ts`

**Interfaces:**
- Produces: `extractBearerToken(header: string | null): string | null` and `sha256Hex(value: string): Promise<string>` (lowercase hex). Task 6 imports both from `./auth.ts`.

- [ ] **Step 1: Extend Vitest include pattern**

In `vitest.config.ts`, change:

```ts
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
```

to:

```ts
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "supabase/functions/**/*.{test,spec}.ts",
    ],
```

- [ ] **Step 2: Write the failing test**

`supabase/functions/mcp-server/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractBearerToken, sha256Hex } from './auth';

describe('extractBearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(extractBearerToken('Bearer fvt_abc123')).toBe('fvt_abc123');
  });

  it('is case-insensitive for the Bearer prefix', () => {
    expect(extractBearerToken('bearer fvt_abc123')).toBe('fvt_abc123');
  });

  it('returns null for a missing header', () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it('returns null for a non-bearer header', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null for a Bearer header without a token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
  });
});

describe('sha256Hex', () => {
  it('hashes to lowercase hex (known vector)', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('produces 64 hex chars for arbitrary input', async () => {
    const hash = await sha256Hex('fvt_' + 'a'.repeat(64));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run supabase/functions/mcp-server/auth.test.ts`
Expected: FAIL (cannot resolve `./auth`)

- [ ] **Step 4: Write the implementation**

`supabase/functions/mcp-server/auth.ts`:

```ts
export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/mcp-server/auth.test.ts`
Expected: PASS (7 tests). Also run `npm run test` to confirm the include change broke nothing.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts supabase/functions/mcp-server/auth.ts supabase/functions/mcp-server/auth.test.ts
git commit -m "feat: add mcp-server auth helpers with vitest coverage"
```

---

### Task 3: Tools module — `listApps` and `listFeedback`

**Files:**
- Create: `supabase/functions/mcp-server/tools.ts`
- Test: `supabase/functions/mcp-server/tools.test.ts`

**Interfaces:**
- Produces (Tasks 4-6 depend on these exact signatures):

```ts
export type SupabaseLike = { from(table: string): any };
export type ToolOutcome =
  | { ok: true; data: unknown }
  | { ok: false; error: string };
export const FEEDBACK_COLUMNS =
  'id, type, title, description, status, vote_count, platform, version, created_at';
export async function listApps(client: SupabaseLike): Promise<ToolOutcome>;
export async function listFeedback(
  client: SupabaseLike,
  appSlug: string,
  filters: { status?: string; type?: string }
): Promise<ToolOutcome>;
```

- Conventions: "not found" returns `{ ok: false, error }` with a helpful message; database errors `throw` (the wiring in Task 6 reports those as internal errors). PII columns are never selected.

- [ ] **Step 1: Write the failing tests**

`supabase/functions/mcp-server/tools.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { listApps, listFeedback } from './tools';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/mcp-server/tools.test.ts`
Expected: FAIL (cannot resolve `./tools`)

- [ ] **Step 3: Write the implementation**

`supabase/functions/mcp-server/tools.ts`:

```ts
// Pure tool handlers for the mcp-server edge function. No Deno APIs here:
// this module is unit-tested under Node via Vitest.

export type SupabaseLike = { from(table: string): any };

export type ToolOutcome =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

// Excludes submitter_email / notify_on_updates on purpose: agent-facing
// output must not contain PII even though the columns are publicly readable.
export const FEEDBACK_COLUMNS =
  'id, type, title, description, status, vote_count, platform, version, created_at';

function throwIfError(error: { message?: string } | Error | null): void {
  if (error) {
    throw error instanceof Error ? error : new Error(error.message ?? 'Database error');
  }
}

async function findAppBySlug(
  client: SupabaseLike,
  appSlug: string
): Promise<{ app: { id: string; name: string; slug: string } | null }> {
  const { data, error } = await client
    .from('apps')
    .select('id, name, slug')
    .eq('slug', appSlug)
    .maybeSingle();
  throwIfError(error);
  return { app: data };
}

const UNKNOWN_APP = (slug: string) =>
  `No app with slug '${slug}'. Use list_apps to see valid slugs.`;

export async function listApps(client: SupabaseLike): Promise<ToolOutcome> {
  const { data, error } = await client
    .from('apps')
    .select('id, name, slug, description, platforms')
    .order('name');
  throwIfError(error);
  return { ok: true, data: { apps: data ?? [] } };
}

export async function listFeedback(
  client: SupabaseLike,
  appSlug: string,
  filters: { status?: string; type?: string }
): Promise<ToolOutcome> {
  const { app } = await findAppBySlug(client, appSlug);
  if (!app) return { ok: false, error: UNKNOWN_APP(appSlug) };

  let query = client
    .from('feedback')
    .select(FEEDBACK_COLUMNS)
    .eq('app_id', app.id);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.type) query = query.eq('type', filters.type);

  const { data, error } = await query.order('created_at', { ascending: false });
  throwIfError(error);
  return { ok: true, data: { app, feedback: data ?? [] } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/mcp-server/tools.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/mcp-server/tools.ts supabase/functions/mcp-server/tools.test.ts
git commit -m "feat: add list_apps and list_feedback tool handlers"
```

---

### Task 4: Tools module — `getVersionPlan`

**Files:**
- Modify: `supabase/functions/mcp-server/tools.ts`
- Test: `supabase/functions/mcp-server/tools.test.ts` (append)

**Interfaces:**
- Consumes: `SupabaseLike`, `ToolOutcome`, `FEEDBACK_COLUMNS`, `findAppBySlug`, `UNKNOWN_APP`, `throwIfError` from Task 3.
- Produces: `getVersionPlan(client: SupabaseLike, appSlug: string, version: string): Promise<ToolOutcome>`. Success data shape:

```ts
{
  app: { id, name, slug },
  release: { semver, title, notes, created_at },
  platforms: Array<{ platform, version, status, released_at }>,
  items: Array<{ ...FEEDBACK_COLUMNS fields, target_platforms: string[] }>,
}
```

- [ ] **Step 1: Write the failing tests**

Append to `supabase/functions/mcp-server/tools.test.ts` (uses the existing `createBuilder`/`createClient` helpers; add `getVersionPlan` to the import from `./tools`):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/mcp-server/tools.test.ts`
Expected: FAIL (`getVersionPlan` is not exported)

- [ ] **Step 3: Write the implementation**

Append to `supabase/functions/mcp-server/tools.ts`:

```ts
export async function getVersionPlan(
  client: SupabaseLike,
  appSlug: string,
  version: string
): Promise<ToolOutcome> {
  const { app } = await findAppBySlug(client, appSlug);
  if (!app) return { ok: false, error: UNKNOWN_APP(appSlug) };

  const { data: group, error } = await client
    .from('release_groups')
    .select(
      `semver, title, notes, created_at,
       release_group_platforms ( platform, version, status, released_at ),
       feedback_release_targets ( platform, feedback ( ${FEEDBACK_COLUMNS} ) )`
    )
    .eq('app_id', app.id)
    .eq('semver', version)
    .maybeSingle();
  throwIfError(error);

  if (!group) {
    const { data: available, error: availableError } = await client
      .from('release_groups')
      .select('semver')
      .eq('app_id', app.id)
      .order('created_at', { ascending: false });
    throwIfError(availableError);
    const semvers = (available ?? []).map((row: { semver: string }) => row.semver);
    const hint = semvers.length > 0
      ? `Available versions: ${semvers.join(', ')}.`
      : 'This app has no releases yet.';
    return {
      ok: false,
      error: `No release '${version}' for app '${appSlug}'. ${hint}`,
    };
  }

  // One feedback item can target several platforms; dedupe by feedback id
  // and collect the platforms instead of repeating the item.
  const itemsById = new Map<string, Record<string, unknown> & { target_platforms: string[] }>();
  for (const target of group.feedback_release_targets ?? []) {
    if (!target.feedback) continue;
    const existing = itemsById.get(target.feedback.id);
    if (existing) {
      existing.target_platforms.push(target.platform);
    } else {
      itemsById.set(target.feedback.id, { ...target.feedback, target_platforms: [target.platform] });
    }
  }

  return {
    ok: true,
    data: {
      app,
      release: {
        semver: group.semver,
        title: group.title,
        notes: group.notes,
        created_at: group.created_at,
      },
      platforms: group.release_group_platforms ?? [],
      items: Array.from(itemsById.values()),
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/mcp-server/tools.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/mcp-server/tools.ts supabase/functions/mcp-server/tools.test.ts
git commit -m "feat: add get_version_plan tool handler"
```

---

### Task 5: Tools module — `getFeedback`

**Files:**
- Modify: `supabase/functions/mcp-server/tools.ts`
- Test: `supabase/functions/mcp-server/tools.test.ts` (append)

**Interfaces:**
- Consumes: `SupabaseLike`, `ToolOutcome`, `FEEDBACK_COLUMNS`, `throwIfError` from Task 3.
- Produces: `getFeedback(client: SupabaseLike, feedbackId: string): Promise<ToolOutcome>`. Success data shape:

```ts
{
  feedback: { ...FEEDBACK_COLUMNS fields },
  comments: Array<{ id, content, is_admin, created_at }>,
  attachments: string[],  // image URLs
}
```

- [ ] **Step 1: Write the failing tests**

Append to `supabase/functions/mcp-server/tools.test.ts` (add `getFeedback` to the import from `./tools`):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run supabase/functions/mcp-server/tools.test.ts`
Expected: FAIL (`getFeedback` is not exported)

- [ ] **Step 3: Write the implementation**

Append to `supabase/functions/mcp-server/tools.ts`:

```ts
export async function getFeedback(
  client: SupabaseLike,
  feedbackId: string
): Promise<ToolOutcome> {
  const { data: feedback, error } = await client
    .from('feedback')
    .select(FEEDBACK_COLUMNS)
    .eq('id', feedbackId)
    .maybeSingle();
  throwIfError(error);
  if (!feedback) {
    return {
      ok: false,
      error: `No feedback item with id '${feedbackId}'. Use list_feedback to find valid ids.`,
    };
  }

  const { data: comments, error: commentsError } = await client
    .from('comments')
    .select('id, content, is_admin, created_at')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true });
  throwIfError(commentsError);

  const { data: attachments, error: attachmentsError } = await client
    .from('feedback_attachments')
    .select('image_url')
    .eq('feedback_id', feedbackId);
  throwIfError(attachmentsError);

  return {
    ok: true,
    data: {
      feedback,
      comments: comments ?? [],
      attachments: (attachments ?? []).map((row: { image_url: string }) => row.image_url),
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/mcp-server/tools.test.ts`
Expected: PASS. Also run `npm run test` and `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/mcp-server/tools.ts supabase/functions/mcp-server/tools.test.ts
git commit -m "feat: add get_feedback tool handler"
```

---

### Task 6: Edge function wiring (`index.ts`), config, deploy script

**Files:**
- Create: `supabase/functions/mcp-server/index.ts`
- Modify: `supabase/config.toml`
- Modify: `package.json` (`supabase:functions:deploy` script)

**Interfaces:**
- Consumes: `extractBearerToken`, `sha256Hex` from `./auth.ts`; `listApps`, `getVersionPlan`, `listFeedback`, `getFeedback`, `ToolOutcome` from `./tools.ts`.
- Produces: HTTP endpoint `POST /functions/v1/mcp-server` speaking MCP streamable HTTP (stateless, JSON responses). 401 for missing/invalid/revoked tokens.

This file is Deno-only and not unit-tested; it is verified end-to-end in Task 10.

- [ ] **Step 1: Write `index.ts`**

```ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { StreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/streamableHttp.js";
import { toFetchResponse, toReqRes } from "npm:fetch-to-node@^2.1.0";
import { z } from "npm:zod@^3.24.0";
import { extractBearerToken, sha256Hex } from "./auth.ts";
import {
  getFeedback,
  getVersionPlan,
  listApps,
  listFeedback,
  type ToolOutcome,
} from "./tools.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FEEDBACK_STATUSES = ["open", "planned", "progress", "completed", "wont_do"] as const;
const FEEDBACK_TYPES = ["feature", "bug"] as const;

function toToolResult(outcome: ToolOutcome) {
  if (!outcome.ok) {
    return { content: [{ type: "text" as const, text: outcome.error }], isError: true };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(outcome.data, null, 2) }] };
}

function buildServer(dataClient: ReturnType<typeof createClient>): McpServer {
  const server = new McpServer({ name: "feature-voting-tool", version: "1.0.0" });

  server.registerTool(
    "list_apps",
    {
      description: "List all apps in the feedback tool with their slugs and platforms. Use the slug as the 'app' argument for other tools.",
      inputSchema: {},
    },
    async () => toToolResult(await listApps(dataClient))
  );

  server.registerTool(
    "get_version_plan",
    {
      description: "Get everything planned or released for one version of an app: release title/notes, per-platform release status, and every bug/feature assigned to the version with full descriptions.",
      inputSchema: {
        app: z.string().describe("App slug (see list_apps)"),
        version: z.string().describe("Semver of the release, e.g. '1.3.0'"),
      },
    },
    async ({ app, version }) => toToolResult(await getVersionPlan(dataClient, app, version))
  );

  server.registerTool(
    "list_feedback",
    {
      description: "List feedback items (bugs and feature requests) for an app with full descriptions, newest first. Useful for scanning for duplicates or already-fixed bugs.",
      inputSchema: {
        app: z.string().describe("App slug (see list_apps)"),
        status: z.enum(FEEDBACK_STATUSES).optional().describe("Filter by status"),
        type: z.enum(FEEDBACK_TYPES).optional().describe("Filter by type"),
      },
    },
    async ({ app, status, type }) => toToolResult(await listFeedback(dataClient, app, { status, type }))
  );

  server.registerTool(
    "get_feedback",
    {
      description: "Get one feedback item by id, including its comments and attachment image URLs.",
      inputSchema: {
        id: z.string().uuid().describe("Feedback item id"),
      },
    },
    async ({ id }) => toToolResult(await getFeedback(dataClient, id))
  );

  return server;
}

function unauthorized(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: provide a valid API token as 'Authorization: Bearer fvt_...'" },
      id: null,
    }),
    { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token || !token.startsWith("fvt_")) return unauthorized();

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const tokenHash = await sha256Hex(token);
    const { data: tokenRow, error: tokenError } = await service
      .from("api_tokens")
      .select("id")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (tokenError || !tokenRow) return unauthorized();

    try {
      await service
        .from("api_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);
    } catch (_err) {
      // Best effort only; auth already succeeded.
    }

    // Parse the body BEFORE toReqRes so the request stream is not consumed
    // twice; handleRequest accepts the pre-parsed body as its third argument.
    const body = await req.json();
    const { req: nodeReq, res: nodeRes } = toReqRes(req);

    const dataClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const server = buildServer(dataClient);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    await transport.handleRequest(nodeReq, nodeRes, body);

    const response = await toFetchResponse(nodeRes);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    console.error("Error in mcp-server function:", error);
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
```

- [ ] **Step 2: Register the function in `supabase/config.toml`**

Append:

```toml

[functions.mcp-server]
verify_jwt = false
```

- [ ] **Step 3: Add to the deploy script in `package.json`**

Change:

```json
    "supabase:functions:deploy": "supabase functions deploy verify-comment && supabase functions deploy send-notification"
```

to:

```json
    "supabase:functions:deploy": "supabase functions deploy verify-comment && supabase functions deploy send-notification && supabase functions deploy mcp-server"
```

- [ ] **Step 4: Verify what can be verified locally**

Run: `npm run test && npm run lint`
Expected: PASS (the Deno file is outside the Vite/ESLint src scope; existing tests still green).
If the Deno CLI is installed (`deno --version` succeeds), also run: `deno check --allow-import supabase/functions/mcp-server/index.ts` and fix any type errors. If Deno is not installed, note that in the commit and rely on Task 10.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/mcp-server/index.ts supabase/config.toml package.json
git commit -m "feat: add mcp-server edge function speaking MCP streamable HTTP"
```

---

### Task 7: `api_tokens` types and `useApiTokens` hook

**Files:**
- Modify: `src/types/database.ts`
- Create: `src/hooks/useApiTokens.ts`
- Test: `src/hooks/useApiTokens.test.ts`

**Interfaces:**
- Consumes: table/RPC from Task 1 (`api_tokens`, `create_api_token(p_name)`).
- Produces (Task 8 depends on these):

```ts
export interface ApiToken {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
export async function fetchApiTokens(client): Promise<ApiToken[]>;
export async function createApiToken(client, name: string): Promise<string>; // plaintext token
export async function revokeApiToken(client, id: string): Promise<void>;
export function useApiTokens(): UseQueryResult<ApiToken[]>;      // queryKey ['api-tokens']
export function useCreateApiToken(): UseMutationResult<string, Error, string>;
export function useRevokeApiToken(): UseMutationResult<void, Error, string>;
```

- [ ] **Step 1: Add types to `src/types/database.ts`**

Inside `Tables`, after the `feedback_attachments` block, add:

```ts
      api_tokens: {
        Row: {
          id: string
          name: string
          token_hash: string
          created_by: string
          created_at: string
          last_used_at: string | null
          revoked_at: string | null
        }
        Insert: {
          id?: string
          name: string
          token_hash: string
          created_by: string
          created_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          token_hash?: string
          created_by?: string
          created_at?: string
          last_used_at?: string | null
          revoked_at?: string | null
        }
      }
```

Inside `Functions`, after the `delete_app_cascade` block, add:

```ts
      create_api_token: {
        Args: {
          p_name: string
        }
        Returns: string
      }
```

- [ ] **Step 2: Write the failing tests**

`src/hooks/useApiTokens.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createApiToken, fetchApiTokens, revokeApiToken } from './useApiTokens';

function createMockClient(options: {
  rows?: unknown[];
  rpcResult?: { data: unknown; error: Error | null };
  updateError?: Error | null;
  selectError?: Error | null;
}) {
  const eq = vi.fn(async () => ({ error: options.updateError ?? null }));
  const update = vi.fn(() => ({ eq }));
  const order = vi.fn(async () => ({ data: options.rows ?? [], error: options.selectError ?? null }));
  const select = vi.fn(() => ({ order }));
  const rpc = vi.fn(async () => options.rpcResult ?? { data: null, error: null });
  const from = vi.fn((table: string) => {
    if (table !== 'api_tokens') throw new Error(`Unexpected table ${table}`);
    return { select, update };
  });
  return { from, rpc, select, order, update, eq };
}

describe('fetchApiTokens', () => {
  it('lists tokens newest first', async () => {
    const rows = [{ id: 't-1', name: 'laptop', created_at: '2026-08-01T00:00:00Z', last_used_at: null, revoked_at: null }];
    const client = createMockClient({ rows });

    const tokens = await fetchApiTokens(client);

    expect(tokens).toEqual(rows);
    expect(client.select).toHaveBeenCalledWith('id, name, created_at, last_used_at, revoked_at');
    expect(client.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('throws on error', async () => {
    const client = createMockClient({ selectError: new Error('boom') });
    await expect(fetchApiTokens(client)).rejects.toThrow('boom');
  });
});

describe('createApiToken', () => {
  it('calls the RPC and returns the plaintext token', async () => {
    const client = createMockClient({ rpcResult: { data: 'fvt_secret', error: null } });

    const token = await createApiToken(client, 'laptop');

    expect(token).toBe('fvt_secret');
    expect(client.rpc).toHaveBeenCalledWith('create_api_token', { p_name: 'laptop' });
  });

  it('throws when the RPC returns no token', async () => {
    const client = createMockClient({ rpcResult: { data: null, error: null } });
    await expect(createApiToken(client, 'laptop')).rejects.toThrow();
  });
});

describe('revokeApiToken', () => {
  it('sets revoked_at on the token row', async () => {
    const client = createMockClient({});

    await revokeApiToken(client, 't-1');

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) })
    );
    expect(client.eq).toHaveBeenCalledWith('id', 't-1');
  });

  it('throws on error', async () => {
    const client = createMockClient({ updateError: new Error('nope') });
    await expect(revokeApiToken(client, 't-1')).rejects.toThrow('nope');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useApiTokens.test.ts`
Expected: FAIL (cannot resolve `./useApiTokens`)

- [ ] **Step 4: Write the implementation**

`src/hooks/useApiTokens.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ApiToken {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// Minimal client shape so the standalone functions are testable with mocks,
// mirroring the pattern in useReleases.ts.
type ApiTokensClient = {
  from(table: string): any;
  rpc(fn: string, args?: Record<string, unknown>): any;
};

export async function fetchApiTokens(client: ApiTokensClient): Promise<ApiToken[]> {
  const { data, error } = await client
    .from('api_tokens')
    .select('id, name, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApiToken[];
}

export async function createApiToken(client: ApiTokensClient, name: string): Promise<string> {
  const { data, error } = await client.rpc('create_api_token', { p_name: name });
  if (error) throw error;
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Token creation did not return a token');
  }
  return data;
}

export async function revokeApiToken(client: ApiTokensClient, id: string): Promise<void> {
  const { error } = await client
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export function useApiTokens() {
  return useQuery({
    queryKey: ['api-tokens'],
    queryFn: () => fetchApiTokens(supabase),
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createApiToken(supabase, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeApiToken(supabase, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useApiTokens.test.ts`
Expected: PASS. Also run `npm run test` and `npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts src/hooks/useApiTokens.ts src/hooks/useApiTokens.test.ts
git commit -m "feat: add api token types and useApiTokens hook"
```

---

### Task 8: Admin UI — API Tokens card

**Files:**
- Modify: `src/lib/i18n.ts` (new keys, both `en` and `de`)
- Create: `src/components/ApiTokensCard.tsx`
- Modify: `src/pages/Admin.tsx` (render the card)
- Test: `src/components/ApiTokensCard.test.tsx`

**Interfaces:**
- Consumes: `useApiTokens`, `useCreateApiToken`, `useRevokeApiToken`, `ApiToken` from Task 7; existing shadcn components (`Card`, `Button`, `Input`, `Label`, `Dialog`, `AlertDialog`); `useTranslation`; `useToast`.
- Produces: `<ApiTokensCard />` (no props), rendered on the Admin page.

- [ ] **Step 1: Add i18n keys**

In `src/lib/i18n.ts`, add to the `en` object (and matching keys to `de`; match the grammatical style / form of address already used in the existing German strings):

```ts
    // API tokens (admin)
    apiTokens: 'API Tokens',
    apiTokensDescription: 'Tokens let AI agents read feedback data through the MCP API.',
    createToken: 'Create token',
    tokenName: 'Name',
    tokenNamePlaceholder: 'e.g. claude-code laptop',
    tokenCreatedWarning: 'Copy this token now. It cannot be shown again.',
    copyToken: 'Copy token',
    tokenCopied: 'Token copied to clipboard',
    revokeToken: 'Revoke',
    revokeTokenConfirmTitle: 'Revoke this token?',
    revokeTokenConfirmDescription: 'Agents using this token will immediately lose access. This cannot be undone.',
    tokenRevoked: 'Revoked',
    tokenLastUsed: 'Last used',
    tokenNeverUsed: 'Never used',
    noTokens: 'No tokens yet',
```

German suggestions (adjust to match existing tone):

```ts
    apiTokens: 'API-Tokens',
    apiTokensDescription: 'Mit Tokens koennen KI-Agenten Feedback-Daten ueber die MCP-API lesen.',
    createToken: 'Token erstellen',
    tokenName: 'Name',
    tokenNamePlaceholder: 'z. B. claude-code Laptop',
    tokenCreatedWarning: 'Kopiere dieses Token jetzt. Es kann nicht erneut angezeigt werden.',
    copyToken: 'Token kopieren',
    tokenCopied: 'Token in die Zwischenablage kopiert',
    revokeToken: 'Widerrufen',
    revokeTokenConfirmTitle: 'Dieses Token widerrufen?',
    revokeTokenConfirmDescription: 'Agenten mit diesem Token verlieren sofort den Zugriff. Dies kann nicht rueckgaengig gemacht werden.',
    tokenRevoked: 'Widerrufen',
    tokenLastUsed: 'Zuletzt verwendet',
    tokenNeverUsed: 'Nie verwendet',
    noTokens: 'Noch keine Tokens',
```

Note: if the existing German strings use proper umlauts (they will), use real umlauts (`können`, `über`, `rückgängig`) — the ASCII rule bends where the file already requires Unicode.

- [ ] **Step 2: Write the failing component test**

`src/components/ApiTokensCard.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiTokensCard } from './ApiTokensCard';

const mockTokens = vi.fn();
const mockCreate = vi.fn();
const mockRevoke = vi.fn();

vi.mock('@/hooks/useApiTokens', () => ({
  useApiTokens: () => mockTokens(),
  useCreateApiToken: () => ({ mutateAsync: mockCreate, isPending: false }),
  useRevokeApiToken: () => ({ mutateAsync: mockRevoke, isPending: false }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('ApiTokensCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokens.mockReturnValue({ data: [], isLoading: false });
  });

  it('shows an empty state when there are no tokens', () => {
    render(<ApiTokensCard />);
    expect(screen.getByText('noTokens')).toBeInTheDocument();
  });

  it('lists existing tokens with revoked state', () => {
    mockTokens.mockReturnValue({
      data: [
        { id: 't-1', name: 'laptop', created_at: '2026-08-01T00:00:00Z', last_used_at: null, revoked_at: null },
        { id: 't-2', name: 'old', created_at: '2026-07-01T00:00:00Z', last_used_at: '2026-07-02T00:00:00Z', revoked_at: '2026-07-03T00:00:00Z' },
      ],
      isLoading: false,
    });

    render(<ApiTokensCard />);

    expect(screen.getByText('laptop')).toBeInTheDocument();
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('tokenRevoked')).toBeInTheDocument();
  });

  it('shows the plaintext token exactly once after creation, with a warning', async () => {
    mockCreate.mockResolvedValue('fvt_secret_token');

    render(<ApiTokensCard />);

    fireEvent.click(screen.getByRole('button', { name: 'createToken' }));
    fireEvent.change(screen.getByLabelText('tokenName'), { target: { value: 'laptop' } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => {
      expect(screen.getByText('fvt_secret_token')).toBeInTheDocument();
    });
    expect(mockCreate).toHaveBeenCalledWith('laptop');
    expect(screen.getByText('tokenCreatedWarning')).toBeInTheDocument();
  });

  it('revokes a token after confirmation', async () => {
    mockTokens.mockReturnValue({
      data: [{ id: 't-1', name: 'laptop', created_at: '2026-08-01T00:00:00Z', last_used_at: null, revoked_at: null }],
      isLoading: false,
    });
    mockRevoke.mockResolvedValue(undefined);

    render(<ApiTokensCard />);

    fireEvent.click(screen.getByRole('button', { name: 'revokeToken' }));
    // The alert dialog's confirm action reuses the 'revokeToken' label, so
    // once it is open there are two matching buttons; the confirm is last.
    const revokeButtons = await screen.findAllByRole('button', { name: 'revokeToken' });
    fireEvent.click(revokeButtons[revokeButtons.length - 1]);

    await waitFor(() => {
      expect(mockRevoke).toHaveBeenCalledWith('t-1');
    });
  });
});
```

Adapt query/label details to the component as written in Step 4 if they diverge (e.g. the confirm button label); the behaviors under test must not change: empty state, listing with revoked badge, one-time token display with warning, revoke-after-confirm.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/ApiTokensCard.test.tsx`
Expected: FAIL (cannot resolve `./ApiTokensCard`)

- [ ] **Step 4: Write the component**

`src/components/ApiTokensCard.tsx`:

```tsx
import { useState } from 'react';
import { Copy, KeyRound, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { useApiTokens, useCreateApiToken, useRevokeApiToken, ApiToken } from '@/hooks/useApiTokens';

export function ApiTokensCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: tokens, isLoading } = useApiTokens();
  const createToken = useCreateApiToken();
  const revokeToken = useRevokeApiToken();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setName('');
    setCreatedToken(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const token = await createToken.mutateAsync(name.trim());
      setCreatedToken(token);
    } catch (error) {
      toast({ title: String(error), variant: 'destructive' });
    }
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    toast({ title: t('tokenCopied') });
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeToken.mutateAsync(revokeTarget.id);
    } catch (error) {
      toast({ title: String(error), variant: 'destructive' });
    } finally {
      setRevokeTarget(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t('apiTokens')}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t('apiTokensDescription')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t('createToken')}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !tokens || tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noTokens')}</p>
        ) : (
          <ul className="divide-y">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center justify-between py-3 gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{token.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(token.created_at).toLocaleDateString()}
                    {' · '}
                    {token.last_used_at
                      ? `${t('tokenLastUsed')}: ${new Date(token.last_used_at).toLocaleDateString()}`
                      : t('tokenNeverUsed')}
                  </p>
                </div>
                {token.revoked_at ? (
                  <span className="text-xs text-muted-foreground">{t('tokenRevoked')}</span>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setRevokeTarget(token)}>
                    {t('revokeToken')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) closeCreateDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createToken')}</DialogTitle>
            {createdToken && (
              <DialogDescription>{t('tokenCreatedWarning')}</DialogDescription>
            )}
          </DialogHeader>
          {createdToken ? (
            <div className="space-y-4">
              <code className="block break-all rounded bg-muted p-3 text-sm">{createdToken}</code>
              <DialogFooter>
                <Button variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-1" />
                  {t('copyToken')}
                </Button>
                <Button onClick={closeCreateDialog}>{t('close')}</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-name">{t('tokenName')}</Label>
                <Input
                  id="token-name"
                  value={name}
                  placeholder={t('tokenNamePlaceholder')}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>{t('cancel')}</Button>
                <Button onClick={handleCreate} disabled={!name.trim() || createToken.isPending}>
                  {t('submit')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('revokeTokenConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('revokeTokenConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke}>{t('revokeToken')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
```

- [ ] **Step 5: Render the card on the Admin page**

In `src/pages/Admin.tsx`: add `import { ApiTokensCard } from '@/components/ApiTokensCard';` and render `<ApiTokensCard />` directly after the existing apps management card inside the main container (bottom of the page content), wrapped in the same max-width container as the apps card if one is used.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/ApiTokensCard.test.tsx`
Expected: PASS. Then `npm run test && npm run lint` for the full suite.

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n.ts src/components/ApiTokensCard.tsx src/components/ApiTokensCard.test.tsx src/pages/Admin.tsx
git commit -m "feat: add API tokens management to admin page"
```

---

### Task 9: Agent documentation

**Files:**
- Create: `docs/agent-api.md`

**Interfaces:**
- Consumes: tool names/shapes from Tasks 3-6, token flow from Tasks 1 and 8.

- [ ] **Step 1: Write `docs/agent-api.md`**

```markdown
# Agent API (MCP Server)

The feedback tool exposes a remote MCP server so AI agents can read apps,
version plans, and feedback directly.

- Endpoint: `https://<project-ref>.supabase.co/functions/v1/mcp-server`
- Transport: MCP streamable HTTP (stateless), POST only
- Auth: `Authorization: Bearer fvt_...` — create tokens as an admin under
  Admin > API Tokens. The token is shown exactly once; revoke it there too.

## Connect

Claude Code (run inside any project that should use the data):

    claude mcp add --transport http feature-voting \
      https://<project-ref>.supabase.co/functions/v1/mcp-server \
      --header "Authorization: Bearer fvt_..."

claude.ai / cloud agents: add a custom connector with the same URL and header.

## Tools (all read-only)

### list_apps
No arguments. Returns all apps: `id`, `name`, `slug`, `description`,
`platforms`. Use `slug` as the `app` argument everywhere else.

### get_version_plan
Arguments: `app` (slug), `version` (semver, e.g. `1.3.0`).
Returns the release (`semver`, `title`, `notes`), its per-platform state
(`platform`, `version`, `status` planned/released, `released_at`), and every
feedback item assigned to the version with full descriptions and the
platforms it targets. Unknown versions return the list of valid versions.

Typical use: "Implement everything planned for 1.3.0" — the agent calls
`get_version_plan` and works through the items without further explanation.

### list_feedback
Arguments: `app` (slug), optional `status`
(`open|planned|progress|completed|wont_do`), optional `type` (`feature|bug`).
Returns matching items with full descriptions, newest first.

Typical use: scan `status=open` items for duplicates of each other or for
bugs that are already fixed in the codebase.

### get_feedback
Arguments: `id` (uuid). Returns one item plus its comments
(`content`, `is_admin`, `created_at`) and attachment image URLs.

## Notes

- Responses are JSON in a text content block.
- Submitter and commenter email addresses are never included.
- Tokens grant read-only access; write tools may come later.
```

Replace `<project-ref>` with the real project ref (visible in `supabase status` or the Supabase dashboard) before committing if the ref is already public in the repo; otherwise leave the placeholder.

- [ ] **Step 2: Commit**

```bash
git add docs/agent-api.md
git commit -m "docs: document the agent MCP API"
```

---

### Task 10: Deploy and verify end-to-end

**Files:** none (deployment + manual verification)

This task touches the linked production Supabase project. Confirm with the user before running the push/deploy commands if executing autonomously.

- [ ] **Step 1: Apply the migration**

Run: `npm run supabase:db:push`
Expected: `20260805120000_add_api_tokens.sql` applied without errors.

- [ ] **Step 2: Deploy the function**

Run: `supabase functions deploy mcp-server`
Expected: deploy succeeds; function listed in the dashboard.

- [ ] **Step 3: Verify auth rejection**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://<project-ref>.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0.0.0"}}}'
```

Expected: `401`

- [ ] **Step 4: Create a token and verify the happy path**

Have the user (or do it via the running app) log in as admin, create a token named `verification`, and copy it. Then:

```bash
curl -s -X POST https://<project-ref>.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer fvt_..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0.0.0"}}}'
```

Expected: JSON result with `serverInfo.name` = `feature-voting-tool`.

Then list tools and call one:

```bash
curl -s -X POST https://<project-ref>.supabase.co/functions/v1/mcp-server \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer fvt_..." \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_apps","arguments":{}}}'
```

Expected: JSON content listing the real apps.

- [ ] **Step 5: Verify with Claude Code**

```bash
claude mcp add --transport http feature-voting \
  https://<project-ref>.supabase.co/functions/v1/mcp-server \
  --header "Authorization: Bearer fvt_..."
```

In a Claude Code session: ask "What is planned for version X of app Y?" and confirm `get_version_plan` returns the real plan. Confirm `last_used_at` updates in the admin UI.

- [ ] **Step 6: Verify revocation**

Revoke the `verification` token in the admin UI, repeat the Step 4 curl, expect `401`. Create a fresh token for real use.

- [ ] **Step 7: Final check and PR**

Run: `npm run test && npm run lint && npm run build`
Expected: all pass. Then push the branch and open a PR to `main` noting the new endpoint, table, and admin UI section.
