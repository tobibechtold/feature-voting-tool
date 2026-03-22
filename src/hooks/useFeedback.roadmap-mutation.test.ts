import { describe, expect, it, vi } from 'vitest';
import { moveFeedbackRoadmapItem } from './useFeedback';

function createMockSupabase() {
  const single = vi.fn(async () => ({
    data: {
      id: 'feedback-1',
      status: 'planned',
      roadmap_position: 6,
    },
    error: null,
  }));
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));

  const from = vi.fn((table: string) => {
    if (table === 'feedback') {
      return { update };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    from,
    update,
  };
}

describe('moveFeedbackRoadmapItem', () => {
  it('moves an item to the end of the destination lane by updating status and roadmap position', async () => {
    const mockSupabase = createMockSupabase();

    await moveFeedbackRoadmapItem({
      supabaseClient: mockSupabase,
      feedbackId: 'feedback-1',
      destinationStatus: 'planned',
      destinationItems: [
        { id: 'feedback-2', roadmap_position: 2 },
        { id: 'feedback-3', roadmap_position: 5 },
      ],
      destinationIndex: 2,
    });

    expect(mockSupabase.update).toHaveBeenCalledWith({
      status: 'planned',
      roadmap_position: 6,
    });
  });
});
