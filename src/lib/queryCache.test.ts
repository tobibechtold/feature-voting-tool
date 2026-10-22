import { beforeEach, describe, expect, it } from 'vitest';
import { getCachedData, setCachedData } from './queryCache';

describe('queryCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips data written by the current build', () => {
    setCachedData('feedback:app-1', [{ id: 'f1', number: 7 }]);

    expect(getCachedData('feedback:app-1')?.data).toEqual([{ id: 'f1', number: 7 }]);
  });

  it('ignores fresh entries written by an older build under the unversioned prefix', () => {
    // Pre-item-key builds cached feedback without `number`; using it as
    // initialData rendered keys like INTAKE-undefined.
    localStorage.setItem(
      'query_cache:feedback:app-1',
      JSON.stringify({ data: [{ id: 'f1' }], updatedAt: Date.now() })
    );

    expect(getCachedData('feedback:app-1')).toBeNull();
  });
});
