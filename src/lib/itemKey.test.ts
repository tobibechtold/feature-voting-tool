import { describe, expect, it } from 'vitest';
import { resolveFeedbackLookup } from './itemKey';

const app = { id: 'a1', item_key: 'INTAKE' };
const uuid = '3f2b8c1e-5d4a-4b7e-9a10-2c6d8e4f1a37';

describe('resolveFeedbackLookup', () => {
  it('resolves a uuid by id even without an app', () => {
    expect(resolveFeedbackLookup(uuid, undefined)).toEqual({ by: 'id', id: uuid });
  });

  it('resolves a matching key by number', () => {
    expect(resolveFeedbackLookup('intake-7', app)).toEqual({
      by: 'number',
      appId: 'a1',
      number: 7,
    });
  });

  it('returns none for another app prefix', () => {
    expect(resolveFeedbackLookup('FOO-7', app)).toEqual({ by: 'none' });
  });

  it('returns none for a key without an app', () => {
    expect(resolveFeedbackLookup('INTAKE-7', undefined)).toEqual({ by: 'none' });
  });

  it('returns none for undefined input', () => {
    expect(resolveFeedbackLookup(undefined, app)).toEqual({ by: 'none' });
  });
});
