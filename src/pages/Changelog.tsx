import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Bug, Pencil, Calendar, X, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Header } from '@/components/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { OfflineState } from '@/components/OfflineState';
import { QueryErrorState } from '@/components/QueryErrorState';
import { useTranslation } from '@/hooks/useTranslation';
import { useApp as useAppData } from '@/hooks/useApps';
import { useChangelog, compareVersions } from '@/hooks/useChangelog';
import { useVersionReleases, useUpsertVersionRelease } from '@/hooks/useVersionReleases';
import { useAuth } from '@/hooks/useAuth';
import { FeedbackItem, VersionRelease } from '@/types';
import { cn } from '@/lib/utils';

export default function Changelog() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  
  const { data: app, isLoading: appLoading, error: appError, fetchStatus: appFetchStatus, refetch: refetchApp } = useAppData(slug);
  const { data: changelog, isLoading: changelogLoading, error: changelogError, fetchStatus: changelogFetchStatus, refetch: refetchChangelog } = useChangelog(app?.id);
  const { data: versionReleases } = useVersionReleases(app?.id);
  const upsertRelease = useUpsertVersionRelease();

  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [isUnreleased, setIsUnreleased] = useState(false);

  // Create a map of version -> release info
  const releaseMap = useMemo(() => {
    const map = new Map<string, VersionRelease>();
    versionReleases?.forEach((release) => {
      map.set(release.version, release);
    });
    return map;
  }, [versionReleases]);

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

  const handleEditClick = (version: string) => {
    const release = releaseMap.get(version);
    setEditingVersion(version);
    if (release?.released_at) {
      setEditDate(parseISO(release.released_at));
      setIsUnreleased(false);
    } else {
      setEditDate(undefined);
      setIsUnreleased(true);
    }
  };

  const handleSave = async () => {
    if (!editingVersion || !app?.id) return;
    
    await upsertRelease.mutateAsync({
      appId: app.id,
      version: editingVersion,
      releasedAt: isUnreleased ? null : (editDate ? format(editDate, 'yyyy-MM-dd') : null),
    });
    
    setEditingVersion(null);
    setEditDate(undefined);
    setIsUnreleased(false);
  };

  const handleCancel = () => {
    setEditingVersion(null);
    setEditDate(undefined);
    setIsUnreleased(false);
  };

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
              groupedChangelog.map(({ version, items }, index) => {
                const release = releaseMap.get(version);
                const isEditing = editingVersion === version;
                
                return (
                  <Card key={version} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <span className="text-primary font-mono">v{version.replace(/^v/, '')}</span>
                          </CardTitle>
                          
                          {isEditing ? (
                            <div className="space-y-3 pt-2">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`unreleased-${version}`}
                                    checked={isUnreleased}
                                    onCheckedChange={(checked) => {
                                      setIsUnreleased(checked === true);
                                      if (checked) setEditDate(undefined);
                                    }}
                                  />
                                  <Label 
                                    htmlFor={`unreleased-${version}`}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {t('markAsUnreleased')}
                                  </Label>
                                </div>
                              </div>
                              
                              {!isUnreleased && (
                                <div className="flex items-center gap-2">
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className={cn(
                                          "justify-start text-left font-normal",
                                          !editDate && "text-muted-foreground"
                                        )}
                                      >
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {editDate ? format(editDate, 'PPP') : t('setReleaseDate')}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <CalendarComponent
                                        mode="single"
                                        selected={editDate}
                                        onSelect={setEditDate}
                                        initialFocus
                                        className={cn("p-3 pointer-events-auto")}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleSave}
                                  disabled={upsertRelease.isPending}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  {t('save')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancel}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  {t('cancel')}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {release?.released_at ? (
                                <>
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>{t('released')}: {format(parseISO(release.released_at), 'MMMM d, yyyy')}</span>
                                </>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  {t('unreleased')}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {isAdmin && !isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(version)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
