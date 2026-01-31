import { QueryClient } from '@tanstack/react-query';
import { TimeoutError } from '@/lib/queryCache';

// Create a singleton QueryClient that persists across HMR
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        gcTime: 1000 * 60 * 10, // Keep cache for 10 minutes
        // Don't retry TimeoutError - it means Supabase is hanging
        retry: (failureCount, error) => {
          if (error instanceof TimeoutError) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}

// In development, persist QueryClient across HMR updates
declare global {
  // eslint-disable-next-line no-var
  var __queryClient: QueryClient | undefined;
}

export const queryClient =
  typeof window !== 'undefined' && import.meta.env.DEV
    ? (globalThis.__queryClient ??= createQueryClient())
    : createQueryClient();
