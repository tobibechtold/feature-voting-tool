import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  buildFeedbackStateSections,
  sortRoadmapLaneItems,
  type OverviewSortMode,
} from '@/lib/feedbackOverview';
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
  sortMode: OverviewSortMode;
  isAdmin: boolean;
  getStatusLabel: (status: FeedbackStatus) => string;
  onMoveItem: (payload: MovePayload) => Promise<unknown>;
}

type DragState = {
  feedbackId: string;
  sourceStatus: FeedbackStatus;
  sourceIndex: number;
} | null;

function buildRoadmapSections(items: FeedbackItem[], sortMode: OverviewSortMode) {
  return buildFeedbackStateSections(items).map((section) => ({
    ...section,
    items: sortRoadmapLaneItems(section.items, sortMode),
  }));
}

function normalizeLanePositions(items: FeedbackItem[], sortMode: OverviewSortMode): FeedbackItem[] {
  return buildRoadmapSections(items, sortMode).flatMap((section) =>
    section.items.map((item, index) => ({
      ...item,
      status: section.status,
      roadmap_position: index + 1,
    }))
  );
}

function moveItemWithinBoard(
  items: FeedbackItem[],
  sortMode: OverviewSortMode,
  feedbackId: string,
  destinationStatus: FeedbackStatus,
  destinationIndex: number
) {
  const sections = buildRoadmapSections(items, sortMode).map((section) => ({
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

  return normalizeLanePositions(
    sections.flatMap((section) => section.items),
    sortMode
  );
}

export function RoadmapBoard({
  items,
  appSlug,
  sortMode,
  isAdmin,
  getStatusLabel,
  onMoveItem,
}: RoadmapBoardProps) {
  const { toast } = useToast();
  const [boardItems, setBoardItems] = useState(() => normalizeLanePositions(items, sortMode));
  const [dragState, setDragState] = useState<DragState>(null);

  useEffect(() => {
    setBoardItems(normalizeLanePositions(items, sortMode));
  }, [items, sortMode]);

  const sections = useMemo(() => buildRoadmapSections(boardItems, sortMode), [boardItems, sortMode]);

  const handleDrop = async (destinationStatus: FeedbackStatus, rawDestinationIndex: number) => {
    if (!dragState) return;

    const previousItems = boardItems;
    const destinationSection = sections.find((section) => section.status === destinationStatus);
    if (!destinationSection) return;

    const adjustedDestinationIndex =
      dragState.sourceStatus === destinationStatus && dragState.sourceIndex < rawDestinationIndex
        ? rawDestinationIndex - 1
        : rawDestinationIndex;

    if (dragState.sourceStatus === destinationStatus && adjustedDestinationIndex === dragState.sourceIndex) {
      setDragState(null);
      return;
    }

    const optimisticItems = moveItemWithinBoard(
      boardItems,
      sortMode,
      dragState.feedbackId,
      destinationStatus,
      adjustedDestinationIndex
    );

    setBoardItems(optimisticItems);
    setDragState(null);

    try {
      await onMoveItem({
        feedbackId: dragState.feedbackId,
        destinationStatus,
        destinationItems: destinationSection.items
          .filter((item) => item.id !== dragState.feedbackId)
          .map((item) => ({
            id: item.id,
            roadmap_position: item.roadmap_position ?? null,
          })),
        destinationIndex: adjustedDestinationIndex,
      });
    } catch (error) {
      setBoardItems(previousItems);
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {sections.map((section) => (
        <RoadmapLane
          key={section.status}
          status={section.status}
          label={getStatusLabel(section.status)}
          items={section.items}
          appSlug={appSlug}
          isAdmin={isAdmin}
          onDragStart={(feedbackId, status, index) => {
            setDragState({
              feedbackId,
              sourceStatus: status,
              sourceIndex: index,
            });
          }}
          onDragEnd={() => setDragState(null)}
          onDropAt={handleDrop}
        />
      ))}
    </div>
  );
}
