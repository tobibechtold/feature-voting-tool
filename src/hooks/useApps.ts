import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { App } from '@/types';
import { getCachedData, setCachedData, createTimeoutSignal, TimeoutError } from '@/lib/queryCache';

const APPS_CACHE_KEY = 'apps';
const REQUEST_TIMEOUT = 10000; // 10 seconds

export function useApps() {
  // Get cached data for instant display on reload
  const cached = getCachedData<App[]>(APPS_CACHE_KEY);
  
  return useQuery({
    queryKey: ['apps'],
    queryFn: async () => {
      const { signal, cleanup } = createTimeoutSignal(REQUEST_TIMEOUT);
      
      try {
        const { data, error } = await supabase
          .from('apps')
          .select('*')
          .order('created_at', { ascending: false })
          .abortSignal(signal);
        
        cleanup();
        
        if (error) {
          console.error('[useApps] Error:', error);
          throw error;
        }
        
        const apps = (data || []) as App[];
        
        // Cache successful response for future reloads
        setCachedData(APPS_CACHE_KEY, apps);
        
        return apps;
      } catch (err) {
        cleanup();
        if (signal.aborted) {
          throw new TimeoutError();
        }
        throw err;
      }
    },
    // Use cached data as initialData for instant display
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.updatedAt,
  });
}

export function useApp(slug: string | undefined) {
  return useQuery({
    queryKey: ['apps', slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const { signal, cleanup } = createTimeoutSignal(REQUEST_TIMEOUT);
      
      try {
        // Build query with abort signal before maybeSingle()
        const query = supabase
          .from('apps')
          .select('*')
          .eq('slug', slug)
          .abortSignal(signal);
        
        const { data, error } = await query.maybeSingle();
        
        cleanup();
        
        if (error) throw error;
        return data as App | null;
      } catch (err) {
        cleanup();
        if (signal.aborted) {
          throw new TimeoutError();
        }
        throw err;
      }
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
