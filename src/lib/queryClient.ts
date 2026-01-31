import { QueryClient } from '@tanstack/react-query';

// Create a singleton QueryClient that persists across HMR
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60, // 1 minute
        retry: 2,
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
