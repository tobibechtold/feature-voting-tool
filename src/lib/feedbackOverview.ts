import type { FeedbackItem, FeedbackStatus, FeedbackType } from '@/types';

export type OverviewFilterType = 'all' | FeedbackType;
export type OverviewSortMode = 'popularity' | 'date' | 'version';
export type OverviewVersionFilter = 'all' | 'none' | string;

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

export function getVersionOptions(items: FeedbackItem[]): string[] {
  const unique = new Set<string>();
  for (const item of items) {
    const version = normalizeVersion(item.version);
    if (version) unique.add(version);
  }
  return Array.from(unique).sort(compareVersionsDesc);
}

export function filterAndSortFeedback(items: FeedbackItem[], options: FilterAndSortOptions): FeedbackItem[] {
  let nextItems = [...items];

  if (options.filterType !== 'all') {
    nextItems = nextItems.filter((item) => item.type === options.filterType);
  }

  if (options.filterStatuses.length > 0) {
    nextItems = nextItems.filter((item) => options.filterStatuses.includes(item.status));
  }

  if (options.versionFilter === 'none') {
    nextItems = nextItems.filter((item) => !normalizeVersion(item.version));
  } else if (options.versionFilter !== 'all') {
    const selectedVersion = normalizeVersion(options.versionFilter);
    nextItems = nextItems.filter((item) => normalizeVersion(item.version) === selectedVersion);
  }

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
