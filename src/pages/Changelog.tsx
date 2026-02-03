import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Bug } from 'lucide-react';
import { Header } from '@/components/Header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OfflineState } from '@/components/OfflineState';
import { QueryErrorState } from '@/components/QueryErrorState';
import { useTranslation } from '@/hooks/useTranslation';
import { useApp as useAppData } from '@/hooks/useApps';
import { useChangelog, compareVersions } from '@/hooks/useChangelog';
import { FeedbackItem } from '@/types';

export default function Changelog() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  
  const { data: app, isLoading: appLoading, error: appError, fetchStatus: appFetchStatus, refetch: refetchApp } = useAppData(slug);
  const { data: changelog, isLoading: changelogLoading, error: changelogError, fetchStatus: changelogFetchStatus, refetch: refetchChangelog } = useChangelog(app?.id);

  // Group feedback by version and sort versions
  const groupedChangelog = useMemo(() => {
    if (!changelog || changelog.length === 0) return [];
    
    const groups = new Map<string, FeedbackItem[]>();
    
    changelog.forEach((item) => {
      if (!item.version) return;
      const version = item.version;
      if (!groups.has(version)) {
        groups.set(version, []);
      }
      groups.get(version)!.push(item);
    });
    
    // Sort versions newest first using semantic versioning
    const sortedVersions = Array.from(groups.keys()).sort(compareVersions);
    
    return sortedVersions.map((version) => ({
      version,
      items: groups.get(version)!,
    }));
  }, [changelog]);

  const isAppPaused = appFetchStatus === 'paused';
  const isChangelogPaused = changelogFetchStatus === 'paused';

  // Loading state
  if (appLoading && !app) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-12 w-64 mb-8" />
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Offline state
  if (isAppPaused && !app) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="max-w-4xl mx-auto">
            <OfflineState onRetry={() => refetchApp()} />
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (appError && !app) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="max-w-4xl mx-auto">
            <QueryErrorState error={appError as Error} onRetry={() => refetchApp()} />
          </div>
        </main>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="text-center">
            <p className="text-muted-foreground">App not found</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back link & Header */}
          <div className="mb-8 animate-fade-in">
            <Link
              to={`/app/${slug}`}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back')}
            </Link>
            
            <div className="flex items-center gap-4">
              {app.logo_url ? (
                <img 
                  src={app.logo_url} 
                  alt={app.name}
                  className="w-12 h-12 rounded-xl object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                  <span className="text-2xl font-bold text-primary">
                    {app.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {t('changelog')} - {app.name}
                </h1>
              </div>
            </div>
          </div>

          {/* Changelog content */}
          <div className="space-y-6">
            {isChangelogPaused ? (
              <OfflineState onRetry={() => refetchChangelog()} />
            ) : changelogError ? (
              <QueryErrorState error={changelogError as Error} onRetry={() => refetchChangelog()} />
            ) : changelogLoading ? (
              [1, 2].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))
            ) : groupedChangelog.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  {t('noVersionedItems')}
                </p>
              </div>
            ) : (
              groupedChangelog.map(({ version, items }, index) => (
                <Card key={version} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-primary font-mono">v{version.replace(/^v/, '')}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {items.map((item) => (
                        <li key={item.id}>
                          <Link 
                            to={`/app/${slug}/${item.id}`}
                            className="flex items-start gap-3 group hover:bg-muted/50 -mx-2 px-2 py-2 rounded-md transition-colors"
                          >
                            {item.type === 'feature' ? (
                              <Badge variant="feature" className="mt-0.5 shrink-0">
                                <Lightbulb className="h-3 w-3 mr-1" />
                                {t('feature')}
                              </Badge>
                            ) : (
                              <Badge variant="bug" className="mt-0.5 shrink-0">
                                <Bug className="h-3 w-3 mr-1" />
                                {t('bug')}
                              </Badge>
                            )}
                            <span className="text-foreground group-hover:text-primary transition-colors">
                              {item.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
