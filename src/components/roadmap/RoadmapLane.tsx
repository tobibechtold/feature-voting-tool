import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoadmapCard } from './RoadmapCard';
import type { FeedbackItem, FeedbackStatus } from '@/types';

interface RoadmapLaneProps {
  status: FeedbackStatus;
  label: string;
  items: FeedbackItem[];
  appSlug: string;
  isAdmin: boolean;
  onDragStart: (feedbackId: string, status: FeedbackStatus, index: number) => void;
  onDragEnd: () => void;
  onDropAt: (status: FeedbackStatus, destinationIndex: number) => void;
}

function DropZone({
  label,
  onDrop,
}: {
  label: string;
  onDrop: () => void;
}) {
  return (
    <div
      aria-label={label}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className="h-3 rounded-md border border-dashed border-transparent transition-colors hover:border-primary/30"
    />
  );
}

export function RoadmapLane({
  status,
  label,
  items,
  appSlug,
  isAdmin,
  onDragStart,
  onDragEnd,
  onDropAt,
}: RoadmapLaneProps) {
  return (
    <Card data-testid={`roadmap-lane-${status}`} className="min-h-[16rem]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{label}</span>
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length > 0 ? (
          items.map((item, index) => (
            <Fragment key={item.id}>
              {isAdmin && (
                <DropZone
                  label={`Drop before ${item.title}`}
                  onDrop={() => onDropAt(status, index)}
                />
              )}
              <RoadmapCard
                item={item}
                appSlug={appSlug}
                isAdmin={isAdmin}
                onDragStart={() => onDragStart(item.id, status, index)}
                onDragEnd={onDragEnd}
              />
            </Fragment>
          ))
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No items
          </div>
        )}

        {isAdmin && (
          <DropZone
            label={`Drop at end of ${label}`}
            onDrop={() => onDropAt(status, items.length)}
          />
        )}
      </CardContent>
    </Card>
  );
}
