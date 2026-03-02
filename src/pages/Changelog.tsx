import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Bug, Calendar, Pencil, Check, X, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Header } from '@/components/Header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { OfflineState } from '@/components/OfflineState';
import { QueryErrorState } from '@/components/QueryErrorState';
import { useTranslation } from '@/hooks/useTranslation';
import { useApp as useAppData } from '@/hooks/useApps';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteReleaseGroup, useReleaseGroups, useUpsertReleasePlatformStatus } from '@/hooks/useReleases';
import { normalizePlatformLabel } from '@/lib/platforms';
import { cn } from '@/lib/utils';

export default function Changelog() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const {
    data: app,
    isLoading: appLoading,
    error: appError,
    fetchStatus: appFetchStatus,
    refetch: refetchApp,
  } = useAppData(slug);

  const {
    data: releaseGroups,
    isLoading: changelogLoading,
    error: changelogError,
    fetchStatus: changelogFetchStatus,
    refetch: refetchChangelog,
  } = useReleaseGroups(app?.id);

  const upsertReleasePlatformStatus = useUpsertReleasePlatformStatus();
  const deleteReleaseGroup = useDeleteReleaseGroup();
  const [editingPlatformKey, setEditingPlatformKey] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);

  const handleEditStart = (releaseGroupId: string, platform: string, releasedAt: string | null) => {
    setEditingPlatformKey(`${releaseGroupId}:${platform}`);
    setEditDate(releasedAt ? parseISO(releasedAt) : undefined);
  };

  const handleEditCancel = () => {
    setEditingPlatformKey(null);
    setEditDate(undefined);
  };

  const isAppPaused = appFetchStatus === 'paused';
  const isChangelogPaused = changelogFetchStatus === 'paused';

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
                  <span className="text-2xl font-bold text-primary">{app.name.charAt(0)}</span>
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {t('changelog')} - {app.name}
                </h1>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {isChangelogPaused ? (
              <OfflineState onRetry={() => refetchChangelog()} />
            ) : changelogError ? (
              <QueryErrorState error={changelogError as Error} onRetry={() => refetchChangelog()} />
            ) : changelogLoading ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-48 w-full" />)
            ) : !releaseGroups || releaseGroups.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">{t('noVersionedItems')}</p>
              </div>
            ) : (
              releaseGroups.map((group, index) => (
                <Card key={group.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-primary font-mono">v{group.semver.replace(/^v/, '')}</span>
                      </CardTitle>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deleteReleaseGroup.isPending}
                          onClick={async () => {
                            if (!app) return;
                            const confirmed = window.confirm(`${t('confirmDelete')} v${group.semver}?`);
                            if (!confirmed) return;
                            await deleteReleaseGroup.mutateAsync({ releaseGroupId: group.id, appId: app.id });
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('delete')}
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {group.platforms.map((platformRow) => {
                        const isReleased = platformRow.status === 'released';
                        const platformKey = `${group.id}:${platformRow.platform}`;
                        const isEditing = editingPlatformKey === platformKey;

                        return (
                          <div
                            key={`${group.id}-${platformRow.platform}`}
                            className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1"
                          >
                            <Badge variant="secondary" className="text-xs">
                              {normalizePlatformLabel(platformRow.platform)} v{platformRow.version.replace(/^v/, '')}
                            </Badge>
                            <Badge variant={isReleased ? 'completed' : 'planned'} className="text-xs">
                              {isReleased ? t('released') : t('unreleased')}
                            </Badge>
                            {isReleased && platformRow.released_at && (
                              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(parseISO(platformRow.released_at), 'MMMM d, yyyy')}
                              </span>
                            )}
                            {isAdmin && !isEditing && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleEditStart(group.id, platformRow.platform, platformRow.released_at)}
                              >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                {t('setReleaseDate')}
                              </Button>
                            )}
                            {isAdmin && isEditing && (
                              <>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={cn(
                                        'h-7 px-2 text-xs justify-start text-left font-normal',
                                        !editDate && 'text-muted-foreground'
                                      )}
                                    >
                                      <Calendar className="h-3.5 w-3.5 mr-1" />
                                      {editDate ? format(editDate, 'PPP') : t('setReleaseDate')}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      mode="single"
                                      selected={editDate}
                                      onSelect={setEditDate}
                                      initialFocus
                                      className={cn('p-3 pointer-events-auto')}
                                    />
                                  </PopoverContent>
                                </Popover>
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={!editDate || upsertReleasePlatformStatus.isPending}
                                  onClick={() => {
                                    if (!editDate) return;
                                    upsertReleasePlatformStatus.mutate(
                                      {
                                        releaseGroupId: group.id,
                                        platform: platformRow.platform,
                                        version: platformRow.version,
                                        status: 'released',
                                        releasedAt: format(editDate, 'yyyy-MM-dd'),
                                      },
                                      { onSuccess: handleEditCancel }
                                    );
                                  }}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  {t('save')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  disabled={upsertReleasePlatformStatus.isPending}
                                  onClick={() => {
                                    upsertReleasePlatformStatus.mutate(
                                      {
                                        releaseGroupId: group.id,
                                        platform: platformRow.platform,
                                        version: platformRow.version,
                                        status: 'planned',
                                        releasedAt: null,
                                      },
                                      { onSuccess: handleEditCancel }
                                    );
                                  }}
                                >
                                  {t('markAsUnreleased')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  disabled={upsertReleasePlatformStatus.isPending}
                                  onClick={handleEditCancel}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {group.items.map(({ feedback, target_platform }) => {
                        const getStatusLabel = (status: string) => {
                          switch (status) {
                            case 'planned':
                              return t('statusPlanned');
                            case 'progress':
                              return t('statusProgress');
                            case 'completed':
                              return t('statusCompleted');
                            case 'wont_do':
                              return t('statusWontDo');
                            default:
                              return t('statusOpen');
                          }
                        };

                        return (
                          <li key={`${group.id}-${feedback.id}-${target_platform}`}>
                            <Link
                              to={`/app/${slug}/${feedback.id}`}
                              className="flex flex-col gap-2 group hover:bg-muted/50 -mx-2 px-2 py-2 rounded-md transition-colors"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                {feedback.type === 'feature' ? (
                                  <Badge variant="feature" className="shrink-0">
                                    <Lightbulb className="h-3 w-3 mr-1" />
                                    {t('feature')}
                                  </Badge>
                                ) : (
                                  <Badge variant="bug" className="shrink-0">
                                    <Bug className="h-3 w-3 mr-1" />
                                    {t('bug')}
                                  </Badge>
                                )}
                                <Badge
                                  variant={feedback.status as 'open' | 'planned' | 'progress' | 'completed' | 'wont_do'}
                                  className="shrink-0"
                                >
                                  {getStatusLabel(feedback.status)}
                                </Badge>
                                <Badge variant="secondary" className="shrink-0">
                                  {normalizePlatformLabel(target_platform)}
                                </Badge>
                              </div>
                              <span className="text-foreground group-hover:text-primary transition-colors">
                                {feedback.title}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
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
