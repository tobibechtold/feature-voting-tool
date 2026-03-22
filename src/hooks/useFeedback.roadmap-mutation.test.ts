import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { moveFeedbackRoadmapItem, useMoveFeedbackRoadmapItem } from './useFeedback';

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

  it('reorders an item within the same lane by assigning a position between its new neighbors', async () => {
    const mockSupabase = createMockSupabase();

    await moveFeedbackRoadmapItem({
      supabaseClient: mockSupabase,
      feedbackId: 'feedback-1',
      destinationStatus: 'open',
      destinationItems: [
        { id: 'feedback-2', roadmap_position: 1 },
        { id: 'feedback-3', roadmap_position: 3 },
      ],
      destinationIndex: 1,
    });

    expect(mockSupabase.update).toHaveBeenCalledWith({
      status: 'open',
      roadmap_position: 2,
    });
  });
});

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useMoveFeedbackRoadmapItem', () => {
  it('invalidates feedback queries after a successful roadmap move', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const mockSupabase = createMockSupabase();

    const { result } = renderHook(() => useMoveFeedbackRoadmapItem(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      supabaseClient: mockSupabase,
      feedbackId: 'feedback-1',
      destinationStatus: 'planned',
      destinationItems: [{ id: 'feedback-2', roadmap_position: 2 }],
      destinationIndex: 1,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['feedback'] });
  });
});
