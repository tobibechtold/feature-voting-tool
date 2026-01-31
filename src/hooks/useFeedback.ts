import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, publicSupabase } from '@/integrations/supabase/client';
import { FeedbackItem, FeedbackStatus, FeedbackType } from '@/types';
import { getVoterId } from '@/lib/mockData';
import { getCachedData, setCachedData, promiseWithTimeout, TimeoutError } from '@/lib/queryCache';

const REQUEST_TIMEOUT = 10000; // 10 seconds

export function useFeedback(appId: string | undefined) {
  const cacheKey = `feedback:${appId}`;
  const cached = appId ? getCachedData<FeedbackItem[]>(cacheKey) : null;
  
  return useQuery({
    queryKey: ['feedback', appId],
    queryFn: async () => {
      if (!appId) return [];
      
      const controller = new AbortController();
      
      const fetchFeedback = async () => {
        const { data, error } = await publicSupabase
          .from('feedback')
          .select('*')
          .eq('app_id', appId)
          .order('vote_count', { ascending: false })
          .abortSignal(controller.signal);
        
        if (error) throw error;
        
        const feedback = (data || []) as FeedbackItem[];
        
        // Cache successful response
        setCachedData(cacheKey, feedback);
        
        return feedback;
      };

      return promiseWithTimeout(fetchFeedback(), REQUEST_TIMEOUT, controller);
    },
    enabled: !!appId,
    // Use cached data for instant display
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.updatedAt,
  });
}

export function useFeedbackItem(id: string | undefined) {
  return useQuery({
    queryKey: ['feedback', 'item', id],
    queryFn: async () => {
      if (!id) return null;
      
      const controller = new AbortController();
      
      const fetchItem = async () => {
        const { data, error } = await publicSupabase
          .from('feedback')
          .select('*')
          .eq('id', id)
          .abortSignal(controller.signal)
          .maybeSingle();
        
        if (error) throw error;
        return data as FeedbackItem | null;
      };

      return promiseWithTimeout(fetchItem(), REQUEST_TIMEOUT, controller);
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
      const controller = new AbortController();
      
      const fetchVotes = async () => {
        const { data, error } = await publicSupabase
          .from('votes')
          .select('feedback_id')
          .eq('voter_id', voterId)
          .abortSignal(controller.signal);
        
        if (error) throw error;
        const votes = (data || []) as Array<{ feedback_id: string }>;
        return new Set(votes.map((v) => v.feedback_id));
      };

      return promiseWithTimeout(fetchVotes(), REQUEST_TIMEOUT, controller);
    },
  });
}

export function useVote() {
  const queryClient = useQueryClient();
  const voterId = getVoterId();
  
  return useMutation({
    mutationFn: async (feedbackId: string) => {
      // Try to call the RPC function first (atomic operation)
      const { data: rpcData, error: rpcError } = await (supabase.rpc as Function)('vote_for_feedback', {
        p_feedback_id: feedbackId,
        p_voter_id: voterId,
      });

      // If RPC exists and works, we're done
      if (!rpcError) {
        return rpcData;
      }

      // Fallback: if RPC doesn't exist, use the manual approach
      console.warn('vote_for_feedback RPC not available, using fallback:', rpcError.message);

      // Check if already voted
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('feedback_id', feedbackId)
        .eq('voter_id', voterId)
        .maybeSingle();

      if (existingVote) {
        return { already_voted: true };
      }

      // Insert vote with ON CONFLICT handling via upsert
      const { error: voteError } = await supabase
        .from('votes')
        .upsert(
          { feedback_id: feedbackId, voter_id: voterId } as never,
          { onConflict: 'feedback_id,voter_id', ignoreDuplicates: true }
        );
      
      if (voteError && !voteError.message.includes('duplicate')) {
        throw voteError;
      }

      // Get current count and update (best effort)
      const { data: voteCount } = await supabase
        .from('votes')
        .select('id', { count: 'exact' })
        .eq('feedback_id', feedbackId);
      
      const newCount = voteCount?.length || 0;

      await supabase
        .from('feedback')
        .update({ vote_count: newCount } as never)
        .eq('id', feedbackId);

      return { vote_count: newCount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['votes'] });
    },
    onError: (error) => {
      console.error('Vote error:', error);
    },
  });
}

export function useDeleteFeedback() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (feedbackId: string) => {
      // Try RPC first (atomic cascade delete)
      const { error: rpcError } = await (supabase.rpc as Function)('delete_feedback_cascade', {
        p_feedback_id: feedbackId,
      });

      if (!rpcError) {
        return;
      }

      // Fallback: manual cascade delete
      console.warn('delete_feedback_cascade RPC not available, using fallback:', rpcError.message);

      // Delete in order: votes -> comments -> feedback
      const { error: votesError } = await supabase
        .from('votes')
        .delete()
        .eq('feedback_id', feedbackId);
      
      if (votesError) {
        console.error('Error deleting votes:', votesError);
      }

      const { error: commentsError } = await supabase
        .from('comments')
        .delete()
        .eq('feedback_id', feedbackId);
      
      if (commentsError) {
        console.error('Error deleting comments:', commentsError);
      }

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
