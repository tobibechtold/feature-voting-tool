import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Bug, Filter, RefreshCw, FileText } from 'lucide-react';
import { Header } from '@/components/Header';
import { FeedbackCard } from '@/components/FeedbackCard';
import { CreateFeedbackDialog } from '@/components/CreateFeedbackDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { OfflineState } from '@/components/OfflineState';
import { QueryErrorState } from '@/components/QueryErrorState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/useTranslation';
import { useApp as useAppData } from '@/hooks/useApps';
import { useFeedback, useVotedItems, useVote, useCreateFeedback } from '@/hooks/useFeedback';

import { FeedbackType, FeedbackStatus } from '@/types';

type FilterType = 'all' | 'feature' | 'bug';

export default function AppFeedback() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  
  const { data: app, isLoading: appLoading, error: appError, fetchStatus: appFetchStatus, refetch: refetchApp, isRefetching: isRefetchingApp } = useAppData(slug);
  const { data: feedback, isLoading: feedbackLoading, error: feedbackError, fetchStatus: feedbackFetchStatus, refetch: refetchFeedback, isRefetching: isRefetchingFeedback, isFetching: isFeedbackFetching } = useFeedback(app?.id);
  const { data: votedItems } = useVotedItems();
  const vote = useVote();
  const createFeedback = useCreateFeedback();
  
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<FeedbackType>('feature');

  const filteredFeedback = useMemo(() => {
    if (!feedback) return [];
    
    let items = [...feedback];
    
    if (filterType !== 'all') {
      items = items.filter((f) => f.type === filterType);
    }
    
    if (filterStatus.length > 0) {
      items = items.filter((f) => filterStatus.includes(f.status));
    }
    
    // Sort: non-completed/wont_do first (by votes), then completed/wont_do (by votes)
    items.sort((a, b) => {
      const aFinished = a.status === 'completed' || a.status === 'wont_do';
      const bFinished = b.status === 'completed' || b.status === 'wont_do';
      
      if (aFinished !== bFinished) {
        return aFinished ? 1 : -1; // Completed/wont_do at bottom
      }
      return b.vote_count - a.vote_count; // Within group, sort by votes
    });
    
    return items;
  }, [feedback, filterType, filterStatus]);

  const handleVote = (id: string) => {
    if (votedItems?.has(id)) return;
    vote.mutate(id);
  };

  const handleCreateFeedback = async (data: { 
    title: string; 
    description: string; 
    type: FeedbackType;
    email?: string;
    notifyOnUpdates?: boolean;
    screenshots?: File[];
  }) => {
    if (!app) return;
    await createFeedback.mutateAsync({
      app_id: app.id,
      type: data.type,
      title: data.title,
      description: data.description,
      submitter_email: data.email,
      notify_on_updates: data.notifyOnUpdates,
      appName: app.name,
      appSlug: app.slug,
      screenshots: data.screenshots,
    });
  };

  const openCreateDialog = (type: FeedbackType) => {
    setCreateType(type);
    setCreateDialogOpen(true);
  };

  const toggleStatusFilter = (status: FeedbackStatus) => {
    setFilterStatus((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  // Check for offline/paused state
  const isAppPaused = appFetchStatus === 'paused';
  const isFeedbackPaused = feedbackFetchStatus === 'paused';
  const hasFeedbackData = feedback && feedback.length > 0;
  const showFeedbackSkeleton = feedbackLoading && !hasFeedbackData;

  // Only show full-page skeleton when loading AND no cached data
  if (appLoading && !app) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-8 w-32 mb-4" />
            <Skeleton className="h-12 w-64 mb-2" />
            <Skeleton className="h-6 w-96 mb-8" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show offline state for app loading
  if (isAppPaused && !app) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="max-w-4xl mx-auto">
            <OfflineState onRetry={() => refetchApp()} isRetrying={isRefetchingApp} />
          </div>
        </main>
      </div>
    );
  }

  // Show error state for app loading
  if (appError && !app) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="max-w-4xl mx-auto">
            <QueryErrorState error={appError as Error} onRetry={() => refetchApp()} isRetrying={isRefetchingApp} />
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
            <Button asChild className="mt-4">
              <Link to="/">{t('back')}</Link>
            </Button>
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
              to="/"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back')}
            </Link>
            
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                {app.logo_url ? (
                  <img 
                    src={app.logo_url} 
                    alt={app.name}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                    <span className="text-3xl font-bold text-primary">
                      {app.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">
                    {app.name}
                  </h1>
                  {app.description && (
                    <p className="text-muted-foreground">{app.description}</p>
                  )}
                </div>
              </div>
              
              {/* Buttons - stack on mobile, row on desktop */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" asChild className="w-full sm:w-auto">
                  <Link to={`/app/${slug}/changelog`}>
                    <FileText className="h-4 w-4 mr-2" />
                    {t('changelog')}
                  </Link>
                </Button>
                <Button variant="feature" onClick={() => openCreateDialog('feature')} className="w-full sm:w-auto">
                  <Lightbulb className="h-4 w-4 mr-2" />
                  {t('createFeature')}
                </Button>
                <Button variant="bug" onClick={() => openCreateDialog('bug')} className="w-full sm:w-auto">
                  <Bug className="h-4 w-4 mr-2" />
                  {t('createBug')}
                </Button>
              </div>
            </div>
          </div>

          {/* Welcoming message */}
          <p className="text-muted-foreground mb-6 animate-fade-in" style={{ animationDelay: '50ms' }}>
            {t('feedbackWelcomeMessage')}
          </p>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <Tabs value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
              <TabsList>
                <TabsTrigger value="all">{t('all')}</TabsTrigger>
                <TabsTrigger value="feature">{t('features')}</TabsTrigger>
                <TabsTrigger value="bug">{t('bugs')}</TabsTrigger>
              </TabsList>
            </Tabs>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Status
                  {filterStatus.length > 0 && (
                    <span className="ml-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                      {filterStatus.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuCheckboxItem
                  checked={filterStatus.includes('open')}
                  onCheckedChange={() => toggleStatusFilter('open')}
                >
                  {t('statusOpen')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filterStatus.includes('planned')}
                  onCheckedChange={() => toggleStatusFilter('planned')}
                >
                  {t('statusPlanned')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filterStatus.includes('progress')}
                  onCheckedChange={() => toggleStatusFilter('progress')}
                >
                  {t('statusProgress')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filterStatus.includes('completed')}
                  onCheckedChange={() => toggleStatusFilter('completed')}
                >
                  {t('statusCompleted')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filterStatus.includes('wont_do')}
                  onCheckedChange={() => toggleStatusFilter('wont_do')}
                >
                  {t('statusWontDo')}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Show refresh indicator when fetching with existing data */}
          {isFeedbackFetching && hasFeedbackData && (
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Refreshing...</span>
            </div>
          )}

          {/* Feedback List */}
          <div className="space-y-4">
            {isFeedbackPaused && !hasFeedbackData ? (
              <OfflineState onRetry={() => refetchFeedback()} isRetrying={isRefetchingFeedback} />
            ) : feedbackError && !hasFeedbackData ? (
              <QueryErrorState error={feedbackError as Error} onRetry={() => refetchFeedback()} isRetrying={isRefetchingFeedback} />
            ) : showFeedbackSkeleton ? (
              [1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : filteredFeedback.length > 0 ? (
              filteredFeedback.map((item, index) => (
                <div
                  key={item.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${(index + 2) * 50}ms` }}
                >
                  <FeedbackCard
                    item={item}
                    appSlug={slug!}
                    voted={votedItems?.has(item.id) || false}
                    onVote={handleVote}
                  />
                </div>
              ))
            ) : !feedbackLoading ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  No feedback yet. Be the first to submit!
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <CreateFeedbackDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        type={createType}
        onSubmit={handleCreateFeedback}
      />
    </div>
  );
}
