import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/types';
import {
  buildFeedbackStateSections,
  filterFeedbackByVersion,
  getDefaultFeedbackStateExpansion,
  sortRoadmapLaneItems,
} from './feedbackOverview';

function makeItem(partial: Partial<FeedbackItem> & Pick<FeedbackItem, 'id'>): FeedbackItem {
  return {
    id: partial.id,
    app_id: 'app-1',
    type: partial.type || 'feature',
    title: partial.title || partial.id,
    description: partial.description || '',
    status: partial.status || 'open',
    vote_count: partial.vote_count ?? 0,
    created_at: partial.created_at || '2026-01-01T00:00:00.000Z',
    version: partial.version ?? null,
    platform: partial.platform || null,
    submitter_email: null,
    notify_on_updates: false,
    roadmap_position: partial.roadmap_position ?? null,
  };
}

describe('feedback grouping helpers', () => {
  it('builds feedback state sections in stable status order', () => {
    const sections = buildFeedbackStateSections([
      makeItem({ id: 'completed-1', status: 'completed' }),
      makeItem({ id: 'open-1', status: 'open' }),
      makeItem({ id: 'progress-1', status: 'progress' }),
      makeItem({ id: 'wontdo-1', status: 'wont_do' }),
      makeItem({ id: 'planned-1', status: 'planned' }),
    ]);

    expect(sections.map((section) => section.status)).toEqual([
      'open',
      'planned',
      'progress',
      'completed',
      'wont_do',
    ]);
  });

  it('collapses completed and wont_do by default while expanding active states', () => {
    expect(getDefaultFeedbackStateExpansion()).toEqual({
      open: true,
      planned: true,
      progress: true,
      completed: false,
      wont_do: false,
    });
  });

  it('sorts roadmap lane items by persisted roadmap position and preserves stable fallback order', () => {
    const items = sortRoadmapLaneItems(
      [
        makeItem({ id: 'duplicate-a', vote_count: 1, roadmap_position: 2 }),
        makeItem({ id: 'unpositioned-a', vote_count: 100, roadmap_position: null }),
        makeItem({ id: 'first', vote_count: 0, roadmap_position: 1 }),
        makeItem({ id: 'duplicate-b', vote_count: 200, roadmap_position: 2 }),
        makeItem({ id: 'unpositioned-b', vote_count: 50, roadmap_position: null }),
      ],
      'popularity'
    );

    expect(items.map((item) => item.id)).toEqual([
      'first',
      'duplicate-a',
      'duplicate-b',
      'unpositioned-a',
      'unpositioned-b',
    ]);
  });

  it('filters roadmap items by normalized version while keeping no-version items selectable', () => {
    expect(
      filterFeedbackByVersion([
        makeItem({ id: 'versioned-a', version: 'v1.2.0' }),
        makeItem({ id: 'versioned-b', version: '1.3.0' }),
        makeItem({ id: 'no-version', version: null }),
      ], '1.2.0').map((item) => item.id)
    ).toEqual(['versioned-a']);

    expect(
      filterFeedbackByVersion([
        makeItem({ id: 'versioned-a', version: 'v1.2.0' }),
        makeItem({ id: 'no-version', version: null }),
      ], 'none').map((item) => item.id)
    ).toEqual(['no-version']);
  });
});
