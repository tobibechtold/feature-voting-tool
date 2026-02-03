

# User Comments with Invisible reCAPTCHA and Email

## Overview

Enable regular users to submit comments on feedback items by requiring:
1. **Email address** - For accountability and enabling reply notifications
2. **Invisible reCAPTCHA v3** - Runs silently in background for spam protection
3. **Notification on admin reply** - Email users when admin responds to their comment

Currently, only admins can comment. This change opens commenting to all users with appropriate safeguards.

---

## User Experience Flow

```text
User views feedback detail page
         |
         v
+-------------------+
| Comment form      |
| - Email input     |
| - Comment text    |
| - Checkbox:       |
|   "Notify me of   |
|    replies"       |
+-------------------+
         |
         v
User clicks Submit
         |
         v
Invisible reCAPTCHA v3 runs in background
         |
         v
Token + comment sent to edge function
         |
         v
Edge function verifies reCAPTCHA token
         |
    [Score > 0.5?]
    /           \
  Yes            No
   |              |
   v              v
Save comment   Reject as spam
   |
   v
Admin replies later -> User gets email notification
```

---

## What You Need to Do

### Get a reCAPTCHA Site Key

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Click "+" to create a new site
3. Choose **reCAPTCHA v3** (invisible)
4. Add your domains:
   - `localhost` (for development)
   - `app-applaud.lovable.app`
   - `id-preview--214a6b75-2094-4a38-a61e-1313472729f6.lovable.app`
5. Copy the **Site Key** (public) and **Secret Key** (private)

I will ask you to provide the **Secret Key** as a secure secret (it will be stored encrypted and used only in the edge function).

---

## Technical Implementation

### 1. Database Schema Changes

Add new columns to the `comments` table to store commenter info:

```sql
ALTER TABLE comments 
ADD COLUMN commenter_email TEXT,
ADD COLUMN notify_on_reply BOOLEAN DEFAULT false;
```

### 2. Type Updates

Update the Comment interface and database types to include the new fields.

### 3. Frontend: User Comment Form

Modify `FeedbackDetail.tsx` to show a comment form for non-admin users:
- Email input field (required)
- Comment textarea (required)
- "Notify me when admin replies" checkbox
- reCAPTCHA v3 integration (runs invisibly on submit)

### 4. reCAPTCHA v3 Integration

Install the `react-google-recaptcha-v3` package and wrap the app with the reCAPTCHA provider. On form submission, get a token and send it with the comment.

### 5. Edge Function: Verify reCAPTCHA

Create or update an edge function to:
1. Receive the comment data + reCAPTCHA token
2. Verify the token with Google's API using the secret key
3. Check the score (v3 returns 0.0-1.0; reject if < 0.5)
4. If valid, insert the comment into the database
5. Return success/failure

### 6. Notification for User Comments

Update the `send-notification` edge function to handle a new notification type: `user_comment_reply`. When an admin replies to a user comment where `notify_on_reply` is true, send an email notification.

### 7. Translation Keys

Add new i18n keys for:
- `yourEmail`: "Your email"
- `notifyOnReply`: "Notify me when an admin replies"
- `captchaFailed`: "Verification failed. Please try again."
- `commentSubmitted`: "Comment submitted successfully"

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify | Add commenter_email, notify_on_reply to Comment |
| `src/types/database.ts` | Modify | Update comments table type |
| `src/hooks/useComments.ts` | Modify | Accept user comment data, call edge function |
| `src/pages/FeedbackDetail.tsx` | Modify | Add comment form for non-admin users |
| `src/lib/i18n.ts` | Modify | Add new translation keys |
| `src/main.tsx` or `src/App.tsx` | Modify | Wrap with GoogleReCaptchaProvider |
| `supabase/functions/verify-comment/index.ts` | Create | Verify reCAPTCHA and insert comment |
| `supabase/functions/send-notification/index.ts` | Modify | Handle reply notifications to commenters |
| Database | Migration | Add columns to comments table |

---

## Security Considerations

- reCAPTCHA secret key stored securely in Supabase secrets
- Score threshold (0.5) prevents most bot submissions
- Email validation on both client and server side
- Content length limits to prevent abuse

