import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { RoadmapBoard } from '@/components/roadmap/RoadmapBoard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { OfflineState } from '@/components/OfflineState';
import { QueryErrorState } from '@/components/QueryErrorState';
import { useTranslation } from '@/hooks/useTranslation';
import { useApp as useAppData } from '@/hooks/useApps';
import { useAuth } from '@/hooks/useAuth';
import { useFeedback, useMoveFeedbackRoadmapItem } from '@/hooks/useFeedback';
import { type OverviewSortMode } from '@/lib/feedbackOverview';
import { loadRoadmapSortMode, saveRoadmapSortMode } from '@/lib/roadmapPreferences';

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

  const [sortMode, setSortMode] = useState<OverviewSortMode>(() => loadRoadmapSortMode(slug));

  useEffect(() => {
    setSortMode(loadRoadmapSortMode(slug));
  }, [slug]);

  useEffect(() => {
    saveRoadmapSortMode(slug, sortMode);
  }, [slug, sortMode]);

  const isAppPaused = appFetchStatus === 'paused';
  const isFeedbackPaused = feedbackFetchStatus === 'paused';

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
        <div className="mb-8 space-y-4 animate-fade-in">
          <Link
            to={`/app/${slug}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {t('roadmap')} - {app.name}
              </h1>
              <p className="text-muted-foreground">
                {isAdmin ? 'Drag items between lanes or reorder them within a lane.' : 'Public roadmap view.'}
              </p>
            </div>

            <div className="w-full sm:w-[180px]">
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as OverviewSortMode)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('sortBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popularity">{t('sortPopularity')}</SelectItem>
                  <SelectItem value="date">{t('sortDate')}</SelectItem>
                  <SelectItem value="version">{t('sortVersion')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            items={feedback || []}
            appSlug={slug!}
            sortMode={sortMode}
            isAdmin={isAdmin}
            getStatusLabel={(status) => t(getStatusTranslationKey(status))}
            onMoveItem={moveRoadmapItem.mutateAsync}
          />
        )}
      </main>
    </div>
  );
}
