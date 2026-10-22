import { describe, expect, it } from 'vitest';
import type { FeedbackItem } from '@/types';
import { filterAndSortFeedback, getVersionOptions } from './feedbackOverview';

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
    version: partial.version,
    platform: partial.platform || null,
    submitter_email: null,
    notify_on_updates: false,
    number: partial.number ?? 1,
  };
}

describe('feedback overview helpers', () => {
  const items: FeedbackItem[] = [
    makeItem({
      id: 'open-high',
      status: 'open',
      vote_count: 12,
      created_at: '2026-03-01T10:00:00.000Z',
      version: '1.2.0',
    }),
    makeItem({
      id: 'open-new',
      status: 'planned',
      vote_count: 1,
      created_at: '2026-03-03T10:00:00.000Z',
      version: '2.0.0',
    }),
    makeItem({
      id: 'open-none',
      status: 'progress',
      vote_count: 7,
      created_at: '2026-02-25T10:00:00.000Z',
      version: null,
    }),
    makeItem({
      id: 'closed-popular',
      status: 'completed',
      vote_count: 99,
      created_at: '2026-03-04T10:00:00.000Z',
      version: '9.0.0',
    }),
    makeItem({
      id: 'wontdo',
      status: 'wont_do',
      vote_count: 50,
      created_at: '2026-03-02T10:00:00.000Z',
      version: null,
    }),
  ];

  it('keeps closed statuses at bottom regardless of popularity sort', () => {
    const sorted = filterAndSortFeedback(items, {
      sortMode: 'popularity',
      filterType: 'all',
      filterStatuses: [],
      versionFilter: 'all',
    });

    expect(sorted.map((item) => item.id)).toEqual([
      'open-high',
      'open-none',
      'open-new',
      'closed-popular',
      'wontdo',
    ]);
  });

  it('sorts by date descending within non-closed and closed groups', () => {
    const sorted = filterAndSortFeedback(items, {
      sortMode: 'date',
      filterType: 'all',
      filterStatuses: [],
      versionFilter: 'all',
    });

    expect(sorted.map((item) => item.id)).toEqual([
      'open-new',
      'open-high',
      'open-none',
      'closed-popular',
      'wontdo',
    ]);
  });

  it('sorts by highest version first and keeps no-version items last in each group', () => {
    const sorted = filterAndSortFeedback(items, {
      sortMode: 'version',
      filterType: 'all',
      filterStatuses: [],
      versionFilter: 'all',
    });

    expect(sorted.map((item) => item.id)).toEqual([
      'open-new',
      'open-high',
      'open-none',
      'closed-popular',
      'wontdo',
    ]);
  });

  it('filters by specific version and by no version', () => {
    const versioned = filterAndSortFeedback(items, {
      sortMode: 'popularity',
      filterType: 'all',
      filterStatuses: [],
      versionFilter: '1.2.0',
    });
    const none = filterAndSortFeedback(items, {
      sortMode: 'popularity',
      filterType: 'all',
      filterStatuses: [],
      versionFilter: 'none',
    });

    expect(versioned.map((item) => item.id)).toEqual(['open-high']);
    expect(none.map((item) => item.id)).toEqual(['open-none', 'wontdo']);
  });

  it('returns unique version options sorted from highest to lowest', () => {
    const options = getVersionOptions(items);
    expect(options).toEqual(['9.0.0', '2.0.0', '1.2.0']);
  });

  describe('search', () => {
    const searchItems: FeedbackItem[] = [
      makeItem({ id: 'a', number: 1, title: 'Dark mode' }),
      makeItem({ id: 'b', number: 2, title: 'App Crash', description: 'on start' }),
      makeItem({ id: 'c', number: 3, title: 'Export', description: 'Fails with CRASH report' }),
    ];
    const search = (searchQuery: string) =>
      filterAndSortFeedback(searchItems, {
        sortMode: 'popularity',
        filterType: 'all',
        filterStatuses: [],
        versionFilter: 'all',
        searchQuery,
        appKey: 'INTAKE',
      }).map((item) => item.id);

    it.each(['INTAKE-2', 'intake-2', ' intake-2 ', '2', '#2'])('matches item 2 by key or number: %s', (query) => {
      expect(search(query)).toEqual(['b']);
    });

    it('does not match by number for another app key, falling back to text', () => {
      expect(search('FOO-2')).toEqual([]);
    });

    it('falls back to text search for key-shaped queries with another prefix', () => {
      const withText = [
        makeItem({ id: 'x', number: 14, title: 'Crash on Android-14' }),
        makeItem({ id: 'y', number: 15, title: 'Other' }),
      ];
      const result = filterAndSortFeedback(withText, {
        sortMode: 'popularity',
        filterType: 'all',
        filterStatuses: [],
        versionFilter: 'all',
        searchQuery: 'android-14',
        appKey: 'INTAKE',
      }).map((item) => item.id);
      expect(result).toEqual(['x']);
    });

    it('matches numeric queries by number or text', () => {
      const withText = [
        makeItem({ id: 'n', number: 2024, title: 'Plain' }),
        makeItem({ id: 't', number: 5, title: 'Release 2024 plan' }),
        makeItem({ id: 'z', number: 6, title: 'Nope' }),
      ];
      const result = filterAndSortFeedback(withText, {
        sortMode: 'popularity',
        filterType: 'all',
        filterStatuses: [],
        versionFilter: 'all',
        searchQuery: '2024',
        appKey: 'INTAKE',
      }).map((item) => item.id).sort();
      expect(result).toEqual(['n', 't']);
    });

    it('matches title and description case-insensitively', () => {
      expect(search('crash').sort()).toEqual(['b', 'c']);
    });

    it('does not filter on empty or whitespace queries', () => {
      expect(search('')).toHaveLength(3);
      expect(search('   ')).toHaveLength(3);
    });
  });
});
