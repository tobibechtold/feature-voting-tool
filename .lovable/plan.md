

# Fix "No Apps Available" Flash on Page Load

## Problem
After the previous fix, the page shows "No apps available" while loading because:
1. `placeholderData: []` provides an empty array immediately
2. The condition `isLoading && !apps` evaluates to `false` (since `[]` is truthy)
3. The code falls through to the "no apps" state instead of showing skeletons

## Solution
Use React Query's `isPlaceholderData` flag to distinguish between:
- Placeholder data (still loading real data) → show skeleton
- Actual empty data (truly no apps) → show "no apps" message

## Changes Required

### File: `src/pages/Index.tsx`

Update the loading condition to use `isPlaceholderData`:

```typescript
const { 
  data: apps, 
  isLoading, 
  isPlaceholderData,  // Add this
  error, 
  refetch, 
  isRefetching 
} = useApps();

// Then update the condition:
// Show skeleton when loading OR when showing placeholder data
} : (isLoading || isPlaceholderData) ? (
  <div className="grid ...">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-32 rounded-lg" />
    ))}
  </div>
) : apps && apps.length > 0 ? (
  // ... real apps
) : (
  // "No apps" - only shown when data is final and empty
)
```

### File: `src/pages/AppFeedback.tsx`

Apply the same pattern for feedback loading:

```typescript
const { 
  data: feedback, 
  isLoading: feedbackLoading,
  isPlaceholderData: isFeedbackPlaceholder,
  ...
} = useFeedback(app?.id);

// Show skeleton when loading or placeholder
{(feedbackLoading || isFeedbackPlaceholder) ? (
  <Skeleton ... />
) : feedback.length > 0 ? (
  // ... real feedback
) : (
  // "No feedback"
)}
```

## How `isPlaceholderData` Works

| State | `isLoading` | `isPlaceholderData` | `apps` | What to show |
|-------|-------------|---------------------|--------|--------------|
| Initial load | `true` | `true` | `[]` | Skeleton |
| Data arrived | `false` | `false` | `[...]` | Apps |
| Empty result | `false` | `false` | `[]` | "No apps" |
| Cached + refetch | `false` | `false` | `[...]` | Apps |

## Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Use `isPlaceholderData` to show skeleton during initial load |
| `src/pages/AppFeedback.tsx` | Same pattern for app and feedback sections |

This ensures the skeleton shows while waiting for real data, and "No apps" only appears when the database actually returns an empty result.

