import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { FeedbackItem, FeedbackStatus } from '@/types';
import { RoadmapBoard } from './RoadmapBoard';

const toastSpy = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

function makeItem(partial: Partial<FeedbackItem> & Pick<FeedbackItem, 'id' | 'title' | 'status'>): FeedbackItem {
  return {
    id: partial.id,
    title: partial.title,
    status: partial.status,
    app_id: 'app-1',
    type: partial.type || 'feature',
    description: partial.description || '',
    vote_count: partial.vote_count ?? 0,
    created_at: partial.created_at || '2026-01-01T00:00:00.000Z',
    version: partial.version ?? null,
    platform: partial.platform || null,
    submitter_email: null,
    notify_on_updates: false,
    roadmap_position: partial.roadmap_position ?? null,
  };
}

function getStatusLabel(status: FeedbackStatus) {
  const labels: Record<FeedbackStatus, string> = {
    open: 'Open',
    planned: 'Planned',
    progress: 'In Progress',
    completed: 'Completed',
    wont_do: "Won't Do",
  };

  return labels[status];
}

function renderBoard(props: Partial<{
  items: FeedbackItem[];
  isAdmin: boolean;
  onMoveItem: (payload: unknown) => Promise<unknown>;
}> = {}) {
  return render(
    <MemoryRouter>
      <RoadmapBoard
        items={
          props.items || [
            makeItem({ id: 'open-1', title: 'Open item', status: 'open', roadmap_position: 1 }),
            makeItem({ id: 'planned-1', title: 'Planned item', status: 'planned', roadmap_position: 1 }),
          ]
        }
        appSlug="roadmap-tool"
        sortMode="popularity"
        isAdmin={props.isAdmin ?? false}
        getStatusLabel={getStatusLabel}
        onMoveItem={props.onMoveItem || vi.fn().mockResolvedValue(undefined)}
      />
    </MemoryRouter>
  );
}

describe('RoadmapBoard', () => {
  it('renders lanes in status order and keeps non-admin cards read only', () => {
    renderBoard();

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.slice(0, 2).map((heading) => heading.textContent)).toEqual([
      expect.stringContaining('Open'),
      expect.stringContaining('Planned'),
    ]);

    expect(screen.getByTestId('roadmap-card-open-1')).toHaveAttribute('draggable', 'false');
    expect(screen.queryByLabelText(/drag open item/i)).toBeNull();
  });

  it('shows drag affordances for admins and moves cards between lanes', async () => {
    const onMoveItem = vi.fn().mockResolvedValue(undefined);
    renderBoard({ isAdmin: true, onMoveItem });

    const card = screen.getByTestId('roadmap-card-open-1');
    const plannedLane = screen.getByTestId('roadmap-lane-planned');
    const dropZone = screen.getByLabelText(/drop at end of planned/i);

    expect(card).toHaveAttribute('draggable', 'true');
    expect(screen.getByLabelText(/drag open item/i)).toBeInTheDocument();

    fireEvent.dragStart(card);
    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone);

    await waitFor(() => {
      expect(onMoveItem).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 'open-1',
          destinationStatus: 'planned',
          destinationIndex: 1,
        })
      );
    });

    expect(within(plannedLane).getByText('Open item')).toBeInTheDocument();
  });

  it('reverts the optimistic move and shows a toast when mutation fails', async () => {
    const onMoveItem = vi.fn().mockRejectedValue(new Error('Move failed'));
    renderBoard({ isAdmin: true, onMoveItem });

    const openLane = screen.getByTestId('roadmap-lane-open');
    const plannedLane = screen.getByTestId('roadmap-lane-planned');
    const card = screen.getByTestId('roadmap-card-open-1');
    const dropZone = screen.getByLabelText(/drop at end of planned/i);

    fireEvent.dragStart(card);
    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone);

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Move failed',
        })
      );
    });

    expect(within(openLane).getByText('Open item')).toBeInTheDocument();
    expect(within(plannedLane).queryByText('Open item')).toBeNull();
  });
});
