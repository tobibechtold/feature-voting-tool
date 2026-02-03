import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, publicSupabase } from '@/integrations/supabase/client';
import { VersionRelease } from '@/types';

export function useVersionReleases(appId: string | undefined) {
  return useQuery({
    queryKey: ['version-releases', appId],
    queryFn: async () => {
      if (!appId) return [];
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (publicSupabase as any)
        .from('version_releases')
        .select('*')
        .eq('app_id', appId);
      
      if (error) throw error;
      return (data || []) as VersionRelease[];
    },
    enabled: !!appId,
  });
}

export function useUpsertVersionRelease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      appId, 
      version, 
      releasedAt 
    }: { 
      appId: string; 
      version: string; 
      releasedAt: string | null;
    }) => {
      // First check if the record exists
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('version_releases')
        .select('id')
        .eq('app_id', appId)
        .eq('version', version)
        .maybeSingle();
      
      if (existing) {
        // Update existing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('version_releases')
          .update({ released_at: releasedAt })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data as VersionRelease;
      } else {
        // Insert new
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('version_releases')
          .insert({ 
            app_id: appId, 
            version, 
            released_at: releasedAt 
          })
          .select()
          .single();
        
        if (error) throw error;
        return data as VersionRelease;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['version-releases', variables.appId] });
    },
  });
}
