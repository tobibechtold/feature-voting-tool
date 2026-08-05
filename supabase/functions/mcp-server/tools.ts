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
