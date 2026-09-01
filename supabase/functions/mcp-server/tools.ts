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

export type NotificationSender = (payload: unknown) => Promise<void>;

export async function updateStatus(
  serviceClient: SupabaseLike,
  feedbackId: string,
  status: string,
  notify: NotificationSender
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

const ALL_PLATFORMS = 'all';

/**
 * Which platform targets a version assignment creates when the caller does not say.
 * Mirrors how the admin UI is used in practice: a feature ships on every platform
 * the app has, a bug ships on the platform it was reported for.
 */
export function resolveTargetPlatforms(input: {
  requested?: string[];
  type: string;
  platform: string | null;
  appPlatforms: string[];
}): { ok: true; platforms: string[] } | { ok: false; error: string } {
  const allowed = [...input.appPlatforms, ALL_PLATFORMS];
  const requested = (input.requested ?? []).map((p) => p.trim()).filter((p) => p.length > 0);
  if (requested.length > 0) {
    const unknown = requested.filter((p) => !allowed.includes(p));
    if (unknown.length > 0) {
      return {
        ok: false,
        error: `Unknown platform(s) ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}.`,
      };
    }
    return { ok: true, platforms: Array.from(new Set(requested)) };
  }
  if (input.type === 'bug' && input.platform && allowed.includes(input.platform)) {
    return { ok: true, platforms: [input.platform] };
  }
  return { ok: true, platforms: input.appPlatforms.length > 0 ? [...input.appPlatforms] : [ALL_PLATFORMS] };
}

/**
 * Assigns a feedback item to a release, the way the admin UI's release picker does
 * (useReleases.assignFeedbackRelease): one feedback_release_targets row per platform,
 * the release_group_platforms row kept (published state preserved), and the legacy
 * feedback.version column mirrored. The release must already exist - an agent typo must
 * not create a stray release the way the UI's upsert would. No e-mail: the UI sends none
 * for a version change either.
 */
export async function setVersion(
  serviceClient: SupabaseLike,
  feedbackId: string,
  version: string,
  platforms?: string[]
): Promise<ToolOutcome> {
  const semver = version.trim();
  if (semver.length === 0) {
    return { ok: false, error: 'Version must not be empty.' };
  }

  const { data: feedback, error: feedbackError } = await serviceClient
    .from('feedback')
    .select('id, type, platform, app_id')
    .eq('id', feedbackId)
    .maybeSingle();
  throwIfError(feedbackError);
  if (!feedback) {
    return {
      ok: false,
      error: `No feedback item with id '${feedbackId}'. Use list_feedback to find valid ids.`,
    };
  }

  const { data: app, error: appError } = await serviceClient
    .from('apps')
    .select('id, name, slug, platforms')
    .eq('id', feedback.app_id)
    .maybeSingle();
  throwIfError(appError);
  const appPlatforms: string[] = app?.platforms ?? [];

  const { data: group, error: groupError } = await serviceClient
    .from('release_groups')
    .select('id, semver')
    .eq('app_id', feedback.app_id)
    .eq('semver', semver)
    .maybeSingle();
  throwIfError(groupError);
  if (!group) {
    const { data: available, error: availableError } = await serviceClient
      .from('release_groups')
      .select('semver')
      .eq('app_id', feedback.app_id)
      .order('created_at', { ascending: false });
    throwIfError(availableError);
    const semvers = (available ?? []).map((row: { semver: string }) => row.semver);
    const hint = semvers.length > 0
      ? `Available versions: ${semvers.join(', ')}. Create new releases in the admin UI.`
      : 'This app has no releases yet. Create one in the admin UI first.';
    return { ok: false, error: `No release '${semver}' for this app. ${hint}` };
  }

  const resolved = resolveTargetPlatforms({
    requested: platforms,
    type: feedback.type,
    platform: feedback.platform,
    appPlatforms,
  });
  if (!resolved.ok) return resolved;

  for (const platform of resolved.platforms) {
    // Preserve published metadata for an existing platform row.
    const { data: existingPlatform, error: existingError } = await serviceClient
      .from('release_group_platforms')
      .select('status, released_at')
      .eq('release_group_id', group.id)
      .eq('platform', platform)
      .maybeSingle();
    throwIfError(existingError);

    const { error: platformError } = await serviceClient
      .from('release_group_platforms')
      .upsert(
        {
          release_group_id: group.id,
          platform,
          version: semver,
          status: existingPlatform?.status ?? 'planned',
          released_at: existingPlatform?.released_at ?? null,
        },
        { onConflict: 'release_group_id,platform' }
      );
    throwIfError(platformError);

    // An "all" target replaces per-platform ones, a per-platform target replaces "all".
    let removal = serviceClient
      .from('feedback_release_targets')
      .delete()
      .eq('feedback_id', feedbackId);
    if (platform !== ALL_PLATFORMS) {
      removal = removal.or(`platform.eq.${platform},platform.eq.${ALL_PLATFORMS}`);
    }
    const { error: removalError } = await removal;
    throwIfError(removalError);

    const { error: targetError } = await serviceClient
      .from('feedback_release_targets')
      .upsert(
        { feedback_id: feedbackId, release_group_id: group.id, platform },
        { onConflict: 'feedback_id,release_group_id,platform' }
      );
    throwIfError(targetError);
  }

  const { data: updated, error: updateError } = await serviceClient
    .from('feedback')
    .update({ version: semver })
    .eq('id', feedbackId)
    .select(FEEDBACK_COLUMNS)
    .maybeSingle();
  throwIfError(updateError);

  return {
    ok: true,
    data: {
      feedback: updated,
      release: { semver: group.semver },
      target_platforms: resolved.platforms,
    },
  };
}
