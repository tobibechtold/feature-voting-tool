import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  getFirstCollision,
  type Over,
  type UniqueIdentifier,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useToast } from '@/hooks/use-toast';
import { buildFeedbackStateSections, sortRoadmapLaneItems } from '@/lib/feedbackOverview';
import { RoadmapLane } from './RoadmapLane';
import type { FeedbackItem, FeedbackStatus } from '@/types';

type MovePayload = {
  feedbackId: string;
  destinationStatus: FeedbackStatus;
  destinationItems: Array<{ id: string; roadmap_position?: number | null }>;
  destinationIndex: number;
};

interface RoadmapBoardProps {
  items: FeedbackItem[];
  appSlug: string;
  isAdmin: boolean;
  votedItems: Set<string>;
  onVote: (feedbackId: string) => void;
  getStatusLabel: (status: FeedbackStatus) => string;
  onMoveItem: (payload: MovePayload) => Promise<unknown>;
}

type ProjectedDestination = {
  status: FeedbackStatus;
  index: number;
} | null;

const ROADMAP_LANE_ID_PREFIX = 'lane:';

function buildRoadmapSections(items: FeedbackItem[]) {
  return buildFeedbackStateSections(items).map((section) => ({
    ...section,
    items: sortRoadmapLaneItems(section.items),
  }));
}

function normalizePersistedLanePositions(items: FeedbackItem[]): FeedbackItem[] {
  return buildRoadmapSections(items).flatMap((section) =>
    section.items.map((item, index) => ({
      ...item,
      status: section.status,
      roadmap_position: index + 1,
    }))
  );
}

function normalizeProjectedLanePositions(items: FeedbackItem[]): FeedbackItem[] {
  return buildFeedbackStateSections(items).flatMap((section) =>
    section.items.map((item, index) => ({
      ...item,
      status: section.status,
      roadmap_position: index + 1,
    }))
  );
}

function moveItemWithinBoard(
  items: FeedbackItem[],
  feedbackId: string,
  destinationStatus: FeedbackStatus,
  destinationIndex: number
) {
  const sections = buildRoadmapSections(items).map((section) => ({
    ...section,
    items: [...section.items],
  }));

  let movingItem: FeedbackItem | null = null;

  sections.forEach((section) => {
    const itemIndex = section.items.findIndex((item) => item.id === feedbackId);
    if (itemIndex >= 0) {
      movingItem = section.items[itemIndex];
      section.items.splice(itemIndex, 1);
    }
  });

  if (!movingItem) return items;

  const destinationSection = sections.find((section) => section.status === destinationStatus);
  if (!destinationSection) return items;

  destinationSection.items.splice(destinationIndex, 0, {
    ...movingItem,
    status: destinationStatus,
  });

  return normalizeProjectedLanePositions(
    sections.flatMap((section) => section.items)
  );
}

function getLaneId(status: FeedbackStatus): string {
  return `${ROADMAP_LANE_ID_PREFIX}${status}`;
}

function getStatusFromLaneId(id: UniqueIdentifier): FeedbackStatus | null {
  if (typeof id !== 'string' || !id.startsWith(ROADMAP_LANE_ID_PREFIX)) return null;
  return id.slice(ROADMAP_LANE_ID_PREFIX.length) as FeedbackStatus;
}

function findItemLocation(items: FeedbackItem[], feedbackId: string) {
  const sections = buildRoadmapSections(items);

  for (const section of sections) {
    const index = section.items.findIndex((item) => item.id === feedbackId);
    if (index >= 0) {
      return {
        status: section.status,
        index,
      };
    }
  }

  return null;
}

function getProjectedDestination(
  items: FeedbackItem[],
  activeId: string,
  over: Over | null,
  translatedTop: number
) {
  if (!over) return null;

  const laneStatus = getStatusFromLaneId(over.id);
  if (laneStatus) {
    const laneItems = buildRoadmapSections(items).find((section) => section.status === laneStatus)?.items || [];
    return {
      status: laneStatus,
      index: laneItems.length,
    };
  }

  const overLocation = findItemLocation(items, String(over.id));
  if (!overLocation) return null;

  const isBelowOverItem =
    typeof over.rect?.top === 'number' &&
    typeof over.rect?.height === 'number' &&
    translatedTop > over.rect.top + over.rect.height;

  return {
    status: overLocation.status,
    index: overLocation.index + (isBelowOverItem ? 1 : 0),
  };
}

function projectRoadmapDrag(
  items: FeedbackItem[],
  activeId: string,
  over: Over | null,
  translatedTop: number
) {
  const sourceLocation = findItemLocation(items, activeId);
  const destination = getProjectedDestination(items, activeId, over, translatedTop);

  if (!sourceLocation || !destination) return items;
  if (sourceLocation.status === destination.status && sourceLocation.index === destination.index) return items;

  return moveItemWithinBoard(items, activeId, destination.status, destination.index);
}

