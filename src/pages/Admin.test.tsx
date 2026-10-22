import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMutateAsync = vi.hoisted(() => vi.fn());
const updateMutateAsync = vi.hoisted(() => vi.fn());

vi.mock('@/components/Header', () => ({ Header: () => <div>Header</div> }));
vi.mock('@/components/ApiTokensCard', () => ({ ApiTokensCard: () => null }));

vi.mock('@/contexts/AppContext', () => ({
  useApp: () => ({ isAdmin: true, authLoading: false }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useStorage', () => ({
  useUploadLogo: () => ({ mutateAsync: vi.fn() }),
  useDeleteLogo: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/hooks/useApps', () => ({
  useApps: () => ({
    data: [],
    isLoading: false,
    error: null,
    fetchStatus: 'idle',
    refetch: vi.fn(),
  }),
  useCreateApp: () => ({ mutateAsync: createMutateAsync }),
  useUpdateApp: () => ({ mutateAsync: updateMutateAsync }),
  useDeleteApp: () => ({ mutateAsync: vi.fn() }),
}));

import Admin from './Admin';

function openCreateDialog() {
  render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /addApp/ }));
}

const keyInput = () => screen.getByLabelText('appKey') as HTMLInputElement;
const slugInput = () => screen.getByLabelText('appSlug') as HTMLInputElement;

function submitForm() {
  fireEvent.change(screen.getByLabelText('appName'), { target: { value: 'My App' } });
  fireEvent.submit(slugInput().closest('form') as HTMLFormElement);
}

describe('Admin app key field', () => {
  beforeEach(() => {
    createMutateAsync.mockReset();
    updateMutateAsync.mockReset();
  });

  it('derives the key from the slug while the key is untouched', () => {
    openCreateDialog();
    fireEvent.change(slugInput(), { target: { value: 'roadmap-tool' } });
    expect(keyInput().value).toBe('ROADMAPTOO');
  });

  it('stops deriving the key once the user edits it', () => {
    openCreateDialog();
    fireEvent.change(slugInput(), { target: { value: 'roadmap-tool' } });
    fireEvent.change(keyInput(), { target: { value: 'rt' } });
    fireEvent.change(slugInput(), { target: { value: 'something-else' } });
    expect(keyInput().value).toBe('RT');
  });

  it('blocks submit and shows an error for an invalid key', async () => {
    openCreateDialog();
    fireEvent.change(slugInput(), { target: { value: 'roadmap-tool' } });
    fireEvent.change(keyInput(), { target: { value: '1ab' } });
    submitForm();

    expect(await screen.findByText('appKeyInvalid')).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('shows the taken message when the key is a duplicate', async () => {
    createMutateAsync.mockRejectedValue({
      code: '23505',
      message: 'duplicate key value violates unique constraint "apps_item_key_key"',
    });
    openCreateDialog();
    fireEvent.change(slugInput(), { target: { value: 'roadmap-tool' } });
    submitForm();

    expect(await screen.findByText('appKeyTaken')).toBeInTheDocument();
    expect(createMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('clears the key error when a slug change re-derives the key', async () => {
    createMutateAsync.mockRejectedValue({
      code: '23505',
      message: 'duplicate key value violates unique constraint "apps_item_key_key"',
    });
    openCreateDialog();
    fireEvent.change(slugInput(), { target: { value: 'roadmap-tool' } });
    submitForm();
    expect(await screen.findByText('appKeyTaken')).toBeInTheDocument();

    fireEvent.change(slugInput(), { target: { value: 'roadmap-tools' } });
    await waitFor(() => expect(screen.queryByText('appKeyTaken')).not.toBeInTheDocument());
  });
});
