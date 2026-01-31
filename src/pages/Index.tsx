import { Header } from '@/components/Header';
import { AppCard } from '@/components/AppCard';
import { QueryErrorState } from '@/components/QueryErrorState';
import { OfflineState } from '@/components/OfflineState';
import { useTranslation } from '@/hooks/useTranslation';
import { useApps } from '@/hooks/useApps';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';

const Index = () => {
  const { t } = useTranslation();
  const { data: apps, isLoading, error, refetch, isRefetching, fetchStatus, isFetching } = useApps();

  // Determine what to show:
  // - If paused (offline), show offline UI
  // - If error, show error UI  
  // - If loading with no data, show skeleton
  // - If we have data, show it (with optional refresh indicator)
  const isPaused = fetchStatus === 'paused';
  const hasData = apps && apps.length > 0;
  const showSkeleton = isLoading && !hasData;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl font-bold tracking-tight mb-4">
              {t('selectApp')}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t('selectAppDesc')}
            </p>
          </div>

          {/* Show refresh indicator when fetching with existing data */}
          {isFetching && hasData && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Refreshing...</span>
            </div>
          )}

          {isPaused ? (
            <OfflineState 
              onRetry={() => refetch()} 
              isRetrying={isRefetching}
            />
          ) : error ? (
            <QueryErrorState 
              error={error as Error} 
              onRetry={() => refetch()} 
              isRetrying={isRefetching}
            />
          ) : showSkeleton ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : hasData ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {apps.map((app, index) => (
                <div
                  key={app.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <AppCard app={app} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">{t('noApps')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
