import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { FeedbackItem, FeedbackStatus } from '@/types';
import { RoadmapBoard } from './RoadmapBoard';

const toastSpy = vi.fn();
const dndCoreSpies = vi.hoisted(() => ({
  pointerWithinSpy: vi.fn(),
  rectIntersectionSpy: vi.fn(),
  closestCenterSpy: vi.fn(),
  closestCornersSpy: vi.fn(),
  getFirstCollisionSpy: vi.fn((collisions: Array<{ id: string }> = []) => collisions[0]?.id ?? null),
}));
const dndHandlers: {
  current: {
    onDragStart?: (event: unknown) => void;
    onDragOver?: (event: unknown) => void;
    onDragEnd?: (event: unknown) => void;
    onDragCancel?: () => void;
    collisionDetection?: (args: unknown) => unknown;
  };
} = {
  current: {},
};

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

vi.mock('@/hooks/useComments', () => ({
  useCommentCount: () => ({
    data: 7,
  }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        feature: 'Feature',
        bug: 'Bug',
        ios: 'iOS',
        android: 'Android',
        web: 'Web',
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

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, collisionDetection, onDragStart, onDragOver, onDragEnd, onDragCancel }: {
    children: React.ReactNode;
    collisionDetection?: (args: unknown) => unknown;
    onDragStart?: (event: unknown) => void;
    onDragOver?: (event: unknown) => void;
    onDragEnd?: (event: unknown) => void;
    onDragCancel?: () => void;
  }) => {
    dndHandlers.current = {
      collisionDetection,
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel,
    };

    return <div data-testid="dnd-context">{children}</div>;
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="roadmap-drag-overlay">{children}</div>
  ),
  PointerSensor: class PointerSensor {},
  KeyboardSensor: class KeyboardSensor {},
  closestCenter: dndCoreSpies.closestCenterSpy,
  closestCorners: dndCoreSpies.closestCornersSpy,
  getFirstCollision: dndCoreSpies.getFirstCollisionSpy,
  pointerWithin: dndCoreSpies.pointerWithinSpy,
  rectIntersection: dndCoreSpies.rectIntersectionSpy,
  useSensor: vi.fn((_sensor: unknown, options?: unknown) => options ?? {}),
  useSensors: vi.fn((...sensors: unknown[]) => sensors),
  useDroppable: ({ id }: { id: string }) => ({
    setNodeRef: vi.fn(),
    isOver: false,
    active: null,
    over: null,
    rect: { current: null },
    node: { current: null },
    id,
  }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: (items: unknown[], from: number, to: number) => {
    const nextItems = [...items];
    const [moved] = nextItems.splice(from, 1);
    nextItems.splice(to, 0, moved);
    return nextItems;
  },
  rectSortingStrategy: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  useSortable: ({ id }: { id: string }) => ({
    attributes: { 'data-sortable-id': id },
    listeners: { onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
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

function makeActive(id: string, translatedTop = 0) {
  return {
    id,
    rect: {
      current: {
        translated: {
          top: translatedTop,
        },
      },
    },
  };
}

function makeOverItem(id: string, status: FeedbackStatus, top = 0, height = 100) {
  return {
    id,
    rect: {
      top,
      height,
    },
    data: {
      current: {
        type: 'item',
        status,
      },
    },
  };
}

function makeOverLane(status: FeedbackStatus) {
  return {
    id: `lane:${status}`,
    rect: {
      top: 0,
      height: 0,
    },
    data: {
      current: {
        type: 'lane',
        status,
      },
    },
  };
}

function triggerDragStart(id: string) {
  act(() => {
    dndHandlers.current.onDragStart?.({
      active: makeActive(id),
    });
  });
}

function triggerDragOverItem(
  activeId: string,
  overId: string,
  status: FeedbackStatus,
  translatedTop = 0,
  top = 0,
  height = 100
) {
  act(() => {
    dndHandlers.current.onDragOver?.({
      active: makeActive(activeId, translatedTop),
      over: makeOverItem(overId, status, top, height),
    });
  });
}

function triggerDragOverLane(activeId: string, status: FeedbackStatus) {
  act(() => {
    dndHandlers.current.onDragOver?.({
      active: makeActive(activeId),
      over: makeOverLane(status),
    });
  });
}

function triggerDragEndOnItem(
  activeId: string,
  overId: string,
  status: FeedbackStatus,
  translatedTop = 0,
  top = 0,
  height = 100
) {
  act(() => {
    dndHandlers.current.onDragEnd?.({
      active: makeActive(activeId, translatedTop),
      over: makeOverItem(overId, status, top, height),
    });
  });
}

function triggerDragEndOnLane(activeId: string, status: FeedbackStatus) {
  act(() => {
    dndHandlers.current.onDragEnd?.({
      active: makeActive(activeId),
      over: makeOverLane(status),
    });
  });
}

function renderBoard(props: Partial<{
  items: FeedbackItem[];
  isAdmin: boolean;
  onMoveItem: (payload: unknown) => Promise<unknown>;
  votedItems: Set<string>;
  onVote: (feedbackId: string) => void;
}> = {}) {
  dndHandlers.current = {};

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
        isAdmin={props.isAdmin ?? false}
        getStatusLabel={getStatusLabel}
        onMoveItem={props.onMoveItem || vi.fn().mockResolvedValue(undefined)}
        votedItems={props.votedItems || new Set<string>()}
        onVote={props.onVote || vi.fn()}
      />
    </MemoryRouter>
  );
}

function makeCollision(id: string) {
  return {
    id,
    data: {
      droppableContainer: {
        id,
      },
      value: 1,
    },
  };
}

describe('RoadmapBoard', () => {
  it('prefers items in the hovered lane over a neighboring lane during collision detection', () => {
    dndCoreSpies.pointerWithinSpy.mockReturnValue([makeCollision('lane:progress')]);
    dndCoreSpies.rectIntersectionSpy.mockReturnValue([]);
    dndCoreSpies.closestCenterSpy.mockReturnValue([makeCollision('progress-1')]);

    renderBoard({
      isAdmin: true,
      items: [
        makeItem({ id: 'planned-1', title: 'Planned item', status: 'planned', roadmap_position: 1 }),
        makeItem({ id: 'progress-1', title: 'Progress item', status: 'progress', roadmap_position: 1 }),
        makeItem({ id: 'completed-1', title: 'Completed item', status: 'completed', roadmap_position: 1 }),
      ],
    });

    const collisions = dndHandlers.current.collisionDetection?.({
      active: { id: 'planned-1' },
      collisionRect: { top: 0, left: 0, width: 100, height: 100, right: 100, bottom: 100 },
      droppableRects: new Map(),
      droppableContainers: [
        { id: 'lane:progress' },
        { id: 'progress-1' },
        { id: 'completed-1' },
      ],
      pointerCoordinates: { x: 10, y: 10 },
    });

    expect(collisions).toEqual([expect.objectContaining({ id: 'progress-1' })]);
    expect(dndCoreSpies.closestCenterSpy).toHaveBeenCalled();
  });

  it('renders lanes in status order, removes legacy drop strips, and keeps non-admin cards read only', () => {
    renderBoard();

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.slice(0, 2).map((heading) => heading.textContent)).toEqual([
      expect.stringContaining('Open'),
      expect.stringContaining('Planned'),
    ]);

    expect(screen.queryByLabelText(/drop /i)).toBeNull();
    expect(screen.getByTestId('roadmap-card-open-1')).toHaveAttribute('data-roadmap-sortable', 'false');
    expect(screen.queryByLabelText(/drag open item/i)).toBeNull();
  });

  it('shows a projected cross-lane move during drag and persists it on drop for admins', async () => {
    const onMoveItem = vi.fn().mockResolvedValue(undefined);

    renderBoard({
      isAdmin: true,
      onMoveItem,
      items: [
        makeItem({ id: 'open-1', title: 'Open item', status: 'open', roadmap_position: 1 }),
        makeItem({ id: 'planned-1', title: 'Planned item', status: 'planned', roadmap_position: 1 }),
        makeItem({ id: 'planned-2', title: 'Later planned item', status: 'planned', roadmap_position: 2 }),
      ],
    });

    triggerDragStart('open-1');
    triggerDragOverLane('open-1', 'planned');

    expect(screen.getByTestId('roadmap-card-open-1')).toHaveAttribute('data-roadmap-sortable', 'true');
    expect(within(screen.getByTestId('roadmap-lane-planned')).getByText('Open item')).toBeInTheDocument();
    expect(within(screen.getByTestId('roadmap-lane-open')).queryByText('Open item')).toBeNull();

    triggerDragEndOnLane('open-1', 'planned');

    await waitFor(() => {
      expect(onMoveItem).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 'open-1',
          destinationStatus: 'planned',
          destinationIndex: 2,
        })
      );
    });
  });

  it('reorders within the same lane through sortable drag projection', async () => {
    const onMoveItem = vi.fn().mockResolvedValue(undefined);

    renderBoard({
      isAdmin: true,
      onMoveItem,
      items: [
        makeItem({ id: 'open-1', title: 'First open item', status: 'open', roadmap_position: 1 }),
        makeItem({ id: 'open-2', title: 'Second open item', status: 'open', roadmap_position: 2 }),
        makeItem({ id: 'open-3', title: 'Third open item', status: 'open', roadmap_position: 3 }),
      ],
    });

    triggerDragStart('open-1');
    triggerDragOverItem('open-1', 'open-3', 'open', 250, 100, 100);

    const openCards = within(screen.getByTestId('roadmap-lane-open')).getAllByTestId(/roadmap-card-open-/);
    expect(openCards.map((card) => card.getAttribute('data-testid'))).toEqual([
      'roadmap-card-open-2',
      'roadmap-card-open-3',
      'roadmap-card-open-1',
    ]);

    triggerDragEndOnItem('open-1', 'open-3', 'open', 250, 100, 100);

    await waitFor(() => {
      expect(onMoveItem).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 'open-1',
          destinationStatus: 'open',
          destinationIndex: 2,
        })
      );
    });
  });

  it('persists the projected reorder position when drag end resolves to the lane container', async () => {
    const onMoveItem = vi.fn().mockResolvedValue(undefined);

    renderBoard({
      isAdmin: true,
      onMoveItem,
      items: [
        makeItem({ id: 'open-1', title: 'First open item', status: 'open', roadmap_position: 1 }),
        makeItem({ id: 'open-2', title: 'Second open item', status: 'open', roadmap_position: 2 }),
        makeItem({ id: 'open-3', title: 'Third open item', status: 'open', roadmap_position: 3 }),
      ],
    });

    triggerDragStart('open-1');
    triggerDragOverItem('open-1', 'open-3', 'open', 250, 100, 100);

    const openCards = within(screen.getByTestId('roadmap-lane-open')).getAllByTestId(/roadmap-card-open-/);
    expect(openCards.map((card) => card.getAttribute('data-testid'))).toEqual([
      'roadmap-card-open-2',
      'roadmap-card-open-3',
      'roadmap-card-open-1',
    ]);

    triggerDragEndOnLane('open-1', 'open');

    await waitFor(() => {
      expect(onMoveItem).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 'open-1',
          destinationStatus: 'open',
          destinationIndex: 2,
        })
      );
    });
  });

  it('uses the pre-drag persisted sibling positions when persisting a reorder', async () => {
    const onMoveItem = vi.fn().mockResolvedValue(undefined);

    renderBoard({
      isAdmin: true,
      onMoveItem,
      items: [
        makeItem({ id: 'open-1', title: 'Moved item', status: 'open', roadmap_position: 3 }),
        makeItem({ id: 'open-2', title: 'Current first item', status: 'open', roadmap_position: 1 }),
        makeItem({ id: 'open-3', title: 'Current second item', status: 'open', roadmap_position: 2 }),
      ],
    });

    triggerDragStart('open-1');
    triggerDragOverItem('open-1', 'open-2', 'open', 0, 0, 100);
    triggerDragEndOnItem('open-1', 'open-2', 'open', 0, 0, 100);

    await waitFor(() => {
      expect(onMoveItem).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 'open-1',
          destinationStatus: 'open',
          destinationIndex: 0,
          destinationItems: [
            { id: 'open-2', roadmap_position: 1 },
            { id: 'open-3', roadmap_position: 2 },
          ],
        })
      );
    });
  });

  it('keeps the projected reorder when drag over and drag end happen in the same React flush', async () => {
    const onMoveItem = vi.fn().mockResolvedValue(undefined);

    renderBoard({
      isAdmin: true,
      onMoveItem,
      items: [
        makeItem({ id: 'open-1', title: 'First open item', status: 'open', roadmap_position: 1 }),
        makeItem({ id: 'open-2', title: 'Second open item', status: 'open', roadmap_position: 2 }),
        makeItem({ id: 'open-3', title: 'Third open item', status: 'open', roadmap_position: 3 }),
      ],
    });

    act(() => {
      dndHandlers.current.onDragStart?.({
        active: makeActive('open-1'),
      });
      dndHandlers.current.onDragOver?.({
        active: makeActive('open-1', 0),
        over: makeOverItem('open-2', 'open', 0, 100),
      });
      dndHandlers.current.onDragEnd?.({
        active: makeActive('open-1', 0),
        over: makeOverItem('open-2', 'open', 0, 100),
      });
    });

    await waitFor(() => {
      expect(onMoveItem).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 'open-1',
          destinationStatus: 'open',
          destinationIndex: 1,
        })
      );
    });

    const openCards = within(screen.getByTestId('roadmap-lane-open')).getAllByTestId(/roadmap-card-open-/);
    expect(openCards.map((card) => card.getAttribute('data-testid'))).toEqual([
      'roadmap-card-open-2',
      'roadmap-card-open-1',
      'roadmap-card-open-3',
    ]);
  });

  it('renders the same badges and vote/comment controls as the list card and votes in place', () => {
    const onVote = vi.fn();

    renderBoard({
      items: [
        makeItem({
          id: 'bug-1',
          title: 'Bug item',
          status: 'open',
          type: 'bug',
          platform: 'ios',
          version: '1.2.3',
        }),
      ],
      onVote,
    });

    const card = screen.getByTestId('roadmap-card-bug-1');
    expect(within(card).getByText('Bug')).toBeInTheDocument();
    expect(within(card).getByText('iOS')).toBeInTheDocument();
    expect(within(card).getByText('Open')).toBeInTheDocument();
    expect(within(card).getByText('v1.2.3')).toBeInTheDocument();
    expect(within(card).getByText('7')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button').click();
    });

    expect(onVote).toHaveBeenCalledWith('bug-1');
  });

  it('reverts the projected move and shows a toast when persistence fails', async () => {
    const onMoveItem = vi.fn().mockRejectedValue(new Error('Move failed'));

    renderBoard({ isAdmin: true, onMoveItem });

    triggerDragStart('open-1');
    triggerDragOverLane('open-1', 'planned');
    expect(within(screen.getByTestId('roadmap-lane-planned')).getByText('Open item')).toBeInTheDocument();

    triggerDragEndOnLane('open-1', 'planned');

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Move failed',
        })
      );
    });

    expect(within(screen.getByTestId('roadmap-lane-open')).getByText('Open item')).toBeInTheDocument();
    expect(within(screen.getByTestId('roadmap-lane-planned')).queryByText('Open item')).toBeNull();
  });
});
