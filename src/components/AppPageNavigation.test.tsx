import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppPageNavigation } from './AppPageNavigation';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        feedback: 'Feedback',
        roadmap: 'Roadmap',
        changelog: 'Changelog',
      };

      return labels[key] ?? key;
    },
  }),
}));

describe('AppPageNavigation', () => {
  it('renders feedback, roadmap, and changelog links with the active page marked', () => {
    render(
      <MemoryRouter>
        <AppPageNavigation slug="roadmap-tool" currentPage="roadmap" />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /feedback/i })).toHaveAttribute('href', '/app/roadmap-tool');
    expect(screen.getByRole('link', { name: /roadmap/i })).toHaveAttribute('href', '/app/roadmap-tool/roadmap');
    expect(screen.getByRole('link', { name: /changelog/i })).toHaveAttribute('href', '/app/roadmap-tool/changelog');
    expect(screen.getByRole('link', { name: /roadmap/i })).toHaveAttribute('aria-current', 'page');
  });
});
