import { formatItemKey } from '@/lib/itemKey';
import { cn } from '@/lib/utils';

interface ItemKeyLabelProps {
  appKey: string;
  number: number;
  className?: string;
}

export function ItemKeyLabel({ appKey, number, className }: ItemKeyLabelProps) {
  return (
    <span className={cn('font-mono text-xs text-muted-foreground', className)}>
      {formatItemKey(appKey, number)}
    </span>
  );
}
