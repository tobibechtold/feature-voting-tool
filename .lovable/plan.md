
# Multiple Screenshot Attachments for Feedback

Allow users to attach up to 5 screenshots when submitting a feature request or bug report. Images are stored in Supabase Storage and displayed on the feedback detail page.

## What Changes

1. **New database table** -- A `feedback_attachments` table (instead of a single column) to store multiple image URLs per feedback item
2. **New storage bucket** -- A `feedback-attachments` public bucket for uploaded images
3. **Upload hook** -- New `useUploadScreenshot` in `useStorage.ts`
4. **Feedback form** -- File picker supporting multiple images with previews (max 5, max 5MB each)
5. **Feedback submission flow** -- Upload files after creating the feedback row, then insert attachment records
6. **Feedback detail page** -- Display all attached screenshots in a grid below the description
7. **Translations** -- New strings for EN and DE

## Technical Details

### 1. SQL Migration

```sql
-- New table for multiple attachments
CREATE TABLE public.feedback_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE public.feedback_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read feedback attachments"
ON public.feedback_attachments FOR SELECT TO public USING (true);

CREATE POLICY "Public insert feedback attachments"
ON public.feedback_attachments FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Admin delete feedback attachments"
ON public.feedback_attachments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', true);

CREATE POLICY "Public read feedback attachment files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'feedback-attachments');

CREATE POLICY "Public upload feedback attachment files"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'feedback-attachments');

CREATE POLICY "Admin delete feedback attachment files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'feedback-attachments');
```

### 2. Type Updates

- **`src/types/database.ts`** -- Add `feedback_attachments` table definition
- **`src/types/index.ts`** -- Add `FeedbackAttachment` interface

### 3. Upload Hook (`src/hooks/useStorage.ts`)

Add `useUploadFeedbackScreenshot` that uploads a file to `feedback-attachments/{feedbackId}-{index}-{timestamp}.{ext}` and returns the public URL.

### 4. Attachments Hook (new `src/hooks/useAttachments.ts`)

- `useAttachments(feedbackId)` -- Fetch all attachments for a feedback item
- `useCreateAttachments()` -- Insert multiple attachment records after upload
- `useDeleteAttachment()` -- Admin-only deletion

### 5. Create Feedback Dialog (`src/components/CreateFeedbackDialog.tsx`)

- Add a file input accepting multiple images (accept: `image/*`)
- Max 5 files, max 5MB each -- validate on selection
- Show thumbnail previews in a horizontal row with remove buttons
- Pass `File[]` array through `onSubmit`

### 6. Feedback Submission (`src/hooks/useFeedback.ts`)

- Extend `CreateFeedbackInput` to accept optional `screenshots: File[]`
- After inserting the feedback row, upload all files in parallel, then batch-insert attachment records

### 7. Feedback Detail Page (`src/pages/FeedbackDetail.tsx`)

- Fetch attachments using `useAttachments(id)`
- Display screenshots in a responsive grid below the description
- Each image is clickable to open full-size in a new tab
- Admin users see a delete button on each image

### 8. Translations (`src/lib/i18n.ts`)

| Key | EN | DE |
|-----|----|----|
| `attachScreenshots` | Attach screenshots | Screenshots anhangen |
| `removeScreenshot` | Remove | Entfernen |
| `maxFiles` | Max 5 images, 5MB each | Max 5 Bilder, je 5MB |
| `screenshotDeleted` | Screenshot deleted | Screenshot geloscht |

### Files to Create/Modify

- **New**: `src/hooks/useAttachments.ts`
- **New**: SQL migration for `feedback_attachments` table + storage bucket
- **Modify**: `src/types/database.ts`, `src/types/index.ts`
- **Modify**: `src/hooks/useStorage.ts`
- **Modify**: `src/hooks/useFeedback.ts`
- **Modify**: `src/components/CreateFeedbackDialog.tsx`
- **Modify**: `src/pages/FeedbackDetail.tsx`
- **Modify**: `src/lib/i18n.ts`
