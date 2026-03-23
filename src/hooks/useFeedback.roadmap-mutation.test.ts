import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { FeedbackItem } from '@/types';
import { getCachedData, setCachedData } from '@/lib/queryCache';
import { moveFeedbackRoadmapItem, useMoveFeedbackRoadmapItem } from './useFeedback';

function createMockSupabase(
  returnedFeedbackById: Record<string, Partial<FeedbackItem>> = {}
) {
  const updates: Array<{ id: string; values: Record<string, unknown> }> = [];
  let pendingValues: Record<string, unknown> | null = null;

  const single = vi.fn(async () => ({
    data: {
      id: updates.at(-1)?.id ?? 'feedback-1',
      app_id: 'app-1',
      status: 'planned',
      roadmap_position: 6,
      ...returnedFeedbackById[updates.at(-1)?.id ?? 'feedback-1'],
    },
    error: null,
  }));
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn((field: string, id: string) => {
    if (field !== 'id') throw new Error(`Unexpected eq field: ${field}`);
    updates.push({
      id,
      values: pendingValues || {},
    });
    pendingValues = null;
    return { select };
  });
  const update = vi.fn((values: Record<string, unknown>) => {
    pendingValues = values;
    return { eq };
  });

  const from = vi.fn((table: string) => {
    if (table === 'feedback') {
      return { update };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    from,
    update,
    updates,
  };
}

describe('moveFeedbackRoadmapItem', () => {
  it('moves an item to the end of the destination lane by updating status and roadmap position', async () => {
    const mockSupabase = createMockSupabase({
      'feedback-1': {
        id: 'feedback-1',
        app_id: 'app-1',
        status: 'planned',
        roadmap_position: 3,
      },
      'feedback-2': {
        id: 'feedback-2',
        app_id: 'app-1',
        status: 'planned',
        roadmap_position: 1,
      },
      'feedback-3': {
        id: 'feedback-3',
        app_id: 'app-1',
        status: 'planned',
        roadmap_position: 2,
      },
    });

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

    expect(mockSupabase.updates).toEqual([
      { id: 'feedback-2', values: { roadmap_position: 1 } },
      { id: 'feedback-3', values: { roadmap_position: 2 } },
      { id: 'feedback-1', values: { status: 'planned', roadmap_position: 3 } },
    ]);
  });

  it('reindexes the destination lane contiguously when reordering within the same lane', async () => {
    const mockSupabase = createMockSupabase({
      'feedback-1': {
        id: 'feedback-1',
        app_id: 'app-1',
        status: 'open',
        roadmap_position: 2,
      },
      'feedback-2': {
        id: 'feedback-2',
        app_id: 'app-1',
        status: 'open',
        roadmap_position: 1,
      },
      'feedback-3': {
        id: 'feedback-3',
        app_id: 'app-1',
        status: 'open',
        roadmap_position: 3,
      },
    });

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

    expect(mockSupabase.updates).toEqual([
      { id: 'feedback-2', values: { roadmap_position: 1 } },
      { id: 'feedback-1', values: { status: 'open', roadmap_position: 2 } },
      { id: 'feedback-3', values: { roadmap_position: 3 } },
    ]);
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
    const mockSupabase = createMockSupabase({
      'feedback-1': {
        id: 'feedback-1',
        app_id: 'app-1',
        status: 'planned',
        roadmap_position: 2,
      },
      'feedback-2': {
        id: 'feedback-2',
        app_id: 'app-1',
        status: 'planned',
        roadmap_position: 1,
      },
    });

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

  it('updates the in-memory and localStorage feedback cache so hard reloads keep the reordered item position', async () => {
    localStorage.clear();

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const mockSupabase = createMockSupabase({
      'feedback-1': {
        id: 'feedback-1',
        app_id: 'app-1',
        status: 'open',
        roadmap_position: 2,
      },
      'feedback-2': {
        id: 'feedback-2',
        app_id: 'app-1',
        status: 'open',
        roadmap_position: 1,
      },
    });
    const initialFeedback = [
      {
        id: 'feedback-1',
        app_id: 'app-1',
        type: 'feature',
        title: 'Moved item',
        description: '',
        status: 'open',
        vote_count: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        submitter_email: null,
        notify_on_updates: false,
        version: null,
        platform: null,
        roadmap_position: 1,
      },
      {
        id: 'feedback-2',
        app_id: 'app-1',
        type: 'feature',
        title: 'Current first item',
        description: '',
        status: 'open',
        vote_count: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        submitter_email: null,
        notify_on_updates: false,
        version: null,
        platform: null,
        roadmap_position: 2,
      },
    ];

    queryClient.setQueryData(['feedback', 'app-1'], initialFeedback);
    setCachedData('feedback:app-1', initialFeedback);

    const { result } = renderHook(() => useMoveFeedbackRoadmapItem(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      supabaseClient: mockSupabase,
      feedbackId: 'feedback-1',
      destinationStatus: 'open',
      destinationItems: [{ id: 'feedback-2', roadmap_position: 2 }],
      destinationIndex: 1,
    });

    expect(queryClient.getQueryData(['feedback', 'app-1'])).toEqual([
      expect.objectContaining({
        id: 'feedback-1',
        status: 'open',
        roadmap_position: 2,
      }),
      expect.objectContaining({
        id: 'feedback-2',
        status: 'open',
        roadmap_position: 1,
      }),
    ]);

    expect(getCachedData<typeof initialFeedback>('feedback:app-1')?.data).toEqual([
      expect.objectContaining({
        id: 'feedback-1',
        status: 'open',
        roadmap_position: 2,
      }),
      expect.objectContaining({
        id: 'feedback-2',
        status: 'open',
        roadmap_position: 1,
      }),
    ]);
  });
});
