import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, publicSupabase } from '@/integrations/supabase/client';
import { Comment, FeedbackItem } from '@/types';
import { promiseWithTimeout } from '@/lib/queryCache';
import { sendNotification } from '@/lib/notificationService';

const REQUEST_TIMEOUT = 10000; // 10 seconds

export function useComments(feedbackId: string | undefined) {
  return useQuery({
    queryKey: ['comments', feedbackId],
    queryFn: async () => {
      if (!feedbackId) return [];
      
      const controller = new AbortController();
      
      const fetchComments = async () => {
        const { data, error } = await publicSupabase
          .from('comments')
          .select('*')
          .eq('feedback_id', feedbackId)
          .order('created_at', { ascending: true })
          .abortSignal(controller.signal);
        
        if (error) throw error;
        return (data || []) as Comment[];
      };

      return promiseWithTimeout(fetchComments(), REQUEST_TIMEOUT, controller);
    },
    enabled: !!feedbackId,
  });
}

export function useCommentCount(feedbackId: string) {
  return useQuery({
    queryKey: ['comments', feedbackId, 'count'],
    queryFn: async () => {
      const controller = new AbortController();
      
      const fetchCount = async () => {
        const { count, error } = await publicSupabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('feedback_id', feedbackId)
          .abortSignal(controller.signal);
        
        if (error) throw error;
        return count || 0;
      };

      return promiseWithTimeout(fetchCount(), REQUEST_TIMEOUT, controller);
    },
  });
}

interface CreateCommentInput {
  feedback_id: string;
  content: string;
  is_admin: boolean;
  appName?: string;
  appSlug?: string;
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      const { appName, appSlug, ...comment } = input;
      
      const { data, error } = await supabase
        .from('comments')
        .insert(comment as never)
        .select()
        .single();
      
      if (error) throw error;
      const commentData = data as Comment;
      
      // If admin commented, send notification to user if they opted in
      if (comment.is_admin && appName && appSlug) {
        // Fetch the feedback to check notification preferences
        const { data: feedbackData } = await publicSupabase
          .from('feedback')
          .select('*')
          .eq('id', comment.feedback_id)
          .single();
        
        const feedback = feedbackData as FeedbackItem | null;
        
        if (feedback?.notify_on_updates && feedback?.submitter_email) {
          sendNotification({
            type: 'admin_comment',
            feedback: {
              id: feedback.id,
              type: feedback.type,
              title: feedback.title,
              submitter_email: feedback.submitter_email,
              notify_on_updates: feedback.notify_on_updates,
            },
            appName,
            appSlug,
            comment: comment.content,
          });
        }
        
        // Also notify user commenters who opted in for replies
        const { data: userComments } = await publicSupabase
          .from('comments')
          .select('commenter_email')
          .eq('feedback_id', comment.feedback_id)
          .eq('is_admin', false)
          .eq('notify_on_reply', true)
          .not('commenter_email', 'is', null);
        
        if (userComments && userComments.length > 0 && feedback) {
          // Get unique emails (excluding the feedback submitter to avoid duplicate)
          const uniqueEmails = [...new Set(
            (userComments as Array<{ commenter_email: string | null }>)
              .map(c => c.commenter_email)
              .filter((email): email is string => 
                email !== null && email !== feedback.submitter_email
              )
          )];
          
          // Send notification to each unique commenter
          for (const email of uniqueEmails) {
            sendNotification({
              type: 'admin_reply_to_comment',
              feedback: {
                id: feedback.id,
                type: feedback.type,
                title: feedback.title,
              },
              appName,
              appSlug,
              comment: comment.content,
              commenterEmail: email,
            });
          }
        }
      }
      
      return commentData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comments', data.feedback_id] });
    },
  });
}

interface CreateUserCommentInput {
  feedback_id: string;
  content: string;
  commenter_email: string;
  notify_on_reply: boolean;
  recaptcha_token: string;
}

export function useCreateUserComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateUserCommentInput) => {
      const response = await fetch(
        'https://REDACTED.supabase.co/functions/v1/verify-comment',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.code === 'CAPTCHA_FAILED' ? 'CAPTCHA_FAILED' : data.error || 'Failed to submit comment');
      }
      
      return data as Comment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comments', data.feedback_id] });
    },
  });
}
