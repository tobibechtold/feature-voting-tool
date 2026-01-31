import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, publicSupabase } from '@/integrations/supabase/client';
import { Comment } from '@/types';
import { promiseWithTimeout, TimeoutError } from '@/lib/queryCache';

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

export function useCreateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (comment: { feedback_id: string; content: string; is_admin: boolean }) => {
      const { data, error } = await supabase
        .from('comments')
        .insert(comment as never)
        .select()
        .single();
      
      if (error) throw error;
      return data as Comment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['comments', data.feedback_id] });
    },
  });
}
