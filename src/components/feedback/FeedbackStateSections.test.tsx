import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackItem } from '@/types';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
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

vi.mock('@/components/FeedbackCard', () => ({
  FeedbackCard: ({ item }: { item: FeedbackItem }) => <div>{item.title}</div>,
}));

import { FeedbackStateSections } from './FeedbackStateSections';

function makeItem(partial: Partial<FeedbackItem> & Pick<FeedbackItem, 'id' | 'title'>): FeedbackItem {
  return {
    id: partial.id,
    title: partial.title,
    app_id: 'app-1',
    type: partial.type || 'feature',
    description: partial.description || '',
    status: partial.status || 'open',
    vote_count: partial.vote_count ?? 0,
    created_at: partial.created_at || '2026-01-01T00:00:00.000Z',
    version: partial.version ?? null,
    platform: partial.platform || null,
    submitter_email: null,
    notify_on_updates: false,
    roadmap_position: partial.roadmap_position ?? null,
  };
}

describe('FeedbackStateSections', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders sections in status order and collapses completed by default', () => {
    render(
      <FeedbackStateSections
        slug="roadmap-tool"
        items={[
          makeItem({ id: 'completed-1', title: 'Completed item', status: 'completed' }),
          makeItem({ id: 'open-1', title: 'Open item', status: 'open' }),
        ]}
        appSlug="roadmap-tool"
        votedItems={new Set()}
        onVote={vi.fn()}
      />
    );

    const triggers = screen.getAllByRole('button');
    expect(triggers.slice(0, 2).map((button) => button.textContent)).toEqual([
      expect.stringContaining('Open'),
      expect.stringContaining('Completed'),
    ]);

    expect(screen.getByText('Open item')).toBeInTheDocument();
    expect(screen.queryByText('Completed item')).toBeNull();
  });

  it('persists section toggles across rerenders', () => {
    const props = {
      slug: 'roadmap-tool',
      items: [makeItem({ id: 'planned-1', title: 'Planned item', status: 'planned' })],
      appSlug: 'roadmap-tool',
      votedItems: new Set<string>(),
      onVote: vi.fn(),
    };

    const { unmount } = render(<FeedbackStateSections {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /planned/i }));
    expect(screen.queryByText('Planned item')).toBeNull();

    unmount();
    render(<FeedbackStateSections {...props} />);

    expect(screen.queryByText('Planned item')).toBeNull();
  });
});
