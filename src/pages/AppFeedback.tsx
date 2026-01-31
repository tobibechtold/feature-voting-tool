import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Bug, Filter } from 'lucide-react';
import { Header } from '@/components/Header';
import { FeedbackCard } from '@/components/FeedbackCard';
import { CreateFeedbackDialog } from '@/components/CreateFeedbackDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/useTranslation';
import { mockApps, mockFeedback, mockComments, getVotedItems, addVotedItem } from '@/lib/mockData';
import { FeedbackType, FeedbackStatus, FeedbackItem } from '@/types';

type FilterType = 'all' | 'feature' | 'bug';

export default function AppFeedback() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  
  const [feedback, setFeedback] = useState<FeedbackItem[]>(mockFeedback);
  const [votedItems, setVotedItems] = useState<Set<string>>(getVotedItems);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<FeedbackType>('feature');

  const app = mockApps.find((a) => a.slug === slug);

  const appFeedback = useMemo(() => {
    if (!app) return [];
    
    let items = feedback.filter((f) => f.app_id === app.id);
    
    if (filterType !== 'all') {
      items = items.filter((f) => f.type === filterType);
    }
    
    if (filterStatus.length > 0) {
      items = items.filter((f) => filterStatus.includes(f.status));
    }
    
    // Sort by vote count descending
    return items.sort((a, b) => b.vote_count - a.vote_count);
  }, [app, feedback, filterType, filterStatus]);

  const getCommentCount = (feedbackId: string) => {
    return mockComments.filter((c) => c.feedback_id === feedbackId).length;
  };

  const handleVote = (id: string) => {
    if (votedItems.has(id)) return;
    
    setFeedback((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, vote_count: f.vote_count + 1 } : f
      )
    );
    setVotedItems((prev) => new Set([...prev, id]));
    addVotedItem(id);
  };

  const handleCreateFeedback = (data: { title: string; description: string; type: FeedbackType }) => {
    const newItem: FeedbackItem = {
      id: String(Date.now()),
      app_id: app!.id,
      type: data.type,
      title: data.title,
      description: data.description,
      status: 'open',
      vote_count: 1,
      created_at: new Date().toISOString(),
    };
    setFeedback((prev) => [newItem, ...prev]);
    setVotedItems((prev) => new Set([...prev, newItem.id]));
    addVotedItem(newItem.id);
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
            
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                  {app.name}
                </h1>
                {app.description && (
                  <p className="text-muted-foreground">{app.description}</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button variant="feature" onClick={() => openCreateDialog('feature')}>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  {t('createFeature')}
                </Button>
                <Button variant="bug" onClick={() => openCreateDialog('bug')}>
                  <Bug className="h-4 w-4 mr-2" />
                  {t('createBug')}
                </Button>
              </div>
            </div>
          </div>

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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Feedback List */}
          <div className="space-y-4">
            {appFeedback.map((item, index) => (
              <div
                key={item.id}
                className="animate-fade-in"
                style={{ animationDelay: `${(index + 2) * 50}ms` }}
              >
                <FeedbackCard
                  item={item}
                  appSlug={slug!}
                  voted={votedItems.has(item.id)}
                  onVote={handleVote}
                  commentCount={getCommentCount(item.id)}
                />
              </div>
            ))}
            
            {appFeedback.length === 0 && (
              <div className="text-center py-16">
                <p className="text-muted-foreground">
                  No feedback yet. Be the first to submit!
                </p>
              </div>
            )}
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
