import { describe, expect, it, vi } from 'vitest';
import { assignFeedbackRelease } from './useReleases';

type ExistingPlatformRow = {
  status: 'planned' | 'released';
  released_at: string | null;
};

function createMockSupabase(existingPlatform: ExistingPlatformRow | null) {
  const releasePlatformUpsert = vi.fn(async () => ({ error: null }));
  const releaseGroupUpsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: vi.fn(async () => ({ data: { id: 'rg-1' }, error: null })),
    })),
  }));

  const releasePlatformSelect = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: existingPlatform, error: null })),
      })),
    })),
  }));

  const feedbackTargetsDeleteEq = vi.fn(() => ({
    or: vi.fn(async () => ({ error: null })),
  }));
  const feedbackTargetsDelete = vi.fn(() => ({ eq: feedbackTargetsDeleteEq }));
  const feedbackTargetsUpsert = vi.fn(async () => ({ error: null }));

  const feedbackUpdateEq = vi.fn(async () => ({ error: null }));
  const feedbackUpdate = vi.fn(() => ({ eq: feedbackUpdateEq }));

  const from = vi.fn((table: string) => {
    if (table === 'release_groups') {
      return { upsert: releaseGroupUpsert };
    }

    if (table === 'release_group_platforms') {
      return { select: releasePlatformSelect, upsert: releasePlatformUpsert };
    }

    if (table === 'feedback_release_targets') {
      return { delete: feedbackTargetsDelete, upsert: feedbackTargetsUpsert };
    }

    if (table === 'feedback') {
      return { update: feedbackUpdate };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    from,
    releasePlatformUpsert,
  };
}

describe('assignFeedbackRelease', () => {
  it('preserves released status and date for an already-published platform row', async () => {
    const mockSupabase = createMockSupabase({
      status: 'released',
      released_at: '2026-03-05',
    });

    await assignFeedbackRelease({
      supabaseClient: mockSupabase,
      appId: 'app-1',
      feedbackId: 'fb-1',
      semver: '1.4.0',
      platform: 'ios',
    });

    expect(mockSupabase.releasePlatformUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'released',
        released_at: '2026-03-05',
      }),
      { onConflict: 'release_group_id,platform' }
    );
  });

  it('defaults to planned with no release date when platform row does not exist yet', async () => {
    const mockSupabase = createMockSupabase(null);

    await assignFeedbackRelease({
      supabaseClient: mockSupabase,
      appId: 'app-1',
      feedbackId: 'fb-1',
      semver: '1.4.0',
      platform: 'ios',
    });

    expect(mockSupabase.releasePlatformUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'planned',
        released_at: null,
      }),
      { onConflict: 'release_group_id,platform' }
    );
  });
});
