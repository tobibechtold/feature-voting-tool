import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoteButtonProps {
  count: number;
  voted: boolean;
  onVote: () => void;
  disabled?: boolean;
}

export function VoteButton({ count, voted, onVote, disabled }: VoteButtonProps) {
  return (
    <Button
      variant={voted ? 'voteActive' : 'vote'}
      size="vote"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onVote();
      }}
      disabled={disabled}
      className={cn(
        'group transition-all duration-300',
        voted && 'animate-vote-pop'
      )}
    >
      <ChevronUp
        className={cn(
          'h-5 w-5 transition-transform',
          !voted && 'group-hover:-translate-y-0.5'
        )}
      />
      <span className="text-lg font-bold">{count}</span>
    </Button>
  );
}
