import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ApiToken {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

// Minimal client shape so the standalone functions are testable with mocks,
// mirroring the pattern in useReleases.ts.
type ApiTokensClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc(fn: string, args?: Record<string, unknown>): any;
};

export async function fetchApiTokens(client: ApiTokensClient): Promise<ApiToken[]> {
  const { data, error } = await client
    .from('api_tokens')
    .select('id, name, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApiToken[];
}

export async function createApiToken(client: ApiTokensClient, name: string): Promise<string> {
  const { data, error } = await client.rpc('create_api_token', { p_name: name });
  if (error) throw error;
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Token creation did not return a token');
  }
  return data;
}

export async function revokeApiToken(client: ApiTokensClient, id: string): Promise<void> {
  const { error } = await client
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export function useApiTokens() {
  return useQuery({
    queryKey: ['api-tokens'],
    queryFn: () => fetchApiTokens(supabase),
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createApiToken(supabase, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeApiToken(supabase, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
  });
}
