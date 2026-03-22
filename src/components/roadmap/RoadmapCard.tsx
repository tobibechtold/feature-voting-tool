import { GripVertical } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { FeedbackItem } from '@/types';

interface RoadmapCardProps {
  item: FeedbackItem;
  appSlug: string;
  isAdmin: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function RoadmapCard({ item, appSlug, isAdmin, onDragStart, onDragEnd }: RoadmapCardProps) {
  return (
    <div
      data-testid={`roadmap-card-${item.id}`}
      draggable={isAdmin}
      onDragStart={isAdmin ? onDragStart : undefined}
      onDragEnd={isAdmin ? onDragEnd : undefined}
      className={isAdmin ? 'cursor-grab active:cursor-grabbing' : undefined}
    >
      <Card className="transition-colors hover:border-primary/30 hover:bg-muted/40">
        <CardContent className="p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.type === 'feature' ? 'feature' : 'bug'}>
                {item.type}
              </Badge>
              {item.version && (
                <Badge variant="secondary" className="font-mono text-xs">
                  v{item.version.replace(/^v/, '')}
                </Badge>
              )}
            </div>
            {isAdmin && (
              <div className="text-muted-foreground" aria-label={`Drag ${item.title}`}>
                <GripVertical className="h-4 w-4" />
              </div>
            )}
          </div>

          <Link to={`/app/${appSlug}/${item.id}`} className="block">
            <div className="font-medium">{item.title}</div>
            <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
