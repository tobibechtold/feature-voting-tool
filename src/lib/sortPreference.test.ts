import { beforeEach, describe, expect, it } from 'vitest';
import { loadOverviewSortMode, saveOverviewSortMode } from './sortPreference';

describe('sortPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads saved sort mode for the app slug', () => {
    localStorage.setItem('feedback-sort-mode:roadmap-tool', 'date');

    const mode = loadOverviewSortMode('roadmap-tool');

    expect(mode).toBe('date');
  });

  it('falls back to popularity when saved value is invalid', () => {
    localStorage.setItem('feedback-sort-mode:roadmap-tool', 'invalid');

    const mode = loadOverviewSortMode('roadmap-tool');

    expect(mode).toBe('popularity');
  });

  it('persists sort mode by app slug', () => {
    saveOverviewSortMode('alpha', 'version');
    saveOverviewSortMode('beta', 'date');

    expect(localStorage.getItem('feedback-sort-mode:alpha')).toBe('version');
    expect(localStorage.getItem('feedback-sort-mode:beta')).toBe('date');
  });
});
