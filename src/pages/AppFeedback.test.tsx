import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/Header', () => ({
  Header: () => <div>Header</div>,
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        back: 'Back',
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
        changelog: 'Changelog',
        roadmap: 'Roadmap',
        feature: 'Feature',
        bug: 'Bug',
        newFeedback: 'New Feedback',
      };

      return labels[key] ?? key;
    },
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

vi.mock('@/hooks/useFeedback', () => ({
  useFeedback: () => ({
    data: [],
    isLoading: false,
    error: null,
    fetchStatus: 'idle',
    refetch: vi.fn(),
    isRefetching: false,
    isFetching: false,
  }),
  useVotedItems: () => ({ data: new Set<string>() }),
  useVote: () => ({ mutate: vi.fn() }),
  useCreateFeedback: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/lib/sortPreference', () => ({
  loadOverviewSortMode: () => 'popularity',
  saveOverviewSortMode: vi.fn(),
}));

vi.mock('@/lib/roadmapPreferences', () => ({
  loadGroupedFeedbackEnabled: () => false,
  saveGroupedFeedbackEnabled: vi.fn(),
}));

vi.mock('@/components/FeedbackCard', () => ({
  FeedbackCard: () => null,
}));

vi.mock('@/components/feedback/FeedbackStateSections', () => ({
  FeedbackStateSections: () => null,
}));

vi.mock('@/components/CreateFeedbackDialog', () => ({
  CreateFeedbackDialog: ({ open, type }: { open: boolean; type: string | null }) =>
    open ? <div data-testid="create-feedback-dialog">Dialog type: {type ?? 'unset'}</div> : null,
}));

import AppFeedback from './AppFeedback';

describe('AppFeedback page', () => {
  it('renders a single new feedback action and removes separate feature and bug buttons', async () => {
    render(
      <MemoryRouter initialEntries={['/app/roadmap-tool']}>
        <Routes>
          <Route path="/app/:slug" element={<AppFeedback />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /feedback/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /roadmap/i })).toHaveAttribute('href', '/app/roadmap-tool/roadmap');
    expect(screen.getByRole('link', { name: /changelog/i })).toHaveAttribute('href', '/app/roadmap-tool/changelog');
    expect(screen.getByRole('button', { name: /new feedback/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request feature/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /report bug/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /new feedback/i }));

    expect(screen.getByTestId('create-feedback-dialog')).toHaveTextContent('Dialog type: unset');
  });
});
