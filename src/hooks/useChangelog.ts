import { useQuery } from '@tanstack/react-query';
import { publicSupabase } from '@/integrations/supabase/client';
import { FeedbackItem } from '@/types';

export function useChangelog(appId: string | undefined) {
  return useQuery({
    queryKey: ['changelog', appId],
    queryFn: async () => {
      if (!appId) return [];
      
      const { data, error } = await publicSupabase
        .from('feedback')
        .select('*')
        .eq('app_id', appId)
        .not('version', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as FeedbackItem[];
    },
    enabled: !!appId,
  });
}

export function compareVersions(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const parts = v.replace(/^v/, '').split('.').map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
  };
  
  const vA = parseVersion(a);
  const vB = parseVersion(b);
  
  if (vA.major !== vB.major) return vB.major - vA.major;
  if (vA.minor !== vB.minor) return vB.minor - vA.minor;
  return vB.patch - vA.patch;
}
