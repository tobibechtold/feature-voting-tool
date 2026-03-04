import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { publicSupabase, supabase } from '@/integrations/supabase/client';
import { FeedbackItem, ReleaseGroup, ReleaseGroupPlatform } from '@/types';
import { compareVersions } from '@/hooks/useChangelog';

export interface ReleaseGroupWithDetails extends ReleaseGroup {
  platforms: ReleaseGroupPlatform[];
  items: Array<{
    feedback: FeedbackItem;
    target_platform: string;
  }>;
}

interface ReleaseGroupQueryRow {
  id: string;
  app_id: string;
  semver: string;
  title: string | null;
  notes: string | null;
  created_at: string;
  release_group_platforms?: ReleaseGroupPlatform[];
  feedback_release_targets?: Array<{
    id: string;
    platform: string;
    feedback?: FeedbackItem | null;
  }>;
}

export interface FeedbackReleaseTargetView {
  id: string;
  platform: string;
  semver: string;
}

type FeedbackReleaseTargetRow = {
  release_group: { semver: string } | null;
};

export function useReleaseGroups(appId: string | undefined) {
  return useQuery({
    queryKey: ['release-groups', appId],
    queryFn: async () => {
      if (!appId) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (publicSupabase as any)
        .from('release_groups')
        .select(`
          id,
          app_id,
          semver,
          title,
          notes,
          created_at,
          release_group_platforms (
            id,
            release_group_id,
            platform,
            version,
            status,
            released_at,
            created_at
          ),
          feedback_release_targets (
            id,
            platform,
            feedback:feedback_id (
              id,
              app_id,
              type,
              title,
              description,
              status,
              vote_count,
              created_at,
              submitter_email,
              notify_on_updates,
              version,
              platform
            )
          )
        `)
        .eq('app_id', appId);

      if (error) throw error;

      const groups = ((data || []) as ReleaseGroupQueryRow[])
        .map((row) => ({
          id: row.id,
          app_id: row.app_id,
          semver: row.semver,
          title: row.title,
          notes: row.notes,
          created_at: row.created_at,
          platforms: [...(row.release_group_platforms || [])].sort((a, b) => {
            if (a.platform === 'all') return -1;
            if (b.platform === 'all') return 1;
            return a.platform.localeCompare(b.platform);
          }),
          items: (row.feedback_release_targets || [])
            .filter((target) => !!target.feedback)
            .map((target) => ({
              feedback: target.feedback as FeedbackItem,
              target_platform: target.platform,
            })),
        }))
        .sort((a, b) => compareVersions(a.semver, b.semver));

      return groups as ReleaseGroupWithDetails[];
    },
    enabled: !!appId,
  });
}

export function useFeedbackReleaseTargets(feedbackId: string | undefined) {
  return useQuery({
    queryKey: ['feedback-release-targets', feedbackId],
    queryFn: async () => {
      if (!feedbackId) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (publicSupabase as any)
        .from('feedback_release_targets')
        .select(`
          id,
          platform,
          release_group:release_group_id (
            semver
          )
        `)
        .eq('feedback_id', feedbackId);

      if (error) throw error;

      const rows = (data || []) as Array<{
        id: string;
        platform: string;
        release_group: { semver: string } | null;
      }>;

      return rows
        .filter((row) => !!row.release_group?.semver)
        .map((row) => ({
          id: row.id,
          platform: row.platform,
          semver: row.release_group!.semver,
        })) as FeedbackReleaseTargetView[];
    },
    enabled: !!feedbackId,
  });
}

export function useAssignFeedbackRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appId,
      feedbackId,
      semver,
      platform,
    }: {
      appId: string;
      feedbackId: string;
      semver: string;
      platform: string;
    }) => {
      await assignFeedbackRelease({
        appId,
        feedbackId,
        semver,
        platform,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['release-groups', variables.appId] });
      queryClient.invalidateQueries({ queryKey: ['feedback-release-targets', variables.feedbackId] });
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['changelog'] });
    },
  });
}