export function RoadmapBoard({
  items,
  appSlug,
  isAdmin,
  votedItems,
  onVote,
  getStatusLabel,
  onMoveItem,
}: RoadmapBoardProps) {
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [boardItems, setBoardItems] = useState(() => normalizePersistedLanePositions(items));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragSnapshot, setDragSnapshot] = useState<FeedbackItem[] | null>(null);
  const [projectedDestination, setProjectedDestination] = useState<ProjectedDestination>(null);
  const boardItemsRef = useRef(boardItems);
  const dragSnapshotRef = useRef<FeedbackItem[] | null>(null);
  const projectedDestinationRef = useRef<ProjectedDestination>(null);
  const lastCollisionIdRef = useRef<UniqueIdentifier | null>(null);

  useEffect(() => {
    const normalizedItems = normalizePersistedLanePositions(items);
    boardItemsRef.current = normalizedItems;
    setBoardItems(normalizedItems);
  }, [items]);

  const sections = useMemo(() => buildRoadmapSections(boardItems), [boardItems]);

  const collisionDetection = useCallback(
    (args: Parameters<typeof pointerWithin>[0]) => {
      const pointerIntersections = pointerWithin(args);
      const intersections = pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);
      let overId = getFirstCollision(intersections, 'id');

      if (overId !== null && overId !== undefined) {
        const laneStatus = getStatusFromLaneId(overId);

        if (laneStatus) {
          const laneItemIds = sections
            .find((section) => section.status === laneStatus)
            ?.items.map((item) => item.id)
            .filter((itemId) => itemId !== String(args.active.id)) || [];

          if (laneItemIds.length > 0) {
            const itemIntersections = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter((container) =>
                laneItemIds.includes(String(container.id))
              ),
            });
            const itemOverId = getFirstCollision(itemIntersections, 'id');

            if (itemOverId !== null && itemOverId !== undefined) {
              overId = itemOverId;
            }
          }
        }

        lastCollisionIdRef.current = overId;
        return [{ id: overId }];
      }

      return lastCollisionIdRef.current !== null ? [{ id: lastCollisionIdRef.current }] : [];
    },
    [sections]
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (!isAdmin) return;

    const currentBoardItems = boardItemsRef.current;
    const nextProjectedDestination = findItemLocation(currentBoardItems, String(active.id));
    lastCollisionIdRef.current = String(active.id);
    dragSnapshotRef.current = currentBoardItems;
    projectedDestinationRef.current = nextProjectedDestination;
    setActiveId(String(active.id));
    setDragSnapshot(currentBoardItems);
    setProjectedDestination(nextProjectedDestination);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!isAdmin || !over) return;

    const currentBoardItems = boardItemsRef.current;
    const nextItems = projectRoadmapDrag(
      currentBoardItems,
      String(active.id),
      over,
      active.rect.current.translated?.top ?? 0
    );
    const nextProjectedDestination = findItemLocation(nextItems, String(active.id));

    projectedDestinationRef.current = nextProjectedDestination;
    setProjectedDestination(nextProjectedDestination);

    if (nextItems !== currentBoardItems) {
      boardItemsRef.current = nextItems;
      setBoardItems(nextItems);
    }
  };

  const resetDragState = (nextItems?: FeedbackItem[]) => {
    if (nextItems) {
      boardItemsRef.current = nextItems;
      setBoardItems(nextItems);
    }

    lastCollisionIdRef.current = null;
    dragSnapshotRef.current = null;
    projectedDestinationRef.current = null;
    setActiveId(null);
    setDragSnapshot(null);
    setProjectedDestination(null);
  };

  const handleDragCancel = () => {
    resetDragState(dragSnapshot || boardItems);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const currentDragSnapshot = dragSnapshotRef.current;
    const currentProjectedDestination = projectedDestinationRef.current;
    const currentBoardItems = boardItemsRef.current;

    if (!isAdmin || !currentDragSnapshot) {
      resetDragState();
      return;
    }

    if (!over) {
      resetDragState(currentDragSnapshot);
      return;
    }

    const feedbackId = String(active.id);
    const sourceLocation = findItemLocation(currentDragSnapshot, feedbackId);
    const destinationLocation = currentProjectedDestination;

    if (!sourceLocation || !destinationLocation) {
      resetDragState(currentDragSnapshot);
      return;
    }

    if (
      sourceLocation.status === destinationLocation.status &&
      sourceLocation.index === destinationLocation.index
    ) {
      resetDragState(currentBoardItems);
      return;
    }

    const destinationSection = buildRoadmapSections(currentDragSnapshot).find(
      (section) => section.status === destinationLocation.status
    );

    if (!destinationSection) {
      resetDragState(currentDragSnapshot);
      return;
    }

    resetDragState(currentBoardItems);

    try {
      await onMoveItem({
        feedbackId,
        destinationStatus: destinationLocation.status,
        destinationItems: destinationSection.items
          .filter((item) => item.id !== feedbackId)
          .map((item) => ({
            id: item.id,
            roadmap_position: item.roadmap_position ?? null,
          })),
        destinationIndex: destinationLocation.index,
      });
    } catch (error) {
      boardItemsRef.current = currentDragSnapshot;
      setBoardItems(currentDragSnapshot);
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {sections.map((section) => (
          <RoadmapLane
            key={section.status}
            laneId={getLaneId(section.status)}
            status={section.status}
            label={getStatusLabel(section.status)}
            items={section.items}
            appSlug={appSlug}
            isAdmin={isAdmin}
            votedItems={votedItems}
            onVote={onVote}
          />
        ))}
      </div>
    </DndContext>
  );
}
