import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { calls, from } = vi.hoisted(() => ({
  calls: [] as Array<[string, unknown]>,
  from: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((field: string, value: unknown) => {
    calls.push([field, value]);
    return builder;
  });
  builder.abortSignal = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: { id: 'f1', number: 7 }, error: null }));
  from.mockImplementation(() => builder);
  return { supabase: { from }, publicSupabase: { from } };
});

import { useFeedbackItem } from './useFeedback';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

const app = { id: 'a1', item_key: 'INTAKE' };
const uuid = '11111111-2222-4333-8444-555555555555';

describe('useFeedbackItem lookup', () => {
  beforeEach(() => {
    calls.length = 0;
    from.mockClear();
  });

  it('queries by id for a uuid', async () => {
    const { result } = renderHook(() => useFeedbackItem(uuid, app), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(calls).toEqual([['id', uuid]]);
  });

  it('queries by app and number for a key', async () => {
    const { result } = renderHook(() => useFeedbackItem('intake-7', app), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(calls).toEqual([['app_id', 'a1'], ['number', 7]]);
  });

  it('issues no query and returns null for a foreign key', async () => {
    const { result } = renderHook(() => useFeedbackItem('FOO-7', app), { wrapper });
    await waitFor(() => expect(result.current.data).toBeNull());
    expect(from).not.toHaveBeenCalled();
  });

  it('stays disabled without data while the app is still loading', async () => {
    const { result } = renderHook(() => useFeedbackItem('INTAKE-7', undefined), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
    expect(from).not.toHaveBeenCalled();
  });
});
