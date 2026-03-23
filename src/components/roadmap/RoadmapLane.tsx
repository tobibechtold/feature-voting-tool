import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { RoadmapCard } from './RoadmapCard';
import type { FeedbackItem, FeedbackStatus } from '@/types';

interface RoadmapLaneProps {
  laneId: string;
  status: FeedbackStatus;
  label: string;
  items: FeedbackItem[];
  appSlug: string;
  isAdmin: boolean;
  votedItems: Set<string>;
  onVote: (feedbackId: string) => void;
}

export function RoadmapLane({
  laneId,
  status,
  label,
  items,
  appSlug,
  isAdmin,
  votedItems,
  onVote,
}: RoadmapLaneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: laneId,
    data: {
      type: 'lane',
      status,
    },
  });

  return (
    <Card
      ref={setNodeRef}
      data-testid={`roadmap-lane-${status}`}
      data-roadmap-lane-over={isAdmin && isOver ? 'true' : 'false'}
      className={cn(
        'min-h-[16rem] transition-colors',
        isAdmin && isOver && 'border-primary/40 bg-muted/30'
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{label}</span>
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.length > 0 ? (
            items.map((item) => (
              <RoadmapCard
                key={item.id}
                item={item}
                appSlug={appSlug}
                isAdmin={isAdmin}
                voted={votedItems.has(item.id)}
                onVote={onVote}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No items
            </div>
          )}
        </SortableContext>
      </CardContent>
    </Card>
  );
}
