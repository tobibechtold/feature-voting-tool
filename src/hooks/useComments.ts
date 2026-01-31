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
      }
      
      return commentData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comments', data.feedback_id] });
    },
  });
}
