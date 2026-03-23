import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadGroupedFeedbackEnabled,
  loadGroupedFeedbackExpansion,
  saveGroupedFeedbackEnabled,
  saveGroupedFeedbackExpansion,
} from './roadmapPreferences';

describe('roadmap preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists grouped feedback enabled state by slug', () => {
    saveGroupedFeedbackEnabled('roadmap-tool', true);

    expect(loadGroupedFeedbackEnabled('roadmap-tool')).toBe(true);
    expect(loadGroupedFeedbackEnabled('another-tool')).toBe(false);
  });

  it('persists grouped feedback expansion state by slug', () => {
    saveGroupedFeedbackExpansion('roadmap-tool', {
      open: true,
      planned: false,
      progress: true,
      completed: false,
      wont_do: false,
    });

    expect(loadGroupedFeedbackExpansion('roadmap-tool')).toEqual({
      open: true,
      planned: false,
      progress: true,
      completed: false,
      wont_do: false,
    });
  });
});
