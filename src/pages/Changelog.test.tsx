import { render, screen, within } from '@testing-library/react';
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
        feedback: 'Feedback',
        roadmap: 'Roadmap',
        changelog: 'Changelog',
        feature: 'Feature',
        bug: 'Bug',
        statusOpen: 'Open',
        noVersionedItems: 'No versioned items yet',
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
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAdmin: false,
  }),
}));

vi.mock('@/hooks/useReleases', () => ({
  useReleaseGroups: () => ({
    data: [
      {
        id: 'release-group-1',
        semver: '1.2.0',
        items: [
          {
            feedback: {
              id: 'feedback-1',
              type: 'feature',
              title: 'Roadmap item',
              status: 'open',
            },
            target_platforms: ['web'],
          },
        ],
        platforms: [],
      },
    ],
    isLoading: false,
    error: null,
    fetchStatus: 'idle',
    refetch: vi.fn(),
  }),
  useUpsertReleasePlatformStatus: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useDeleteReleaseGroup: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

import Changelog from './Changelog';

describe('Changelog page', () => {
  it('renders the shared app navigation with changelog active', () => {
    render(
      <MemoryRouter initialEntries={['/app/roadmap-tool/changelog']}>
        <Routes>
          <Route path="/app/:slug/changelog" element={<Changelog />} />
        </Routes>
      </MemoryRouter>
    );

    const appNavigation = screen.getByRole('navigation', { name: /app navigation/i });

    expect(screen.getByRole('heading', { name: /roadmap tool/i })).toBeInTheDocument();
    expect(within(appNavigation).getByRole('link', { name: /^feedback$/i })).toHaveAttribute('href', '/app/roadmap-tool');
    expect(within(appNavigation).getByRole('link', { name: /^roadmap$/i })).toHaveAttribute('href', '/app/roadmap-tool/roadmap');
    expect(within(appNavigation).getByRole('link', { name: /^changelog$/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /roadmap item/i })).toHaveAttribute('href', '/app/roadmap-tool/feedback-1');
  });
});
