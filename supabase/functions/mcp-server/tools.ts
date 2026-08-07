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
