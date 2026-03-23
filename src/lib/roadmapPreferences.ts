import { getDefaultFeedbackStateExpansion, type FeedbackStateExpansion } from './feedbackOverview';

const GROUPED_FEEDBACK_ENABLED_PREFIX = 'grouped-feedback-enabled:';
const GROUPED_FEEDBACK_EXPANSION_PREFIX = 'grouped-feedback-expansion:';

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
