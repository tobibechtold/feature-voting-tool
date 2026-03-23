import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { AppPageHeader } from '@/components/AppPageHeader';
import { RoadmapBoard } from '@/components/roadmap/RoadmapBoard';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OfflineState } from '@/components/OfflineState';
import { QueryErrorState } from '@/components/QueryErrorState';
import { useTranslation } from '@/hooks/useTranslation';
import { useApp as useAppData } from '@/hooks/useApps';
import { useAuth } from '@/hooks/useAuth';
import { useFeedback, useMoveFeedbackRoadmapItem, useVote, useVotedItems } from '@/hooks/useFeedback';
import { filterFeedbackByVersion, getVersionOptions, type OverviewVersionFilter } from '@/lib/feedbackOverview';

function getStatusTranslationKey(status: 'open' | 'planned' | 'progress' | 'completed' | 'wont_do') {
  switch (status) {
    case 'planned':
      return 'statusPlanned';
    case 'progress':
      return 'statusProgress';
    case 'completed':
      return 'statusCompleted';
    case 'wont_do':
      return 'statusWontDo';
    default:
      return 'statusOpen';
  }
}

export default function Roadmap() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const moveRoadmapItem = useMoveFeedbackRoadmapItem();
  const vote = useVote();
  const { data: votedItems } = useVotedItems();

  const {
    data: app,
    isLoading: appLoading,
    error: appError,
    fetchStatus: appFetchStatus,
    refetch: refetchApp,
  } = useAppData(slug);

  const {
    data: feedback,
    isLoading: feedbackLoading,
    error: feedbackError,
    fetchStatus: feedbackFetchStatus,
    refetch: refetchFeedback,
  } = useFeedback(app?.id);
  const [versionFilter, setVersionFilter] = useState<OverviewVersionFilter>('all');

  const isAppPaused = appFetchStatus === 'paused';
  const isFeedbackPaused = feedbackFetchStatus === 'paused';
  const versionOptions = useMemo(() => getVersionOptions(feedback || []), [feedback]);
  const filteredFeedback = useMemo(
    () => filterFeedbackByVersion(feedback || [], versionFilter),
    [feedback, versionFilter]
  );
  const handleVote = (id: string) => {
    if (votedItems?.has(id)) return;
    vote.mutate(id);
  };

  if (appLoading && !app) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-64 w-full" />
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
          <OfflineState onRetry={() => refetchApp()} />
        </main>
      </div>
    );
  }

  if (appError && !app) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <QueryErrorState error={appError as Error} onRetry={() => refetchApp()} />
        </main>
      </div>
    );
  }

  if (!app) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-8">
        <div className="space-y-4">
          <AppPageHeader
            backTo="/"
            slug={slug!}
            currentPage="roadmap"
            app={app}
            subtitle={isAdmin ? 'Drag items between lanes or reorder them within a lane.' : 'Public roadmap view.'}
          />
          <div className="w-full sm:w-[220px]">
            <Label htmlFor="roadmap-version-filter" className="sr-only">
              {t('filterVersion')}
            </Label>
            <Select value={versionFilter} onValueChange={(value) => setVersionFilter(value as OverviewVersionFilter)}>
              <SelectTrigger id="roadmap-version-filter" aria-label={t('filterVersion')}>
                <SelectValue placeholder={t('filterVersion')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allVersions')}</SelectItem>
                {versionOptions.map((version) => (
                  <SelectItem key={version} value={version}>
                    v{version}
                  </SelectItem>
                ))}
                <SelectItem value="none">{t('noVersion')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isFeedbackPaused && !feedback ? (
          <OfflineState onRetry={() => refetchFeedback()} />
        ) : feedbackError && !feedback ? (
          <QueryErrorState error={feedbackError as Error} onRetry={() => refetchFeedback()} />
        ) : feedbackLoading && !feedback ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-64 w-full" />
            ))}
          </div>
        ) : (
          <RoadmapBoard
            items={filteredFeedback}
            appSlug={slug!}
            isAdmin={isAdmin}
            votedItems={votedItems || new Set()}
            onVote={handleVote}
            getStatusLabel={(status) => t(getStatusTranslationKey(status))}
            onMoveItem={moveRoadmapItem.mutateAsync}
          />
        )}
      </main>
    </div>
  );
}
