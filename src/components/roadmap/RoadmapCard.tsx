import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { VoteButton } from '@/components/VoteButton';
import { useCommentCount } from '@/hooks/useComments';
import { useTranslation } from '@/hooks/useTranslation';
import { normalizePlatformLabel } from '@/lib/platforms';
import { cn } from '@/lib/utils';
import type { FeedbackItem } from '@/types';

interface RoadmapCardProps {
  item: FeedbackItem;
  appSlug: string;
  isAdmin: boolean;
  voted: boolean;
  onVote: (id: string) => void;
}

export function RoadmapCard({
  item,
  appSlug,
  isAdmin,
  voted,
  onVote,
}: RoadmapCardProps) {
  const { t } = useTranslation();
  const { data: commentCount = 0 } = useCommentCount(item.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !isAdmin,
    data: {
      type: 'item',
      status: item.status,
    },
  });

  const getStatusLabel = () => {
    switch (item.status) {
      case 'planned':
        return t('statusPlanned');
      case 'progress':
        return t('statusProgress');
      case 'completed':
        return t('statusCompleted');
      case 'wont_do':
        return t('statusWontDo');
      default:
        return t('statusOpen');
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`roadmap-card-${item.id}`}
      data-roadmap-sortable={isAdmin ? 'true' : 'false'}
      className={cn(
        isAdmin && 'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-40'
      )}
      {...(isAdmin ? attributes : {})}
      {...(isAdmin ? listeners : {})}
    >
      <Card className={cn(
        'transition-colors hover:border-primary/30 hover:bg-muted/40',
        (item.status === 'completed' || item.status === 'wont_do') && 'opacity-60'
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={item.type === 'feature' ? 'feature' : 'bug'}>
                  {item.type === 'feature' ? t('feature') : t('bug')}
                </Badge>
                {item.type === 'bug' && item.platform && (
                  <Badge variant="secondary">
                    {normalizePlatformLabel(item.platform)}
                  </Badge>
                )}
                <Badge variant={item.status as 'open' | 'planned' | 'progress' | 'completed' | 'wont_do'}>
                  {getStatusLabel()}
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
              <div className="font-semibold text-foreground transition-colors hover:text-primary line-clamp-1">
                {item.title}
              </div>
              <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</div>
            </Link>

            <div className="flex items-center gap-4 mt-1">
              <VoteButton
                count={item.vote_count}
                voted={voted}
                onVote={() => onVote(item.id)}
                disabled={item.status === 'completed' || item.status === 'wont_do'}
              />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>{commentCount}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
