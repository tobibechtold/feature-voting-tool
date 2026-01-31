import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FeedbackItem, FeedbackStatus, FeedbackType } from '@/types';
import { getVoterId } from '@/lib/mockData';

export function useFeedback(appId: string | undefined) {
  return useQuery({
    queryKey: ['feedback', appId],
    queryFn: async () => {
      if (!appId) return [];
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('app_id', appId)
        .order('vote_count', { ascending: false });
      
      if (error) throw error;
      return (data || []) as FeedbackItem[];
    },
    enabled: !!appId,
  });
}

export function useFeedbackItem(id: string | undefined) {
  return useQuery({
    queryKey: ['feedback', 'item', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data as FeedbackItem | null;
    },
    enabled: !!id,
  });
}

export function useCreateFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (feedback: { app_id: string; type: FeedbackType; title: string; description: string }) => {
      const insertData = { ...feedback, vote_count: 1 };
      
      const { data, error } = await supabase
        .from('feedback')
        .insert(insertData as never)
        .select()
        .single();
      
      if (error) throw error;
      
      const feedbackData = data as FeedbackItem;

      // Record the vote
      const voterId = getVoterId();
      await supabase
        .from('votes')
        .insert({ feedback_id: feedbackData.id, voter_id: voterId } as never);

      return feedbackData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['feedback', data.app_id] });
    },
  });
}

export function useUpdateFeedbackStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FeedbackStatus }) => {
      const { data, error } = await supabase
        .from('feedback')
        .update({ status } as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as FeedbackItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useVotedItems() {
  const voterId = getVoterId();
  
  return useQuery({
    queryKey: ['votes', voterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('votes')
        .select('feedback_id')
        .eq('voter_id', voterId);
      
      if (error) throw error;
      const votes = (data || []) as Array<{ feedback_id: string }>;
      return new Set(votes.map((v) => v.feedback_id));
    },
  });
}

export function useVote() {
  const queryClient = useQueryClient();
  const voterId = getVoterId();
  
  return useMutation({
    mutationFn: async (feedbackId: string) => {
      // Check if already voted (fresh DB validation)
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('feedback_id', feedbackId)
        .eq('voter_id', voterId)
        .maybeSingle();

      if (existingVote) {
        // Already voted - skip silently (not an error)
        return;
      }

      // Insert vote
      const { error: voteError } = await supabase
        .from('votes')
        .insert({ feedback_id: feedbackId, voter_id: voterId } as never);
      
      if (voteError) throw voteError;

      // Increment vote count
      const { data: feedback, error: fetchError } = await supabase
        .from('feedback')
        .select('vote_count')
        .eq('id', feedbackId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const feedbackData = feedback as { vote_count: number };

      const { error: updateError } = await supabase
        .from('feedback')
        .update({ vote_count: feedbackData.vote_count + 1 } as never)
        .eq('id', feedbackId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['votes'] });
    },
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (feedbackId: string) => {
      // First delete all votes for this feedback
      const { error: votesError } = await supabase
        .from('votes')
        .delete()
        .eq('feedback_id', feedbackId);
      
      if (votesError) throw votesError;

      // Then delete all comments for this feedback
      const { error: commentsError } = await supabase
        .from('comments')
        .delete()
        .eq('feedback_id', feedbackId);
      
      if (commentsError) throw commentsError;

      // Finally delete the feedback
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', feedbackId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['votes'] });
    },
  });
}
