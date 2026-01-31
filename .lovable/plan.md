
# Fix Skeleton Issue on Page Reload

## Problem
When you reload the published page (https://app-applaud.lovable.app), you see skeleton loaders for a noticeable amount of time (~700ms) before the actual content appears. This happens because:

1. Fresh page loads have no cached data
2. React Query's `isLoading` is `true` until the first successful fetch
3. The QueryClient doesn't persist data between page refreshes

## Solution
Implement a multi-pronged approach to minimize skeleton visibility:

### 1. Use `isFetching` + `data` pattern instead of `isLoading`
Instead of showing skeletons whenever `isLoading` is true, only show them when there's no data AND fetching. This way, cached data shows immediately while refetching happens in the background.

### 2. Add placeholder data for queries
Provide empty array placeholders so the UI renders immediately (showing "no apps" vs skeleton), then updates when real data arrives.

### 3. Optimize query timing
Reduce the perceived loading time by:
- Setting shorter `staleTime` to ensure fresh data on navigation
- Using `refetchOnMount: 'always'` to keep data current

---

## Changes Required

### File 1: `src/pages/Index.tsx`

Change the skeleton logic to only show when there's no cached data:

```typescript
// Current (shows skeleton during any loading)
isLoading ? <Skeleton /> : <Content />

// New (shows skeleton only if no data exists)
(isLoading && !apps) ? <Skeleton /> : <Content />
```

Also add a "loading" indicator in the header when refreshing data that already exists.

### File 2: `src/pages/AppFeedback.tsx`

Same pattern - show skeletons only when there's truly no data:
- For the app header section
- For the feedback list section

### File 3: `src/lib/queryClient.ts`

Add `gcTime` (garbage collection time) to keep cached data longer:

```typescript
defaultOptions: {
  queries: {
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 10, // Keep cache for 10 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  },
},
```

### File 4: `src/hooks/useApps.ts`

Add `placeholderData` to prevent skeleton flash:

```typescript
export function useApps() {
  return useQuery({
    queryKey: ['apps'],
    queryFn: async () => { ... },
    placeholderData: [], // Show empty state immediately, not skeleton
  });
}
```

---

## Visual Improvement

### Before (current behavior)
```text
Page Load → Skeleton (700ms) → Content
```

### After (new behavior)
```text
Page Load → Content immediately (empty or cached) → Updated content
```

If there's cached data from a previous visit, it shows immediately. On first ever visit, the "No apps" state shows briefly before real data arrives (which feels faster than animated skeletons).

---

## Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Show skeletons only when `isLoading && !data` |
| `src/pages/AppFeedback.tsx` | Same pattern for app and feedback loading |
| `src/lib/queryClient.ts` | Add `gcTime` to persist cache longer |
| `src/hooks/useApps.ts` | Add `placeholderData: []` for instant render |
| `src/hooks/useFeedback.ts` | Add `placeholderData: []` for feedback list |

This fix ensures the page renders content immediately instead of showing skeleton animations during every load.
