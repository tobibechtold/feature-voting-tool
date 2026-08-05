import { describe, expect, it } from 'vitest';
import { extractBearerToken, sha256Hex } from './auth';

describe('extractBearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(extractBearerToken('Bearer fvt_abc123')).toBe('fvt_abc123');
  });

  it('is case-insensitive for the Bearer prefix', () => {
    expect(extractBearerToken('bearer fvt_abc123')).toBe('fvt_abc123');
  });

  it('returns null for a missing header', () => {
    expect(extractBearerToken(null)).toBeNull();
  });

  it('returns null for a non-bearer header', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null for a Bearer header without a token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
  });
});

describe('sha256Hex', () => {
  it('hashes to lowercase hex (known vector)', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('produces 64 hex chars for arbitrary input', async () => {
    const hash = await sha256Hex('fvt_' + 'a'.repeat(64));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
