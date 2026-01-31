import { Header } from '@/components/Header';
import { AppCard } from '@/components/AppCard';
import { QueryErrorState } from '@/components/QueryErrorState';
import { useTranslation } from '@/hooks/useTranslation';
import { useApps } from '@/hooks/useApps';
import { Skeleton } from '@/components/ui/skeleton';

const Index = () => {
  const { t } = useTranslation();
  const { data: apps, isLoading, error, refetch, isRefetching } = useApps();

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

          {error ? (
            <QueryErrorState 
              error={error as Error} 
              onRetry={() => refetch()} 
              isRetrying={isRefetching}
            />
          ) : isLoading && !apps ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : apps && apps.length > 0 ? (
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
