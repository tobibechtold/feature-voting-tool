import { OverviewSortMode } from './feedbackOverview';

const SORT_MODE_STORAGE_PREFIX = 'feedback-sort-mode:';
const DEFAULT_SORT_MODE: OverviewSortMode = 'popularity';
const SORT_MODES: OverviewSortMode[] = ['popularity', 'date', 'version'];

function getSortModeStorageKey(slug?: string): string | null {
  if (!slug) return null;
  return `${SORT_MODE_STORAGE_PREFIX}${slug}`;
}

export function loadOverviewSortMode(slug?: string): OverviewSortMode {
  const key = getSortModeStorageKey(slug);
  if (!key) return DEFAULT_SORT_MODE;

  const stored = localStorage.getItem(key);
  if (!stored) return DEFAULT_SORT_MODE;

  if (SORT_MODES.includes(stored as OverviewSortMode)) {
    return stored as OverviewSortMode;
  }

  return DEFAULT_SORT_MODE;
}

export function saveOverviewSortMode(slug: string | undefined, sortMode: OverviewSortMode): void {
  const key = getSortModeStorageKey(slug);
  if (!key) return;

  localStorage.setItem(key, sortMode);
}
