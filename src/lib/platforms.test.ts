import { describe, expect, it } from 'vitest';
import { parsePlatformsInput, formatPlatformsInput, normalizePlatformLabel } from './platforms';

describe('platform utils', () => {
  it('parses comma separated input into unique lowercase keys', () => {
    expect(parsePlatformsInput('iOS, Android, web, ios')).toEqual(['ios', 'android', 'web']);
  });

  it('formats platform keys for admin input', () => {
    expect(formatPlatformsInput(['ios', 'android'])).toBe('ios, android');
  });

  it('normalizes a key for display label', () => {
    expect(normalizePlatformLabel('ios')).toBe('iOS');
    expect(normalizePlatformLabel('android')).toBe('Android');
    expect(normalizePlatformLabel('desktop-web')).toBe('Desktop Web');
  });
});
