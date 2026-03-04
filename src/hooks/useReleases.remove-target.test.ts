import { describe, expect, it, vi } from 'vitest';
import { removeFeedbackReleaseTarget } from './useReleases';

type RemainingTargetRow = {
  release_group: { semver: string } | null;
};

function createMockSupabase(options: {
  remainingRows: RemainingTargetRow[];
  deleteError?: Error | null;
  selectError?: Error | null;
  updateError?: Error | null;
}) {
  const update = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: options.updateError ?? null })),
  }));

  const select = vi.fn(() => ({
    eq: vi.fn(async () => ({ data: options.remainingRows, error: options.selectError ?? null })),
  }));

  const del = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: options.deleteError ?? null })),
  }));

  const from = vi.fn((table: string) => {
    if (table === 'feedback_release_targets') {
      return {
        delete: del,
        select,
      };
    }

    if (table === 'feedback') {
      return {
        update,
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    from,
    update,
    select,
    del,
  };
}

describe('removeFeedbackReleaseTarget', () => {
  it('clears feedback.version when removed target is the last one', async () => {
    const mockSupabase = createMockSupabase({ remainingRows: [] });

    await removeFeedbackReleaseTarget({
      supabaseClient: mockSupabase,
      targetId: 'target-1',
      feedbackId: 'feedback-1',
    });

    expect(mockSupabase.update).toHaveBeenCalledWith({ version: null });
  });

  it('keeps feedback.version set when targets remain', async () => {
    const mockSupabase = createMockSupabase({
      remainingRows: [{ release_group: { semver: '1.2.3' } }],
    });

    await removeFeedbackReleaseTarget({
      supabaseClient: mockSupabase,
      targetId: 'target-1',
      feedbackId: 'feedback-1',
    });

    expect(mockSupabase.update).toHaveBeenCalledWith({ version: '1.2.3' });
  });
});
