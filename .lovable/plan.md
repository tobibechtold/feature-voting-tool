
# Admin Features Enhancement Plan

## Overview
This plan adds three key admin capabilities:
1. **Delete user feedback** - Allow admins to remove inappropriate or duplicate feedback
2. **App logo upload** - Enable admins to upload custom logos for each app
3. **Enhanced admin experience** - Status change and commenting already exist, but we'll improve the workflow

## Current State Analysis

**Already implemented:**
- Admin can change feedback status (via `StatusSelect` in `FeedbackDetail.tsx`)
- Admin can comment on feedback (via comment form in `FeedbackDetail.tsx`)

**Needs to be added:**
- Delete feedback button for admins
- Logo upload for apps
- Storage bucket for logos

---

## Implementation Details

### 1. Delete Feedback Feature

**Database Changes:**
No schema changes needed - the existing RLS policies allow admins to delete feedback.

**Frontend Changes:**

**File: `src/hooks/useFeedback.ts`**
- Add a new `useDeleteFeedback` mutation hook that calls `supabase.from('feedback').delete()`

**File: `src/pages/FeedbackDetail.tsx`**
- Add a delete button (Trash icon) visible only to admins
- Add a confirmation dialog before deletion
- On successful deletion, redirect back to the app feedback list

**File: `src/lib/i18n.ts`**
- Add translations: `deleteFeedback`, `feedbackDeleted`, `confirmDeleteFeedback`

---

### 2. App Logo Upload Feature

**Database Changes (SQL Migration):**
```sql
-- Add logo_url column to apps table
ALTER TABLE public.apps ADD COLUMN logo_url text;

-- Create storage bucket for app logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-logos', 'app-logos', true);

-- Allow anyone to view logos (public bucket)
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-logos');

-- Only admins can upload/update/delete logos
CREATE POLICY "Admins can manage logos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'app-logos' 
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'app-logos' 
  AND public.has_role(auth.uid(), 'admin')
);
```

**Type Updates:**

**File: `src/types/index.ts`**
- Add `logo_url: string | null` to `App` interface

**File: `src/types/database.ts`**
- Add `logo_url` to apps table Row, Insert, and Update types

**New Hook:**

**File: `src/hooks/useStorage.ts`**
- Create `useUploadLogo` hook for uploading images to Supabase Storage
- Handle file upload, generate public URL, return the URL

**Update Hooks:**

**File: `src/hooks/useApps.ts`**
- Update `useCreateApp` to accept optional `logo_url`
- Update `useUpdateApp` to accept optional `logo_url`

**Admin UI Updates:**

**File: `src/pages/Admin.tsx`**
- Add logo upload field to the create/edit app dialog
- Show image preview when editing an existing app with a logo
- Add a "Remove logo" option
- Display logo thumbnails in the apps table

**Display Updates:**

**File: `src/components/AppCard.tsx`**
- If `logo_url` exists, display the logo image
- Otherwise, fall back to the current initial letter display

**File: `src/pages/AppFeedback.tsx`**
- Display app logo next to the app name in the header

**Translations:**

**File: `src/lib/i18n.ts`**
- Add: `appLogo`, `uploadLogo`, `removeLogo`, `logoUploaded`

---

### 3. Summary of File Changes

| File | Changes |
|------|---------|
| `src/hooks/useFeedback.ts` | Add `useDeleteFeedback` hook |
| `src/hooks/useStorage.ts` | New file - logo upload functionality |
| `src/hooks/useApps.ts` | Update mutations for `logo_url` |
| `src/pages/FeedbackDetail.tsx` | Add delete button with confirmation |
| `src/pages/Admin.tsx` | Add logo upload UI to app dialog |
| `src/components/AppCard.tsx` | Display app logo if available |
| `src/pages/AppFeedback.tsx` | Display logo in header |
| `src/types/index.ts` | Add `logo_url` to App interface |
| `src/types/database.ts` | Add `logo_url` to database types |
| `src/lib/i18n.ts` | Add new translations |

---

## User Actions Required

After implementation, you'll need to run the following SQL in your Supabase SQL Editor:

```sql
-- Add logo_url column to apps table
ALTER TABLE public.apps ADD COLUMN logo_url text;

-- Create storage bucket for app logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-logos', 'app-logos', true);

-- Allow anyone to view logos (public bucket)
CREATE POLICY "Public can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-logos');

-- Only admins can manage logos
CREATE POLICY "Admins can manage logos"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'app-logos' 
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'app-logos' 
  AND public.has_role(auth.uid(), 'admin')
);
```

---

## Visual Flow

```text
+------------------+     +-------------------+     +------------------+
| Admin Dashboard  | --> | Create/Edit App   | --> | Upload Logo      |
| (Manage Apps)    |     | Dialog            |     | (Supabase Storage)|
+------------------+     +-------------------+     +------------------+
                                 |
                                 v
                         +-------------------+
                         | App Card          |
                         | (Shows Logo)      |
                         +-------------------+
                                 |
                                 v
                         +-------------------+
                         | Feedback Detail   |
                         | + Delete Button   |
                         +-------------------+
```
