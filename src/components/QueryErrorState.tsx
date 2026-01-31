import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';

interface QueryErrorStateProps {
  error: Error | null;
  onRetry: () => void;
  isRetrying?: boolean;
}

export function QueryErrorState({ error, onRetry, isRetrying }: QueryErrorStateProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <h3 className="font-semibold text-lg mb-1">{t('loadError') || 'Failed to load'}</h3>
            <p className="text-sm text-muted-foreground">
              {error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <Button onClick={onRetry} disabled={isRetrying} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
            {t('retry') || 'Retry'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
