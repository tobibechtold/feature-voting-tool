
# Update Feature Request Text and Add Welcoming Message

## Overview
Update the German translation for "Request Feature" and add encouraging dialog descriptions that invite users to share their ideas and emphasize that their feedback matters.

---

## Changes Required

### 1. Update Translations (`src/lib/i18n.ts`)

**Change German "createFeature" translation:**
- Line 152: Change `'Feature anfragen'` to `'Feature vorschlagen'`

**Add new translation keys for dialog descriptions:**

| Key | English | German |
|-----|---------|--------|
| `featureDialogDescription` | Your ideas shape this app! Share what matters to you and help decide the direction we take together. | Deine Ideen formen diese App! Teile mit, was dir wichtig ist und entscheide mit, in welche Richtung wir gemeinsam gehen. |
| `bugDialogDescription` | Help us improve by reporting issues you've encountered. Your feedback makes a difference! | Hilf uns, die App zu verbessern, indem du Probleme meldest. Dein Feedback macht den Unterschied! |

---

### 2. Update CreateFeedbackDialog (`src/components/CreateFeedbackDialog.tsx`)

**Line 108-112**: Replace hardcoded English description with translation keys:

```typescript
// Before
<DialogDescription>
  {isFeature
    ? 'Share your idea to improve this app'
    : 'Report an issue you encountered'}
</DialogDescription>

// After
<DialogDescription>
  {isFeature
    ? t('featureDialogDescription')
    : t('bugDialogDescription')}
</DialogDescription>
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/i18n.ts` | Update German `createFeature` to "Feature vorschlagen" |
| `src/lib/i18n.ts` | Add `featureDialogDescription` (EN + DE) |
| `src/lib/i18n.ts` | Add `bugDialogDescription` (EN + DE) |
| `src/components/CreateFeedbackDialog.tsx` | Use translation keys for dialog descriptions |

---

## Result

When users open the "Feature vorschlagen" dialog, they'll see a warm, inviting message that:
- Emphasizes their ideas matter
- Shows you're listening to their feedback
- Encourages them to help shape the app's direction
