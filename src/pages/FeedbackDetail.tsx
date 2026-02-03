import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, User, ShieldCheck, Trash2, Tag } from 'lucide-react';
import { Header } from '@/components/Header';
import { VoteButton } from '@/components/VoteButton';
import { StatusSelect } from '@/components/StatusSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { OfflineState } from '@/components/OfflineState';
import { QueryErrorState } from '@/components/QueryErrorState';
import { useTranslation } from '@/hooks/useTranslation';
import { useApp } from '@/contexts/AppContext';
import { useApp as useAppData } from '@/hooks/useApps';
import { useFeedbackItem, useVotedItems, useVote, useUpdateFeedbackStatus, useDeleteFeedback, useUpdateFeedbackVersion } from '@/hooks/useFeedback';
import { useComments, useCreateComment } from '@/hooks/useComments';
import { useToast } from '@/hooks/use-toast';
import { FeedbackStatus } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

export default function FeedbackDetail() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { isAdmin } = useApp();
  const { toast } = useToast();
  
  const { data: app, isLoading: appLoading, error: appError, fetchStatus: appFetchStatus, refetch: refetchApp } = useAppData(slug);
  const { data: item, isLoading: itemLoading, error: itemError, fetchStatus: itemFetchStatus, refetch: refetchItem } = useFeedbackItem(id);
  const { data: comments, isLoading: commentsLoading, error: commentsError, fetchStatus: commentsFetchStatus, refetch: refetchComments } = useComments(id);
  const { data: votedItems } = useVotedItems();
  const vote = useVote();
  const updateStatus = useUpdateFeedbackStatus();
  const updateVersion = useUpdateFeedbackVersion();
  const createComment = useCreateComment();
  const deleteFeedback = useDeleteFeedback();
  
  const [newComment, setNewComment] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [versionInput, setVersionInput] = useState('');
  const [isEditingVersion, setIsEditingVersion] = useState(false);

  const dateLocale = language === 'de' ? de : enUS;

  const handleVote = () => {
    if (!item || votedItems?.has(item.id)) return;
    vote.mutate(item.id);
  };

  const handleStatusChange = (status: FeedbackStatus) => {
    if (!item || !app) return;
    updateStatus.mutate({ 
      id: item.id, 
      status,
      appName: app.name,
      appSlug: app.slug,
    });
  };

  const handleAddComment = async () => {
    if (!item || !newComment.trim() || !app) return;
    
    await createComment.mutateAsync({
      feedback_id: item.id,
      content: newComment.trim(),
      is_admin: isAdmin,
      appName: app.name,
      appSlug: app.slug,
    });
    setNewComment('');
  };

  const handleDeleteFeedback = async () => {
    if (!item) return;
    
    try {
      await deleteFeedback.mutateAsync(item.id);
      toast({ title: t('feedbackDeleted') });
      navigate(`/app/${slug}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
    setDeleteDialogOpen(false);
  };

  const getStatusLabel = (status: FeedbackStatus) => {
    switch (status) {
      case 'planned':
        return t('statusPlanned');
      case 'progress':
        return t('statusProgress');
      case 'completed':
        return t('statusCompleted');
      default:
        return t('statusOpen');
    }
  };

  // Determine loading/error states
  const isPaused = appFetchStatus === 'paused' || itemFetchStatus === 'paused';
  const hasError = appError || itemError;
  const isLoadingWithNoData = (appLoading || itemLoading) && !app && !item;

  // Handle offline/paused state
  if (isPaused) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-3xl mx-auto">
            <OfflineState 
              onRetry={() => {
                refetchApp();
                refetchItem();
              }} 
            />
          </div>
        </main>
      </div>
    );
  }

  // Handle error state
  if (hasError && !app && !item) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-3xl mx-auto">
            <QueryErrorState 
              error={appError || itemError} 
              onRetry={() => {
                refetchApp();
                refetchItem();
              }} 
            />
          </div>
        </main>
      </div>
    );
  }

  // Show skeleton only when loading with no data
  if (isLoadingWithNoData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="max-w-3xl mx-auto">
            <Skeleton className="h-8 w-32 mb-6" />
            <Skeleton className="h-64 w-full mb-8" />
            <Skeleton className="h-32 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!app || !item) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-12">
          <div className="text-center">
            <p className="text-muted-foreground">Feedback not found</p>
            <Button asChild className="mt-4">
              <Link to={slug ? `/app/${slug}` : '/'}>{t('back')}</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Determine comments state
  const isCommentsPaused = commentsFetchStatus === 'paused';
  const commentsHasError = commentsError && !comments;
  const commentsShowSkeleton = commentsLoading && !comments;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <div className="flex items-center justify-between mb-6">
            <Link
              to={`/app/${slug}`}
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back')} to {app.name}
            </Link>
            
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('deleteFeedback')}
              </Button>
            )}
          </div>

          {/* Main content */}
          <div className="animate-fade-in">
            <Card>
              <CardContent className="p-6">
                <div className="flex-1 min-w-0">
                  {/* Header row with badges and heart */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={item.type === 'feature' ? 'feature' : 'bug'}>
                        {item.type === 'feature' ? t('feature') : t('bug')}
                      </Badge>
                      
                      {isAdmin ? (
                        <StatusSelect
                          value={item.status}
                          onValueChange={handleStatusChange}
                        />
                      ) : (
                        <Badge variant={item.status as 'open' | 'planned' | 'progress' | 'completed'}>
                          {getStatusLabel(item.status)}
                        </Badge>
                      )}
                    </div>
                    <VoteButton
                      count={item.vote_count}
                      voted={votedItems?.has(item.id) || false}
                      onVote={handleVote}
                      disabled={item.status === 'completed'}
                    />
                  </div>
                    
                    <h1 className="text-2xl font-bold mb-4">{item.title}</h1>
                    
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {item.description}
                    </p>
                    
                    {/* Admin-only: show submitter email if available */}
                    {isAdmin && item.submitter_email && (
                      <div className="mt-4 flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{t('submitterEmail')}:</span>
                        <a 
                          href={`mailto:${item.submitter_email}`}
                          className="text-primary hover:underline"
                        >
                          {item.submitter_email}
                        </a>
                      </div>
                    )}
                    
                    {/* Admin-only: Version assignment */}
                    {isAdmin && (
                      <div className="mt-4 flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        {isEditingVersion ? (
                          <>
                            <Input
                              value={versionInput}
                              onChange={(e) => setVersionInput(e.target.value)}
                              placeholder={t('versionPlaceholder')}
                              className="w-32 h-8"
                            />
                            <Button
                              size="sm"
                              onClick={async () => {
                                await updateVersion.mutateAsync({ 
                                  id: item.id, 
                                  version: versionInput.trim() || null 
                                });
                                setIsEditingVersion(false);
                              }}
                              disabled={updateVersion.isPending}
                            >
                              {t('save')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setVersionInput(item.version || '');
                                setIsEditingVersion(false);
                              }}
                            >
                              {t('cancel')}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setVersionInput(item.version || '');
                              setIsEditingVersion(true);
                            }}
                          >
                            {item.version ? (
                              <>{t('version')}: <span className="font-mono ml-1">{item.version}</span></>
                            ) : (
                              t('setVersion')
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* Show version badge for non-admins if version is set */}
                    {!isAdmin && item.version && (
                      <div className="mt-4 flex items-center gap-2 text-sm">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{t('includedInVersion')}:</span>
                        <span className="font-mono">{item.version}</span>
                      </div>
                    )}
                    
                  <p className="text-sm text-muted-foreground mt-4">
                    {formatDistanceToNow(new Date(item.created_at), {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comments section */}
          <div className="mt-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h2 className="text-xl font-semibold mb-4">
              {t('comments')} ({comments?.length || 0})
            </h2>
            
            <div className="space-y-4">
              {isCommentsPaused ? (
                <OfflineState onRetry={refetchComments} />
              ) : commentsHasError ? (
                <QueryErrorState error={commentsError} onRetry={refetchComments} />
              ) : commentsShowSkeleton ? (
                [1, 2].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))
              ) : (
                comments?.map((comment) => (
                  <Card key={comment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            comment.is_admin
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {comment.is_admin ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">
                              {comment.is_admin ? 'Admin' : 'User'}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.created_at), {
                                addSuffix: true,
                                locale: dateLocale,
                              })}
                            </span>
                          </div>
                          <p className="text-muted-foreground">{comment.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              
              {!commentsLoading && !isCommentsPaused && !commentsHasError && (!comments || comments.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  {t('noComments')}
                </p>
              )}
            </div>

            {/* Add comment - only for admin */}
            {isAdmin && (
              <>
                <Separator className="my-6" />
                
                <div className="space-y-3">
                  <h3 className="font-medium">{t('addComment')}</h3>
                  <Textarea
                    placeholder={t('commentPlaceholder')}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || createComment.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {t('submit')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteFeedback')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDeleteFeedback')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFeedback}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteFeedback.isPending}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
