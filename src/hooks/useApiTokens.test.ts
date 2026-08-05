import { describe, expect, it, vi } from 'vitest';
import { createApiToken, fetchApiTokens, revokeApiToken } from './useApiTokens';

function createMockClient(options: {
  rows?: unknown[];
  rpcResult?: { data: unknown; error: Error | null };
  updateError?: Error | null;
  selectError?: Error | null;
}) {
  const eq = vi.fn(async () => ({ error: options.updateError ?? null }));
  const update = vi.fn(() => ({ eq }));
  const order = vi.fn(async () => ({ data: options.rows ?? [], error: options.selectError ?? null }));
  const select = vi.fn(() => ({ order }));
  const rpc = vi.fn(async () => options.rpcResult ?? { data: null, error: null });
  const from = vi.fn((table: string) => {
    if (table !== 'api_tokens') throw new Error(`Unexpected table ${table}`);
    return { select, update };
  });
  return { from, rpc, select, order, update, eq };
}

describe('fetchApiTokens', () => {
  it('lists tokens newest first', async () => {
    const rows = [{ id: 't-1', name: 'laptop', created_at: '2026-08-01T00:00:00Z', last_used_at: null, revoked_at: null }];
    const client = createMockClient({ rows });

    const tokens = await fetchApiTokens(client);

    expect(tokens).toEqual(rows);
    expect(client.select).toHaveBeenCalledWith('id, name, created_at, last_used_at, revoked_at');
    expect(client.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('throws on error', async () => {
    const client = createMockClient({ selectError: new Error('boom') });
    await expect(fetchApiTokens(client)).rejects.toThrow('boom');
  });
});

describe('createApiToken', () => {
  it('calls the RPC and returns the plaintext token', async () => {
    const client = createMockClient({ rpcResult: { data: 'fvt_secret', error: null } });

    const token = await createApiToken(client, 'laptop');

    expect(token).toBe('fvt_secret');
    expect(client.rpc).toHaveBeenCalledWith('create_api_token', { p_name: 'laptop' });
  });

  it('throws when the RPC returns no token', async () => {
    const client = createMockClient({ rpcResult: { data: null, error: null } });
    await expect(createApiToken(client, 'laptop')).rejects.toThrow();
  });
});

describe('revokeApiToken', () => {
  it('sets revoked_at on the token row', async () => {
    const client = createMockClient({});

    await revokeApiToken(client, 't-1');

    expect(client.update).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) })
    );
    expect(client.eq).toHaveBeenCalledWith('id', 't-1');
  });

  it('throws on error', async () => {
    const client = createMockClient({ updateError: new Error('nope') });
    await expect(revokeApiToken(client, 't-1')).rejects.toThrow('nope');
  });
});
