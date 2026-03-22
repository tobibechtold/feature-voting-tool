import type { OverviewSortMode } from './feedbackOverview';
import { getDefaultFeedbackStateExpansion, type FeedbackStateExpansion } from './feedbackOverview';

const GROUPED_FEEDBACK_ENABLED_PREFIX = 'grouped-feedback-enabled:';
const GROUPED_FEEDBACK_EXPANSION_PREFIX = 'grouped-feedback-expansion:';
const ROADMAP_SORT_MODE_PREFIX = 'roadmap-sort-mode:';
const DEFAULT_ROADMAP_SORT_MODE: OverviewSortMode = 'popularity';
const SORT_MODES: OverviewSortMode[] = ['popularity', 'date', 'version'];

function getScopedStorageKey(prefix: string, slug?: string): string | null {
  if (!slug) return null;
  return `${prefix}${slug}`;
}

export function loadGroupedFeedbackEnabled(slug?: string): boolean {
  const key = getScopedStorageKey(GROUPED_FEEDBACK_ENABLED_PREFIX, slug);
  if (!key) return false;

  return localStorage.getItem(key) === 'true';
}

export function saveGroupedFeedbackEnabled(slug: string | undefined, enabled: boolean): void {
  const key = getScopedStorageKey(GROUPED_FEEDBACK_ENABLED_PREFIX, slug);
  if (!key) return;

  localStorage.setItem(key, String(enabled));
}

export function loadGroupedFeedbackExpansion(slug?: string): FeedbackStateExpansion {
  const key = getScopedStorageKey(GROUPED_FEEDBACK_EXPANSION_PREFIX, slug);
  const defaults = getDefaultFeedbackStateExpansion();
  if (!key) return defaults;

  const stored = localStorage.getItem(key);
  if (!stored) return defaults;

  try {
    const parsed = JSON.parse(stored) as Partial<FeedbackStateExpansion>;
    return {
      ...defaults,
      ...parsed,
    };
  } catch {
    return defaults;
  }
}

export function saveGroupedFeedbackExpansion(
  slug: string | undefined,
  expansion: FeedbackStateExpansion
): void {
  const key = getScopedStorageKey(GROUPED_FEEDBACK_EXPANSION_PREFIX, slug);
  if (!key) return;

  localStorage.setItem(key, JSON.stringify(expansion));
}

export function loadRoadmapSortMode(slug?: string): OverviewSortMode {
  const key = getScopedStorageKey(ROADMAP_SORT_MODE_PREFIX, slug);
  if (!key) return DEFAULT_ROADMAP_SORT_MODE;

  const stored = localStorage.getItem(key);
  if (!stored) return DEFAULT_ROADMAP_SORT_MODE;

  if (SORT_MODES.includes(stored as OverviewSortMode)) {
    return stored as OverviewSortMode;
  }

  return DEFAULT_ROADMAP_SORT_MODE;
}

export function saveRoadmapSortMode(slug: string | undefined, sortMode: OverviewSortMode): void {
  const key = getScopedStorageKey(ROADMAP_SORT_MODE_PREFIX, slug);
  if (!key) return;

  localStorage.setItem(key, sortMode);
}
