import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OfflineStateProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function OfflineState({ onRetry, isRetrying }: OfflineStateProps) {
  return (
    <Card className="border-muted bg-muted/5">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-lg mb-1">You appear to be offline</h3>
            <p className="text-sm text-muted-foreground">
              Check your internet connection and try again.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onRetry} disabled={isRetrying} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              Retry
            </Button>
            <Button onClick={() => window.location.reload()} variant="ghost">
              Reload page
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
