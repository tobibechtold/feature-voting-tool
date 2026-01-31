import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { App } from '@/types';

export function useApps() {
  return useQuery({
    queryKey: ['apps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[useApps] Error:', error);
        throw error;
      }
      return (data || []) as App[];
    },
  });
}

export function useApp(slug: string | undefined) {
  return useQuery({
    queryKey: ['apps', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('apps')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      
      if (error) throw error;
      return data as App | null;
    },
    enabled: !!slug,
  });
}

export function useCreateApp() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (app: { name: string; slug: string; description: string | null; logo_url?: string | null }) => {
      const { data, error } = await supabase
        .from('apps')
        .insert(app as never)
        .select()
        .single();
      
      if (error) throw error;
      return data as App;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}

export function useUpdateApp() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; slug?: string; description?: string | null; logo_url?: string | null }) => {
      const { data, error } = await supabase
        .from('apps')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as App;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}

export function useDeleteApp() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Try RPC first (atomic cascade delete)
      const { error: rpcError } = await (supabase.rpc as Function)('delete_app_cascade', {
        p_app_id: id,
      });

      if (!rpcError) {
        return;
      }

      // Fallback: manual cascade delete
      console.warn('delete_app_cascade RPC not available, using fallback:', rpcError.message);

      // Get all feedback IDs for this app
      const { data: feedbackItems } = await supabase
        .from('feedback')
        .select('id')
        .eq('app_id', id);

      if (feedbackItems && feedbackItems.length > 0) {
        const feedbackIds = (feedbackItems as Array<{ id: string }>).map((f) => f.id);

        // Delete all votes for these feedback items
        await supabase
          .from('votes')
          .delete()
          .in('feedback_id', feedbackIds);

        // Delete all comments for these feedback items
        await supabase
          .from('comments')
          .delete()
          .in('feedback_id', feedbackIds);

        // Delete all feedback items
        await supabase
          .from('feedback')
          .delete()
          .eq('app_id', id);
      }

      // Finally delete the app
      const { error } = await supabase
        .from('apps')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}
