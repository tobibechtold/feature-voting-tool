import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  app: { data: undefined as unknown, isLoading: true, error: null as unknown, fetchStatus: 'fetching' },
  item: { data: undefined as unknown, isLoading: false, error: null as unknown, status: 'pending', fetchStatus: 'idle' },
}));

const query = (s: { data: unknown; isLoading: boolean; error: unknown; fetchStatus: string }) => ({
  ...s,
  refetch: vi.fn(),
});

vi.mock('@/components/Header', () => ({ Header: () => <div>Header</div> }));
vi.mock('react-google-recaptcha-v3', () => ({
  useGoogleReCaptcha: () => ({ executeRecaptcha: undefined }),
}));
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/AppContext', () => ({ useApp: () => ({ isAdmin: false }) }));
vi.mock('@/hooks/useApps', () => ({ useApp: () => query(state.app) }));
vi.mock('@/hooks/useFeedback', () => ({
  useFeedbackItem: () => query(state.item),
  useVotedItems: () => ({ data: new Set<string>() }),
  useVote: () => ({ mutate: vi.fn() }),
  useUpdateFeedbackStatus: () => ({ mutate: vi.fn() }),
  useDeleteFeedback: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/useComments', () => ({
  useComments: () => ({ data: [], isLoading: false, error: null, fetchStatus: 'idle', refetch: vi.fn() }),
  useCreateComment: () => ({ mutateAsync: vi.fn() }),
  useCreateUserComment: () => ({ mutateAsync: vi.fn() }),
  useDeleteComment: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/useAttachments', () => ({
  useAttachments: () => ({ data: [] }),
  useDeleteAttachment: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/useReleases', () => ({
  useAssignFeedbackRelease: () => ({ mutateAsync: vi.fn() }),
  useFeedbackReleaseTargets: () => ({ data: [] }),
  useRemoveFeedbackReleaseTarget: () => ({ mutateAsync: vi.fn() }),
}));

import FeedbackDetail from './FeedbackDetail';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/intake/INTAKE-42']}>
      <Routes>
        <Route path="/app/:slug/:id" element={<FeedbackDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('FeedbackDetail loading states', () => {
  beforeEach(() => {
    state.app = { data: undefined, isLoading: true, error: null, fetchStatus: 'fetching' };
    state.item = { data: undefined, isLoading: false, error: null, status: 'pending', fetchStatus: 'idle' };
  });

  it('shows a skeleton, not "not found", while the app loads and the item query is disabled', () => {
    renderPage();
    expect(screen.queryByText('Feedback not found')).not.toBeInTheDocument();
  });

  it('shows a skeleton while the app is loaded but the item has not resolved', () => {
    state.app = {
      data: { id: 'a', slug: 'intake', item_key: 'INTAKE', name: 'Intake', platforms: ['web'] },
      isLoading: false,
      error: null,
      fetchStatus: 'idle',
    };
    state.item = { data: undefined, isLoading: true, error: null, status: 'pending', fetchStatus: 'fetching' };
    renderPage();
    expect(screen.queryByText('Feedback not found')).not.toBeInTheDocument();
  });

  it('shows not found once the item query resolved to null', () => {
    state.app = {
      data: { id: 'a', slug: 'intake', item_key: 'INTAKE', name: 'Intake', platforms: ['web'] },
      isLoading: false,
      error: null,
      fetchStatus: 'idle',
    };
    state.item = { data: null, isLoading: false, error: null, status: 'success', fetchStatus: 'idle' };
    renderPage();
    expect(screen.getByText('Feedback not found')).toBeInTheDocument();
  });
});
