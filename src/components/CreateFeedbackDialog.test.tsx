import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateFeedbackDialog } from './CreateFeedbackDialog';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        createFeature: 'Request Feature',
        createBug: 'Report Bug',
        newFeedback: 'New Feedback',
        chooseFeedbackType: 'Choose what you want to submit',
        title: 'Title',
        titlePlaceholder: 'Short, descriptive title',
        description: 'Description',
        descriptionPlaceholder: 'Describe your request in detail...',
        platform: 'Platform',
        selectPlatform: 'Select platform',
        attachScreenshots: 'Attach screenshots',
        maxFiles: 'Max 5 images, 5MB each',
        email: 'Email',
        emailPlaceholder: 'your@email.com',
        notifyOnUpdates: 'Notify me about status changes and replies',
        cancel: 'Cancel',
        submit: 'Submit',
        submitSuccess: 'Successfully submitted!',
        feature: 'Feature',
        bug: 'Bug',
      };

      return labels[key] ?? key;
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('CreateFeedbackDialog', () => {
  it('supports choosing feature or bug inside the dialog when no initial type is provided', async () => {
    render(
      <CreateFeedbackDialog
        open
        onOpenChange={vi.fn()}
        type={null}
        platforms={['ios', 'android']}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /new feedback/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^feature$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^bug$/i })).toBeInTheDocument();
    expect(screen.queryByText(/platform/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^bug$/i }));

    expect(screen.getByRole('heading', { name: /report bug/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
