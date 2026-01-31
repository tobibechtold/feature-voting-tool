import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, User, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/Header';
import { VoteButton } from '@/components/VoteButton';
import { StatusSelect } from '@/components/StatusSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/useTranslation';
import { useApp } from '@/contexts/AppContext';
import { mockApps, mockFeedback, mockComments, getVotedItems, addVotedItem } from '@/lib/mockData';
import { FeedbackItem, FeedbackStatus, Comment } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

export default function FeedbackDetail() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const { t, language } = useTranslation();
  const { isAdmin } = useApp();
  
  const [feedback, setFeedback] = useState<FeedbackItem[]>(mockFeedback);
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [votedItems, setVotedItems] = useState<Set<string>>(getVotedItems);
  const [newComment, setNewComment] = useState('');

  const app = mockApps.find((a) => a.slug === slug);
  const item = feedback.find((f) => f.id === id);

  const itemComments = comments
    .filter((c) => c.feedback_id === id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const dateLocale = language === 'de' ? de : enUS;

  const handleVote = () => {
    if (!item || votedItems.has(item.id)) return;
    
    setFeedback((prev) =>
      prev.map((f) =>
        f.id === item.id ? { ...f, vote_count: f.vote_count + 1 } : f
      )
    );
    setVotedItems((prev) => new Set([...prev, item.id]));
    addVotedItem(item.id);
  };

  const handleStatusChange = (status: FeedbackStatus) => {
    if (!item) return;
    setFeedback((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, status } : f))
    );
  };

  const handleAddComment = () => {
    if (!item || !newComment.trim()) return;
    
    const comment: Comment = {
      id: String(Date.now()),
      feedback_id: item.id,
      content: newComment.trim(),
      is_admin: isAdmin,
      created_at: new Date().toISOString(),
    };
    
    setComments((prev) => [...prev, comment]);
    setNewComment('');
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

  const currentItem = feedback.find((f) => f.id === id)!;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <Link
            to={`/app/${slug}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')} to {app.name}
          </Link>

          {/* Main content */}
          <div className="animate-fade-in">
            <Card>
              <CardContent className="p-6">
                <div className="flex gap-6">
                  <VoteButton
                    count={currentItem.vote_count}
                    voted={votedItems.has(currentItem.id)}
                    onVote={handleVote}
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant={currentItem.type === 'feature' ? 'feature' : 'bug'}>
                        {currentItem.type === 'feature' ? t('feature') : t('bug')}
                      </Badge>
                      
                      {isAdmin ? (
                        <StatusSelect
                          value={currentItem.status}
                          onValueChange={handleStatusChange}
                        />
                      ) : (
                        <Badge variant={currentItem.status as any}>
                          {getStatusLabel(currentItem.status)}
                        </Badge>
                      )}
                    </div>
                    
                    <h1 className="text-2xl font-bold mb-4">{currentItem.title}</h1>
                    
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {currentItem.description}
                    </p>
                    
                    <p className="text-sm text-muted-foreground mt-4">
                      {formatDistanceToNow(new Date(currentItem.created_at), {
                        addSuffix: true,
                        locale: dateLocale,
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comments section */}
          <div className="mt-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h2 className="text-xl font-semibold mb-4">
              {t('comments')} ({itemComments.length})
            </h2>
            
            <div className="space-y-4">
              {itemComments.map((comment) => (
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
              ))}
              
              {itemComments.length === 0 && (
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
                    disabled={!newComment.trim()}
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
    </div>
  );
}
