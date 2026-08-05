// Pure tool handlers for the mcp-server edge function. No Deno APIs here:
// this module is unit-tested under Node via Vitest.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
