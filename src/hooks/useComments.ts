import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Comment } from '@/types';

export function useComments(feedbackId: string | undefined) {
  return useQuery({
    queryKey: ['comments', feedbackId],
    queryFn: async () => {
      if (!feedbackId) return [];
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as Comment[];
    },
    enabled: !!feedbackId,
  });
}

export function useCommentCount(feedbackId: string) {
  return useQuery({
    queryKey: ['comments', feedbackId, 'count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('feedback_id', feedbackId);
      
      if (error) throw error;
      return count || 0;
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
