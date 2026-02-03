import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoteButtonProps {
  count: number;
  voted: boolean;
  onVote: () => void;
  disabled?: boolean;
}

export function VoteButton({ count, voted, onVote, disabled }: VoteButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onVote();
      }}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 transition-all duration-200',
        'hover:scale-105 active:scale-95',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <Heart
        className={cn(
          'h-5 w-5 transition-all duration-200',
          voted 
            ? 'fill-destructive text-destructive animate-vote-pop' 
            : 'text-muted-foreground hover:text-destructive/70'
        )}
      />
      <span className={cn(
        'text-sm font-semibold',
        voted ? 'text-destructive' : 'text-muted-foreground'
      )}>
        {count}
      </span>
    </button>
  );
}
