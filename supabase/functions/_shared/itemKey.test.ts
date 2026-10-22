import { describe, expect, it } from 'vitest';
import {
  deriveItemKey,
  formatItemKey,
  isUuid,
  isValidItemKey,
  parseItemKey,
} from './itemKey';

describe('formatItemKey', () => {
  it('joins key and number', () => {
    expect(formatItemKey('INTAKE', 42)).toBe('INTAKE-42');
  });
});

describe('parseItemKey', () => {
  it('parses a canonical key', () => {
    expect(parseItemKey('INTAKE-42')).toEqual({ appKey: 'INTAKE', number: 42 });
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseItemKey(' intake-42 ')).toEqual({ appKey: 'INTAKE', number: 42 });
  });

  it.each(['INTAKE-0', 'INTAKE-', '42', 'A-B-1', 'INTAKE-4x'])(
    'rejects %s',
    (input) => {
      expect(parseItemKey(input)).toBeNull();
    },
  );
});

describe('isUuid', () => {
  it('accepts a v4 uuid and rejects an item key', () => {
    expect(isUuid('3f2b8c1e-5d4a-4b7e-9a10-2c6d8e4f1a37')).toBe(true);
    expect(isUuid('INTAKE-42')).toBe(false);
  });
});

describe('deriveItemKey', () => {
  it.each([
    ['roadmap-tool', 'ROADMAPTOO'],
    ['intake', 'INTAKE'],
    ['9lives', 'X9LIVES'],
    ['a', 'AX'],
  ])('derives %s -> %s', (slug, expected) => {
    expect(deriveItemKey(slug)).toBe(expected);
  });
});

describe('isValidItemKey', () => {
  it('accepts valid keys', () => {
    expect(isValidItemKey('INTAKE')).toBe(true);
  });

  it.each(['abc', 'A', 'A-B', 'ABCDEFGHIJK'])('rejects %s', (key) => {
    expect(isValidItemKey(key)).toBe(false);
  });
});
