import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiTokensCard } from './ApiTokensCard';

const mockTokens = vi.fn();
const mockCreate = vi.fn();
const mockRevoke = vi.fn();

vi.mock('@/hooks/useApiTokens', () => ({
  useApiTokens: () => mockTokens(),
  useCreateApiToken: () => ({ mutateAsync: mockCreate, isPending: false }),
  useRevokeApiToken: () => ({ mutateAsync: mockRevoke, isPending: false }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('ApiTokensCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokens.mockReturnValue({ data: [], isLoading: false });
  });

  it('shows an empty state when there are no tokens', () => {
    render(<ApiTokensCard />);
    expect(screen.getByText('noTokens')).toBeInTheDocument();
  });

  it('lists existing tokens with revoked state', () => {
    mockTokens.mockReturnValue({
      data: [
        { id: 't-1', name: 'laptop', created_at: '2026-08-01T00:00:00Z', last_used_at: null, revoked_at: null },
        { id: 't-2', name: 'old', created_at: '2026-07-01T00:00:00Z', last_used_at: '2026-07-02T00:00:00Z', revoked_at: '2026-07-03T00:00:00Z' },
      ],
      isLoading: false,
    });

    render(<ApiTokensCard />);

    expect(screen.getByText('laptop')).toBeInTheDocument();
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('tokenRevoked')).toBeInTheDocument();
  });

  it('shows the plaintext token exactly once after creation, with a warning', async () => {
    mockCreate.mockResolvedValue('fvt_secret_token');

    render(<ApiTokensCard />);

    fireEvent.click(screen.getByRole('button', { name: 'createToken' }));
    fireEvent.change(screen.getByLabelText('tokenName'), { target: { value: 'laptop' } });
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => {
      expect(screen.getByText('fvt_secret_token')).toBeInTheDocument();
    });
    expect(mockCreate).toHaveBeenCalledWith('laptop');
    expect(screen.getByText('tokenCreatedWarning')).toBeInTheDocument();
  });

  it('revokes a token after confirmation', async () => {
    mockTokens.mockReturnValue({
      data: [{ id: 't-1', name: 'laptop', created_at: '2026-08-01T00:00:00Z', last_used_at: null, revoked_at: null }],
      isLoading: false,
    });
    mockRevoke.mockResolvedValue(undefined);

    render(<ApiTokensCard />);

    fireEvent.click(screen.getByRole('button', { name: 'revokeToken' }));
    // The alert dialog's confirm action reuses the 'revokeToken' label, so
    // once it is open there are two matching buttons; the confirm is last.
    const revokeButtons = await screen.findAllByRole('button', { name: 'revokeToken' });
    fireEvent.click(revokeButtons[revokeButtons.length - 1]);

    await waitFor(() => {
      expect(mockRevoke).toHaveBeenCalledWith('t-1');
    });
  });
});
