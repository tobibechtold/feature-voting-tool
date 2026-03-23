import type { FeedbackItem, FeedbackStatus, FeedbackType } from '@/types';

export type OverviewFilterType = 'all' | FeedbackType;
export type OverviewSortMode = 'popularity' | 'date' | 'version';
export type OverviewVersionFilter = 'all' | 'none' | string;
export const FEEDBACK_STATUS_ORDER: FeedbackStatus[] = ['open', 'planned', 'progress', 'completed', 'wont_do'];

export type FeedbackStateSection = {
  status: FeedbackStatus;
  items: FeedbackItem[];
};

export type FeedbackStateExpansion = Record<FeedbackStatus, boolean>;

type FilterAndSortOptions = {
  filterType: OverviewFilterType;
  filterStatuses: FeedbackStatus[];
  sortMode: OverviewSortMode;
  versionFilter: OverviewVersionFilter;
};

function normalizeVersion(version?: string | null): string | null {
  if (!version) return null;
  const cleaned = version.trim();
  if (!cleaned) return null;
  return cleaned.replace(/^v/i, '');
}

function compareVersionsDesc(a: string, b: string): number {
  const aParts = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const bParts = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < maxLen; index += 1) {
    const aPart = aParts[index] ?? 0;
    const bPart = bParts[index] ?? 0;
    if (aPart !== bPart) return bPart - aPart;
  }

  return 0;
}

function isClosedStatus(status: FeedbackStatus): boolean {
  return status === 'completed' || status === 'wont_do';
}

function compareBySortMode(a: FeedbackItem, b: FeedbackItem, sortMode: OverviewSortMode): number {
  if (sortMode === 'date') {
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  }

  if (sortMode === 'version') {
    const aVersion = normalizeVersion(a.version);
    const bVersion = normalizeVersion(b.version);

    if (!aVersion && !bVersion) return 0;
    if (!aVersion) return 1;
    if (!bVersion) return -1;
    return compareVersionsDesc(aVersion, bVersion);
  }

  return b.vote_count - a.vote_count;
}

export function getDefaultFeedbackStateExpansion(): FeedbackStateExpansion {
  return {
    open: true,
    planned: true,
    progress: true,
    completed: false,
    wont_do: false,
  };
}

export function buildFeedbackStateSections(items: FeedbackItem[]): FeedbackStateSection[] {
  const itemsByStatus = new Map<FeedbackStatus, FeedbackItem[]>(
    FEEDBACK_STATUS_ORDER.map((status) => [status, []])
  );

  items.forEach((item) => {
    itemsByStatus.get(item.status)?.push(item);
  });

  return FEEDBACK_STATUS_ORDER.map((status) => ({
    status,
    items: itemsByStatus.get(status) || [],
  }));
}

export function sortRoadmapLaneItems(items: FeedbackItem[], _sortMode?: OverviewSortMode): FeedbackItem[] {
  return items
    .map((item, index) => ({
      item,
      index,
    }))
    .sort((a, b) => {
      const aPositioned = a.item.roadmap_position !== null && a.item.roadmap_position !== undefined;
      const bPositioned = b.item.roadmap_position !== null && b.item.roadmap_position !== undefined;

      if (aPositioned && bPositioned) {
        if (a.item.roadmap_position !== b.item.roadmap_position) {
          return (a.item.roadmap_position as number) - (b.item.roadmap_position as number);
        }

        return a.index - b.index;
      }

      if (aPositioned !== bPositioned) {
        return aPositioned ? -1 : 1;
      }

      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function getVersionOptions(items: FeedbackItem[]): string[] {
  const unique = new Set<string>();
  for (const item of items) {
    const version = normalizeVersion(item.version);
    if (version) unique.add(version);
  }
  return Array.from(unique).sort(compareVersionsDesc);
}

export function filterFeedbackByVersion(
  items: FeedbackItem[],
  versionFilter: OverviewVersionFilter
): FeedbackItem[] {
  if (versionFilter === 'all') {
    return items;
  }

  if (versionFilter === 'none') {
    return items.filter((item) => !normalizeVersion(item.version));
  }

  const selectedVersion = normalizeVersion(versionFilter);
  return items.filter((item) => normalizeVersion(item.version) === selectedVersion);
}

export function filterAndSortFeedback(items: FeedbackItem[], options: FilterAndSortOptions): FeedbackItem[] {
  let nextItems = [...items];

  if (options.filterType !== 'all') {
    nextItems = nextItems.filter((item) => item.type === options.filterType);
  }

  if (options.filterStatuses.length > 0) {
    nextItems = nextItems.filter((item) => options.filterStatuses.includes(item.status));
  }

  nextItems = filterFeedbackByVersion(nextItems, options.versionFilter);

  nextItems.sort((a, b) => {
    const aClosed = isClosedStatus(a.status);
    const bClosed = isClosedStatus(b.status);
    if (aClosed !== bClosed) return aClosed ? 1 : -1;

    const modeResult = compareBySortMode(a, b, options.sortMode);
    if (modeResult !== 0) return modeResult;

    return b.vote_count - a.vote_count;
  });

  return nextItems;
}
