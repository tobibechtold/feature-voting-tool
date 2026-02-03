
# Mobile Layout Fixes and Instagram-Style Heart Button

## Overview

This plan addresses three issues:
1. Replace the upvote button with an Instagram-style heart button with counter
2. Fix mobile layout for feedback detail page
3. Fix action buttons overflowing on mobile in the app feedback page

---

## Part 1: Instagram-Style Heart Button

### Current Design
The current vote button is a tall rectangular button with a chevron-up arrow and count stacked vertically.

### New Design
A compact horizontal layout with:
- Heart icon (outline when not voted, filled when voted)
- Counter next to it
- Animation on click (like Instagram's "pop" effect)

```text
Current:        New:
+-----+         
|  ^  |         ♡ 42  (not voted)
| 42  |         ❤️ 42  (voted, with pop animation)
+-----+
```

### Changes to `src/components/VoteButton.tsx`

Complete redesign of the component:

```tsx
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VoteButton({ count, voted, onVote, disabled }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onVote();
      }}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 transition-all duration-200',
        'hover:scale-105 active:scale-95',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <Heart
        className={cn(
          'h-5 w-5 transition-all duration-200',
          voted 
            ? 'fill-red-500 text-red-500 animate-vote-pop' 
            : 'text-muted-foreground hover:text-red-400'
        )}
      />
      <span className={cn(
        'text-sm font-semibold',
        voted ? 'text-red-500' : 'text-muted-foreground'
      )}>
        {count}
      </span>
    </button>
  );
}
```

### Update Animation in `src/index.css`

The existing `animate-vote-pop` animation will work, but ensure it's defined in tailwind config.

---

## Part 2: Mobile Layout for Feedback Detail

### Changes to `src/pages/FeedbackDetail.tsx`

With the new compact heart button, the layout becomes much simpler:

**Lines 232-257** - Update layout structure:

- Move badges and heart button to the same row on mobile
- Heart button goes at the end of the badge row (right side)
- On desktop, keep heart in the same position for consistency

```text
MOBILE & DESKTOP (same layout now):
+----------------------------------------+
| [Feature] [Planned] [v2.1]      ❤️ 42  |
|                                        |
| Title goes here                        |
|                                        |
| Description text...                    |
+----------------------------------------+
```

```tsx
<CardContent className="p-6">
  <div className="flex-1 min-w-0">
    {/* Header row with badges and heart */}
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge>...</Badge>
        <Badge>...</Badge>
      </div>
      <VoteButton ... />
    </div>
    
    <h1>Title</h1>
    <p>Description</p>
  </div>
</CardContent>
```

---

## Part 3: Fix Action Buttons Overflow

### Changes to `src/pages/AppFeedback.tsx`

**Lines 193-233** - Update header layout to stack buttons on mobile:

```tsx
<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
  <div className="flex items-center gap-4">
    {/* App logo and info - unchanged */}
  </div>
  
  {/* Buttons - stack on mobile, row on desktop */}
  <div className="flex flex-col sm:flex-row gap-2">
    <Button variant="outline" asChild className="w-full sm:w-auto">
      <Link to={...}>Changelog</Link>
    </Button>
    <Button variant="feature" className="w-full sm:w-auto">
      {t('createFeature')}
    </Button>
    <Button variant="bug" className="w-full sm:w-auto">
      {t('createBug')}
    </Button>
  </div>
</div>
```

---

## Part 4: Update FeedbackCard for Consistency

### Changes to `src/components/FeedbackCard.tsx`

Move heart button to the badge row for consistent layout:

```text
+----------------------------------------+
| [Feature] [Planned] [v2.1]      ❤️ 42  |
| Title goes here                        |
| Description preview...                 |
| 💬 5                                   |
+----------------------------------------+
```

```tsx
<CardContent className="p-4">
  <div className="flex flex-col gap-2">
    {/* Header row: badges + heart */}
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge>Feature</Badge>
        <Badge>Planned</Badge>
        {item.version && <Badge>v2.1</Badge>}
      </div>
      <VoteButton ... />
    </div>
    
    {/* Content */}
    <h3>Title</h3>
    <p>Description</p>
    
    {/* Footer: comments */}
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      <MessageSquare /> 5
    </div>
  </div>
</CardContent>
```

---

## Summary of Files to Change

| File | Changes |
|------|---------|
| `src/components/VoteButton.tsx` | Complete redesign - heart icon, horizontal layout |
| `src/components/ui/button.tsx` | Remove vote-related variants (no longer needed) |
| `src/pages/FeedbackDetail.tsx` | Restructure layout - badges and heart on same row |
| `src/pages/AppFeedback.tsx` | Stack action buttons on mobile |
| `src/components/FeedbackCard.tsx` | Move heart to badge row, vertical card layout |
| `src/index.css` | Keep vote-pop animation for heart |

---

## Visual Comparison

### Before (Upvote Button)
```text
+-----+  [Feature] [Planned]
|  ^  |  Title of the feedback
| 42  |  Description text...
+-----+
```

### After (Heart Button)
```text
[Feature] [Planned]          ❤️ 42
Title of the feedback
Description text...
```

The new design is:
- More compact and mobile-friendly
- Familiar (Instagram-like interaction)
- Cleaner visual hierarchy
- Consistent across list and detail views
