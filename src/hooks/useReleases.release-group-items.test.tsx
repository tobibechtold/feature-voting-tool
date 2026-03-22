import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, authenticatedFromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  authenticatedFromMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  publicSupabase: {
    from: fromMock,
  },
  supabase: {
    from: authenticatedFromMock,
  },
}));

import { useReleaseGroups } from './useReleases';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useReleaseGroups', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('aggregates duplicate feedback items and accumulates their target platforms within a release group', async () => {
    const data = [
      {
        id: 'group-1',
        app_id: 'app-1',
        semver: '1.2.3',
        title: null,
        notes: null,
        created_at: '2026-03-22T10:00:00.000Z',
        release_group_platforms: [],
        feedback_release_targets: [
          {
            id: 'target-ios',
            platform: 'ios',
            feedback: {
              id: 'feedback-1',
              app_id: 'app-1',
              type: 'feature',
              title: 'Feature A',
              description: 'Same feature across platforms',
              status: 'planned',
              vote_count: 4,
              created_at: '2026-03-20T10:00:00.000Z',
              submitter_email: null,
              notify_on_updates: false,
              version: '1.2.3',
              platform: null,
            },
          },
          {
            id: 'target-android',
            platform: 'android',
            feedback: {
              id: 'feedback-1',
              app_id: 'app-1',
              type: 'feature',
              title: 'Feature A',
              description: 'Same feature across platforms',
              status: 'planned',
              vote_count: 4,
              created_at: '2026-03-20T10:00:00.000Z',
              submitter_email: null,
              notify_on_updates: false,
              version: '1.2.3',
              platform: null,
            },
          },
        ],
      },
    ];

    fromMock.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data, error: null })),
      })),
    });

    const { result } = renderHook(() => useReleaseGroups('app-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const items = (result.current.data?.[0].items ?? []) as Array<{
      feedback: { id: string };
      target_platforms: string[];
    }>;

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      feedback: { id: 'feedback-1' },
      target_platforms: ['ios', 'android'],
    });
  });
});
