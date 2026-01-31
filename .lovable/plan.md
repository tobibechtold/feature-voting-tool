

# Update Email Notification Domain

## Overview
Update the Edge Function to use your verified Resend domain (`featurevoting.tobibechtold.dev`) for both the feedback URL links and the email sender address.

---

## Changes Required

### File: `supabase/functions/send-notification/index.ts`

**Line 58** - Update feedback URL:
```typescript
// Before
const feedbackUrl = `https://app-applaud.lovable.app/app/${appSlug}/feedback/${feedback.id}`;

// After
const feedbackUrl = `https://featurevoting.tobibechtold.dev/app/${appSlug}/feedback/${feedback.id}`;
```

**Lines 66, 87, 100** - Update sender email domain:
```typescript
// Before
from: "Feature Vote <noreply@tobibechtold.dev>",

// After
from: "Feature Vote <noreply@featurevoting.tobibechtold.dev>",
```

---

## Summary of Changes

| Location | Change |
|----------|--------|
| Line 58 | Update `feedbackUrl` to use `featurevoting.tobibechtold.dev` |
| Line 66 | Update `from` email for new_feedback |
| Line 87 | Update `from` email for status_change |
| Line 100 | Update `from` email for admin_comment |

---

## After Implementation

Remember to redeploy the Edge Function after these changes:
```bash
supabase functions deploy send-notification
```

