import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useComments', () => ({
  useCommentCount: () => ({ data: 0 }),
}));

import { FeedbackCard } from './FeedbackCard';
import type { FeedbackItem } from '@/types';

const item = {
  id: '11111111-1111-1111-1111-111111111111',
  app_id: 'app-1',
  number: 42,
  type: 'feature',
  title: 'Dark mode',
  description: 'Please',
  status: 'open',
  vote_count: 3,
  created_at: '2026-01-01T00:00:00.000Z',
} as unknown as FeedbackItem;

describe('FeedbackCard', () => {
  it('shows the item key and links by key', () => {
    render(
      <MemoryRouter>
        <FeedbackCard item={item} appSlug="intake" appKey="INTAKE" voted={false} onVote={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText('INTAKE-42')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/intake/INTAKE-42');
  });
});
