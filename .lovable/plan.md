
# Required Email and Editable Changelog with Release Dates

## Overview

This plan implements two features:
1. **Make email required** when submitting feedback/bugs
2. **Add release date/status to versions** with admin editing capability on the changelog page

---

## Part 1: Make Email Required

### Changes to `src/components/CreateFeedbackDialog.tsx`

**Update email validation logic:**
- Remove the "empty is valid" check since email is now required
- Update the submit button to also check for valid email
- Always show the notification checkbox (no longer conditional on email)

**Specific changes:**
- Line 46-48: Update `isValidEmail` to require a non-empty email
- Line 53: Add email validation to the form submit check
- Line 142: Change label from `emailOptional` to `email`
- Line 143: Add `required` attribute to the email input
- Line 152-166: Remove the conditional wrapper around the checkbox (always show it)
- Line 179: Update disabled check to include email validation

### Changes to `src/lib/i18n.ts`

**Update translation keys:**
- Change `emailOptional` to `emailRequired` with values:
  - EN: "Email"
  - DE: "E-Mail"

---

## Part 2: Changelog Version Release Dates

### Database Changes

**Add new table `version_releases`:**

```sql
CREATE TABLE version_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  released_at DATE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(app_id, version)
);

-- Enable RLS
ALTER TABLE version_releases ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Anyone can read version releases"
  ON version_releases FOR SELECT USING (true);

-- Allow admins to insert/update/delete
CREATE POLICY "Admins can manage version releases"
  ON version_releases FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
```

### Type Updates

**New file or update `src/types/index.ts`:**

```typescript
export interface VersionRelease {
  id: string;
  app_id: string;
  version: string;
  released_at: string | null;  // Date string or null for unreleased
  created_at: string;
}
```

**Update `src/types/database.ts`:**

Add the `version_releases` table type definition.

### New Hook: `src/hooks/useVersionReleases.ts`

```typescript
// Fetch version releases for an app
export function useVersionReleases(appId: string | undefined)

// Update or create a version release (upsert)
export function useUpsertVersionRelease()
```

### Changes to `src/pages/Changelog.tsx`

**Add admin editing capabilities:**

1. Import the new hook and admin context
2. For each version card, show:
   - Released date if set (e.g., "Released: January 15, 2025")
   - "Unreleased" badge if no date
   - Admin-only edit button to set/change release date

**UI for admin editing:**
- Click to edit release date
- Date picker or text input for date
- "Unreleased" checkbox option
- Save/Cancel buttons

**Visual structure:**

```text
v2.1.0                          [Edit] (admin only)
Released: February 1, 2025
-----------------------------------
  [Feature] New dashboard layout
  [Bug] Fixed login redirect

v2.0.0                          [Edit] (admin only)
Unreleased
-----------------------------------
  [Feature] Dark mode support
```

### Translation Updates in `src/lib/i18n.ts`

| Key | English | German |
|-----|---------|--------|
| `emailRequired` | Email | E-Mail |
| `released` | Released | Veröffentlicht |
| `unreleased` | Unreleased | Unveröffentlicht |
| `releaseDate` | Release Date | Veröffentlichungsdatum |
| `setReleaseDate` | Set Release Date | Veröffentlichungsdatum setzen |
| `markAsUnreleased` | Mark as Unreleased | Als unveröffentlicht markieren |

---

## Summary of Files to Change

| File | Changes |
|------|---------|
| Database migration | Create `version_releases` table |
| `src/types/index.ts` | Add `VersionRelease` interface |
| `src/types/database.ts` | Add `version_releases` table types |
| `src/hooks/useVersionReleases.ts` | New hook for version release data |
| `src/components/CreateFeedbackDialog.tsx` | Make email required |
| `src/pages/Changelog.tsx` | Add release date display and admin editing |
| `src/lib/i18n.ts` | Add new translation keys |

---

## Visual Preview

### Feedback Dialog (Email Required)
```text
+-------------------------------------+
| Title*                              |
| [________________________]          |
|                                     |
| Description*                        |
| [________________________]          |
|                                     |
| Email*                              |
| [your@email.com___________]         |
|                                     |
| [x] Notify me about status changes  |
|                                     |
|              [Cancel] [Submit]      |
+-------------------------------------+
```

### Changelog Page (Admin View)
```text
Changelog - MyApp

+----------------------------------------+
| v2.1.0                        [Edit]   |
| Released: February 1, 2025             |
|----------------------------------------|
| [Feature] New dashboard layout         |
| [Bug] Fixed login redirect             |
+----------------------------------------+

+----------------------------------------+
| v2.0.0                        [Edit]   |
| [Unreleased]                           |
|----------------------------------------|
| [Feature] Dark mode support            |
+----------------------------------------+
```

### Release Date Edit Mode
```text
+----------------------------------------+
| v2.1.0                                 |
| [x] Released  [2025-02-01____]         |
| [ ] Unreleased                         |
|                                        |
|                   [Cancel] [Save]      |
+----------------------------------------+
```