export async function assignFeedbackRelease({
  supabaseClient = supabase,
  appId,
  feedbackId,
  semver,
  platform,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any;
  appId: string;
  feedbackId: string;
  semver: string;
  platform: string;
}) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: releaseGroup, error: releaseGroupError } = await (supabaseClient as any)
        .from('release_groups')
        .upsert(
          { app_id: appId, semver },
          { onConflict: 'app_id,semver' }
        )
        .select('id')
        .single();

      if (releaseGroupError) throw releaseGroupError;

      // Preserve published metadata for existing rows.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingPlatformRow, error: existingPlatformError } = await (supabaseClient as any)
        .from('release_group_platforms')
        .select('status,released_at')
        .eq('release_group_id', releaseGroup.id)
        .eq('platform', platform)
        .maybeSingle();

      if (existingPlatformError) throw existingPlatformError;

      const nextStatus = existingPlatformRow?.status ?? 'planned';
      const nextReleasedAt = existingPlatformRow?.released_at ?? null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: releasePlatformError } = await (supabaseClient as any)
        .from('release_group_platforms')
        .upsert(
          {
            release_group_id: releaseGroup.id,
            platform,
            version: semver,
            status: nextStatus,
            released_at: nextReleasedAt,
          },
          { onConflict: 'release_group_id,platform' }
        );

      if (releasePlatformError) throw releasePlatformError;

      if (platform === 'all') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteTargetsError } = await (supabaseClient as any)
          .from('feedback_release_targets')
          .delete()
          .eq('feedback_id', feedbackId);

        if (deleteTargetsError) throw deleteTargetsError;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: deleteTargetsError } = await (supabaseClient as any)
          .from('feedback_release_targets')
          .delete()
          .eq('feedback_id', feedbackId)
          .or(`platform.eq.${platform},platform.eq.all`);

        if (deleteTargetsError) throw deleteTargetsError;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: targetError } = await (supabaseClient as any)
        .from('feedback_release_targets')
        .upsert(
          {
            feedback_id: feedbackId,
            release_group_id: releaseGroup.id,
            platform,
          },
          { onConflict: 'feedback_id,release_group_id,platform' }
        );

      if (targetError) throw targetError;

      // Keep existing legacy column in sync for now.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: feedbackError } = await (supabaseClient as any)
        .from('feedback')
        .update({ version: semver })
        .eq('id', feedbackId);

      if (feedbackError) throw feedbackError;
}

export async function removeFeedbackReleaseTarget({
  supabaseClient = supabase,
  targetId,
  feedbackId,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any;
  targetId: string;
  feedbackId: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (supabaseClient as any)
    .from('feedback_release_targets')
    .delete()
    .eq('id', targetId);

  if (deleteError) throw deleteError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: remainingTargets, error: remainingTargetsError } = await (supabaseClient as any)
    .from('feedback_release_targets')
    .select(`
      release_group:release_group_id (
        semver
      )
    `)
    .eq('feedback_id', feedbackId);

  if (remainingTargetsError) throw remainingTargetsError;

  const rows = (remainingTargets || []) as FeedbackReleaseTargetRow[];
  const nextVersion = rows.find((row) => row.release_group?.semver)?.release_group?.semver ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: feedbackUpdateError } = await (supabaseClient as any)
    .from('feedback')
    .update({ version: nextVersion })
    .eq('id', feedbackId);

  if (feedbackUpdateError) throw feedbackUpdateError;
}

export function useRemoveFeedbackReleaseTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      targetId,
      feedbackId,
      appId,
    }: {
      targetId: string;
      feedbackId: string;
      appId: string;
    }) => {
      await removeFeedbackReleaseTarget({ targetId, feedbackId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['release-groups', variables.appId] });
      queryClient.invalidateQueries({ queryKey: ['feedback-release-targets', variables.feedbackId] });
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['changelog'] });
    },
  });
}

export function useUpsertReleasePlatformStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      releaseGroupId,
      platform,
      version,
      status,
      releasedAt,
    }: {
      releaseGroupId: string;
      platform: string;
      version: string;
      status: 'planned' | 'released';
      releasedAt: string | null;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('release_group_platforms')
        .upsert(
          {
            release_group_id: releaseGroupId,
            platform,
            version,
            status,
            released_at: releasedAt,
          },
          { onConflict: 'release_group_id,platform' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['release-groups'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-release-targets'] });
      queryClient.invalidateQueries({ queryKey: ['changelog'] });
    },
  });
}

export function useDeleteReleaseGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      releaseGroupId,
      appId,
    }: {
      releaseGroupId: string;
      appId: string;
    }) => {
      // Collect affected feedback before cascade delete.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: targets, error: targetsError } = await (supabase as any)
        .from('feedback_release_targets')
        .select('feedback_id')
        .eq('release_group_id', releaseGroupId);

      if (targetsError) throw targetsError;

      const feedbackIds = Array.from(
        new Set(((targets || []) as Array<{ feedback_id: string }>).map((row) => row.feedback_id))
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: deleteError } = await (supabase as any)
        .from('release_groups')
        .delete()
        .eq('id', releaseGroupId);

      if (deleteError) throw deleteError;

      if (feedbackIds.length > 0) {
        // Keep legacy column aligned with release-target unlink behavior.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: feedbackUpdateError } = await (supabase as any)
          .from('feedback')
          .update({ version: null })
          .in('id', feedbackIds);

        if (feedbackUpdateError) throw feedbackUpdateError;
      }

      return { appId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['release-groups', variables.appId] });
      queryClient.invalidateQueries({ queryKey: ['feedback-release-targets'] });
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['changelog'] });
    },
  });
}
