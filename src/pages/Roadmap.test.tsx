import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/Header', () => ({
  Header: () => <div>Header</div>,
}));

vi.mock('@/components/CreateFeedbackDialog', () => ({
  CreateFeedbackDialog: () => null,
}));

vi.mock('@/components/FeedbackCard', () => ({
  FeedbackCard: ({ item }: { item: { title: string } }) => <div>{item.title}</div>,
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        back: 'Back',
        changelog: 'Changelog',
        roadmap: 'Roadmap',
        feedback: 'Feedback',
        all: 'All',
        features: 'Features',
        bugs: 'Bugs',
        sortBy: 'Sort by',
        sortPopularity: 'Popularity',
        sortDate: 'Date',
        sortVersion: 'Version',
        filterVersion: 'Version filter',
        allVersions: 'All versions',
        noVersion: 'No version',
        groupByState: 'Group by state',
        feedbackWelcomeMessage: 'Welcome',
        createFeature: 'Request Feature',
        createBug: 'Report Bug',
        noVersionedItems: 'No items',
        statusOpen: 'Open',
        statusPlanned: 'Planned',
        statusProgress: 'In Progress',
        statusCompleted: 'Completed',
        statusWontDo: "Won't Do",
      };

      return labels[key] ?? key;
    },
  }),
}));

vi.mock('@/hooks/useComments', () => ({
  useCommentCount: () => ({
    data: 3,
  }),
}));

vi.mock('@/hooks/useApps', () => ({
  useApp: () => ({
    data: {
      id: 'app-1',
      name: 'Roadmap Tool',
      slug: 'roadmap-tool',
      description: 'Product feedback',
      logo_url: null,
      platforms: ['web'],
      created_at: '2026-01-01T00:00:00.000Z',
    },
    isLoading: false,
    error: null,
    fetchStatus: 'idle',
    refetch: vi.fn(),
    isRefetching: false,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAdmin: false,
  }),
}));

vi.mock('@/hooks/useFeedback', () => ({
  useMoveFeedbackRoadmapItem: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
  }),
  useFeedback: () => ({
    data: [
      {
        id: 'open-1',
        app_id: 'app-1',
        type: 'feature',
        title: 'Open item',
        description: 'Visible in roadmap',
        status: 'open',
        vote_count: 2,
        created_at: '2026-03-01T00:00:00.000Z',
        version: '1.2.0',
        platform: null,
        roadmap_position: 1,
      },
      {
        id: 'planned-1',
        app_id: 'app-1',
        type: 'feature',
        title: 'Planned item',
        description: 'Visible in roadmap',
        status: 'planned',
        vote_count: 1,
        created_at: '2026-03-02T00:00:00.000Z',
        version: null,
        platform: null,
        roadmap_position: 1,
      },
    ],
    isLoading: false,
    error: null,
    fetchStatus: 'idle',
    refetch: vi.fn(),
    isRefetching: false,
    isFetching: false,
  }),
  useVotedItems: () => ({
    data: new Set<string>(),
  }),
  useVote: () => ({
    mutate: vi.fn(),
  }),
  useVotedItems: () => ({
    data: new Set<string>(),
  }),
  useCreateFeedback: () => ({
    mutateAsync: vi.fn(),
  }),
}));

import AppFeedback from './AppFeedback';
import Roadmap from './Roadmap';

describe('Roadmap page', () => {
  it('renders the roadmap route with shared app navigation, a version filter, and no roadmap sort controls', () => {
    render(
      <MemoryRouter initialEntries={['/app/roadmap-tool/roadmap']}>
        <Routes>
          <Route path="/app/:slug/roadmap" element={<Roadmap />} />
        </Routes>
      </MemoryRouter>
    );

    const openLane = screen.getByTestId('roadmap-lane-open');
    const plannedLane = screen.getByTestId('roadmap-lane-planned');
    const appNavigation = screen.getByRole('navigation', { name: /app navigation/i });

    expect(screen.getByRole('heading', { name: /roadmap tool/i })).toBeInTheDocument();
    expect(within(appNavigation).getByRole('link', { name: /^feedback$/i })).toHaveAttribute('href', '/app/roadmap-tool');
    expect(within(appNavigation).getByRole('link', { name: /^roadmap$/i })).toHaveAttribute('aria-current', 'page');
    expect(within(appNavigation).getByRole('link', { name: /^changelog$/i })).toHaveAttribute('href', '/app/roadmap-tool/changelog');
    expect(within(openLane).getByRole('heading', { name: /open/i })).toBeInTheDocument();
    expect(within(plannedLane).getByRole('heading', { name: /planned/i })).toBeInTheDocument();
    expect(within(openLane).getByText('Open item')).toBeInTheDocument();
    expect(within(plannedLane).getByText('Planned item')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /version filter/i })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /sort by/i })).toBeNull();
  });

  it('shows a roadmap link from the app feedback page', () => {
    render(
      <MemoryRouter initialEntries={['/app/roadmap-tool']}>
        <Routes>
          <Route path="/app/:slug" element={<AppFeedback />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /roadmap/i })).toHaveAttribute('href', '/app/roadmap-tool/roadmap');
  });
});
