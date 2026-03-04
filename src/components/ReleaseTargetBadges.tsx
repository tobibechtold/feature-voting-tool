import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { normalizePlatformLabel } from '@/lib/platforms';

export interface ReleaseTargetBadgeItem {
  id: string;
  platform: string;
  semver: string;
}

interface ReleaseTargetBadgesProps {
  targets: ReleaseTargetBadgeItem[];
  isAdmin: boolean;
  isRemoving: boolean;
  label: string;
  onRemove: (targetId: string) => void;
}

export function ReleaseTargetBadges({
  targets,
  isAdmin,
  isRemoving,
  label,
  onRemove,
}: ReleaseTargetBadgesProps) {
  if (targets.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {targets.map((target) => (
        <Badge key={target.id} variant="secondary" className="font-mono gap-1">
          <span>{normalizePlatformLabel(target.platform)} v{target.semver.replace(/^v/, '')}</span>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onRemove(target.id)}
              disabled={isRemoving}
              className="rounded-sm hover:bg-muted-foreground/20 disabled:opacity-50"
              aria-label="Remove version target"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
}
