
# Email Notifications with Separate Email and Notification Preferences

## Overview
Add email notification functionality with **two separate fields**:
1. **Email address** (optional) - Visible to admins so they can contact users with questions
2. **Notify me checkbox** - Controls whether to send automatic notifications on status changes/admin comments

This separation allows users to share their email for admin contact purposes without receiving automatic notifications.

---

## Requirements

### Before Implementation
You'll need a **Resend** account for sending emails:
1. Sign up at https://resend.com if you don't have one
2. Verify your domain at https://resend.com/domains (e.g., `tobibechtold.dev`)
3. Create an API key at https://resend.com/api-keys
4. Provide the `RESEND_API_KEY` when prompted

---

## UI Design

### Create Feedback Dialog (updated)

```text
┌─────────────────────────────────────────┐
│ Request Feature                         │
│                                         │
│ Title                                   │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Description                             │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Email (optional)                        │
│ ┌─────────────────────────────────────┐ │
│ │ your@email.com                      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ☑ Notify me about status changes        │
│                                         │
│              [Cancel] [Submit]          │
└─────────────────────────────────────────┘
```

- Email field is always optional
- Checkbox only shows when email is entered
- Checkbox checked by default when email is provided

### Admin View (Feedback Detail)
- Admin can see submitter email if provided (below the description)
- Admin can click the email to compose a message

---

## Technical Plan

### 1. Database Changes

Add two columns to the `feedback` table:
- `submitter_email` (text, nullable) - User's email for admin contact
- `notify_on_updates` (boolean, default false) - Whether to send notifications

```sql
ALTER TABLE public.feedback 
ADD COLUMN submitter_email text,
ADD COLUMN notify_on_updates boolean DEFAULT false;
```

### 2. Update TypeScript Types

**src/types/database.ts** - Add to feedback table types:
- Row: `submitter_email: string | null`, `notify_on_updates: boolean`
- Insert: `submitter_email?: string | null`, `notify_on_updates?: boolean`
- Update: `submitter_email?: string | null`, `notify_on_updates?: boolean`

**src/types/index.ts** - Add to FeedbackItem interface:
- `submitter_email?: string | null`
- `notify_on_updates?: boolean`

### 3. Update Create Feedback Dialog

**src/components/CreateFeedbackDialog.tsx**:
- Add `email` state (string)
- Add `notifyOnUpdates` state (boolean)
- Add email input field with validation
- Add checkbox that appears when email is entered
- Update `onSubmit` signature to include `email?: string`, `notifyOnUpdates?: boolean`
- Validate email format when provided

### 4. Update Translations

**src/lib/i18n.ts** - Add translations:
```typescript
// English
emailOptional: 'Email (optional)',
emailPlaceholder: 'your@email.com',
notifyOnUpdates: 'Notify me about status changes and replies',
submitterEmail: 'Submitter Email',

// German
emailOptional: 'E-Mail (optional)',
emailPlaceholder: 'deine@email.de',
notifyOnUpdates: 'Bei Statusänderungen und Antworten benachrichtigen',
submitterEmail: 'E-Mail des Einreichers',
```

### 5. Update Feedback Hooks

**src/hooks/useFeedback.ts** - `useCreateFeedback`:
- Accept `submitter_email` and `notify_on_updates` in mutation input
- Pass these to the Supabase insert
- After creation, call edge function to notify admin (support@tobibechtold.dev)

**src/hooks/useFeedback.ts** - `useUpdateFeedbackStatus`:
- After status update, fetch feedback to check `submitter_email` and `notify_on_updates`
- If `notify_on_updates` is true, call edge function

### 6. Update Comments Hook

**src/hooks/useComments.ts** - `useCreateComment`:
- After admin comment, fetch parent feedback
- If `notify_on_updates` is true and comment is from admin, call edge function

### 7. Update AppFeedback Page

**src/pages/AppFeedback.tsx** - `handleCreateFeedback`:
- Pass email and notifyOnUpdates to mutation

### 8. Update FeedbackDetail Page (Admin View)

**src/pages/FeedbackDetail.tsx**:
- When admin is viewing, show submitter email if available
- Display as a mailto link for easy contact
- Show below the feedback description

### 9. Create Edge Function

**supabase/functions/send-notification/index.ts**:

Handles three notification types:
| Type | Recipient | Subject |
|------|-----------|---------|
| `new_feedback` | support@tobibechtold.dev | New {type}: {title} |
| `status_change` | submitter_email (if notify_on_updates) | Your {type} is now {status} |
| `admin_comment` | submitter_email (if notify_on_updates) | Admin replied to your {type} |

Uses Resend API for sending emails.

**supabase/config.toml**:
```toml
[functions.send-notification]
verify_jwt = false
```

---

## Notification Logic Summary

| Event | Send to Admin? | Send to User? |
|-------|----------------|---------------|
| New feedback created | Always (support@) | Never |
| Status changed | Never | Only if `notify_on_updates = true` |
| Admin comments | Never | Only if `notify_on_updates = true` |

---

## File Changes Summary

| File | Action |
|------|--------|
| Database migration | Add `submitter_email` and `notify_on_updates` columns |
| `src/types/database.ts` | Add new columns to types |
| `src/types/index.ts` | Add fields to FeedbackItem |
| `src/lib/i18n.ts` | Add email/notification translations |
| `src/components/CreateFeedbackDialog.tsx` | Add email input + checkbox |
| `src/pages/AppFeedback.tsx` | Pass email data to mutation |
| `src/pages/FeedbackDetail.tsx` | Show email to admin |
| `src/hooks/useFeedback.ts` | Handle email in create, trigger notifications |
| `src/hooks/useComments.ts` | Trigger notification on admin comment |
| `supabase/functions/send-notification/index.ts` | Create edge function |
| `supabase/config.toml` | Create with function config |

---

## Security Notes

1. **Email never exposed publicly** - Only admins see submitter_email in the UI
2. **Notifications respect user preference** - Only sent if `notify_on_updates = true`
3. **Email validation** - Format validated client-side before submission
