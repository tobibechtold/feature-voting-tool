import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VoteButton } from '@/components/VoteButton';
import { FeedbackItem } from '@/types';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { useCommentCount } from '@/hooks/useComments';
import { normalizePlatformLabel } from '@/lib/platforms';

interface FeedbackCardProps {
  item: FeedbackItem;
  appSlug: string;
  voted: boolean;
  onVote: (id: string) => void;
}

export function FeedbackCard({
  item,
  appSlug,
  voted,
  onVote,
}: FeedbackCardProps) {
  const { t } = useTranslation();
  const { data: commentCount = 0 } = useCommentCount(item.id);

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

  return (
    <Link to={`/app/${appSlug}/${item.id}`}>
      <Card className={cn(
        "group transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20",
        (item.status === 'completed' || item.status === 'wont_do') && "opacity-60"
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-2">
            {/* Header row: badges */}
            <div className="flex items-center gap-2 flex-wrap">
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
            
            {/* Content */}
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {item.title}
            </h3>
            
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.description}
            </p>
            
            {/* Footer: heart + comments together on left */}
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
    </Link>
  );
}
