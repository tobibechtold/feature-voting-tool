
# Version Numbers, Changelog, and Completed Items Styling

## Overview

This plan adds three key features:
1. **Version field on feedback items** - Admins can assign a semantic version (e.g., `1.2.0`) to bugs/features
2. **Changelog page per app** - Shows feedback grouped by version, newest first
3. **Completed items styling** - Grey out completed feedback and move them to the bottom of the list

---

## 1. Database Changes

### Add `version` column to feedback table

Create a migration to add a nullable `version` column:

```sql
ALTER TABLE feedback 
ADD COLUMN version TEXT DEFAULT NULL;
```

This allows admins to optionally assign versions like `1.0.0`, `2.1.3`, etc.

---

## 2. Type Updates

### File: `src/types/index.ts`

Add `version` field to `FeedbackItem`:

```typescript
export interface FeedbackItem {
  id: string;
  app_id: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  vote_count: number;
  created_at: string;
  submitter_email?: string | null;
  notify_on_updates?: boolean;
  version?: string | null;  // NEW
}
```

### File: `src/types/database.ts`

Update the `feedback` table types to include `version`:

```typescript
feedback: {
  Row: {
    // ... existing fields
    version: string | null
  }
  Insert: {
    // ... existing fields
    version?: string | null
  }
  Update: {
    // ... existing fields
    version?: string | null
  }
}
```

---

## 3. Admin Version Assignment

### File: `src/pages/FeedbackDetail.tsx`

Add a version input field visible only to admins, positioned near the status selector:

- Text input with placeholder "e.g., 1.2.0"
- Save button to update the version
- Shows the current version if set

### File: `src/hooks/useFeedback.ts`

Add a new mutation `useUpdateFeedbackVersion`:

```typescript
export function useUpdateFeedbackVersion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: string | null }) => {
      const { data, error } = await supabase
        .from('feedback')
        .update({ version })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}
```

---

## 4. Feedback List Sorting (Completed at Bottom)

### File: `src/pages/AppFeedback.tsx`

Update the `filteredFeedback` useMemo to:
1. Keep current filters
2. Sort so completed items appear at the bottom
3. Within each group, maintain vote count ordering

```typescript
const filteredFeedback = useMemo(() => {
  if (!feedback) return [];
  
  let items = [...feedback];
  
  // Apply type filter
  if (filterType !== 'all') {
    items = items.filter((f) => f.type === filterType);
  }
  
  // Apply status filter
  if (filterStatus.length > 0) {
    items = items.filter((f) => filterStatus.includes(f.status));
  }
  
  // Sort: non-completed first (by votes), then completed (by votes)
  items.sort((a, b) => {
    const aCompleted = a.status === 'completed';
    const bCompleted = b.status === 'completed';
    
    if (aCompleted !== bCompleted) {
      return aCompleted ? 1 : -1; // Completed at bottom
    }
    return b.vote_count - a.vote_count; // Within group, sort by votes
  });
  
  return items;
}, [feedback, filterType, filterStatus]);
```

### File: `src/components/FeedbackCard.tsx`

Add opacity styling for completed items:

```typescript
<Card className={cn(
  "group transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20",
  item.status === 'completed' && "opacity-60"
)}>
```

---

## 5. Changelog Page

### New File: `src/pages/Changelog.tsx`

Create a new changelog page that:
- Fetches all feedback for the app that has a version assigned
- Groups items by version
- Sorts versions using semantic versioning (newest first)
- Shows features and bugs within each version

```text
URL: /app/:slug/changelog

Structure:
- Header with app name
- List of versions (newest first)
  - v2.1.0
    - [Feature] New dashboard layout
    - [Bug] Fixed login issue
  - v2.0.0
    - [Feature] Dark mode
    - ...
```

### Semantic Version Sorting

Use a helper function to parse and compare semver strings:

```typescript
function compareVersions(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const parts = v.replace(/^v/, '').split('.').map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
  };
  
  const vA = parseVersion(a);
  const vB = parseVersion(b);
  
  if (vA.major !== vB.major) return vB.major - vA.major;
  if (vA.minor !== vB.minor) return vB.minor - vA.minor;
  return vB.patch - vA.patch;
}
```

### New Hook: `src/hooks/useChangelog.ts`

Fetch feedback items that have a version assigned:

```typescript
export function useChangelog(appId: string | undefined) {
  return useQuery({
    queryKey: ['changelog', appId],
    queryFn: async () => {
      if (!appId) return [];
      
      const { data, error } = await publicSupabase
        .from('feedback')
        .select('*')
        .eq('app_id', appId)
        .not('version', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as FeedbackItem[];
    },
    enabled: !!appId,
  });
}
```

---

## 6. Add Changelog Link

### File: `src/pages/AppFeedback.tsx`

Add a "Changelog" link button next to the feature/bug request buttons:

```typescript
<Button variant="outline" asChild>
  <Link to={`/app/${slug}/changelog`}>
    <FileText className="h-4 w-4 mr-2" />
    {t('changelog')}
  </Link>
</Button>
```

### File: `src/App.tsx`

Add the new route:

```typescript
<Route path="/app/:slug/changelog" element={<Changelog />} />
```

---

## 7. Translation Updates

### File: `src/lib/i18n.ts`

Add new translation keys:

| Key | English | German |
|-----|---------|--------|
| `changelog` | Changelog | Changelog |
| `version` | Version | Version |
| `versionPlaceholder` | e.g., 1.2.0 | z.B. 1.2.0 |
| `setVersion` | Set Version | Version setzen |
| `noVersionedItems` | No versioned items yet | Noch keine versionierten Eintraege |
| `includedInVersion` | Included in version | Enthalten in Version |

---

## Summary of Files to Change

| File | Changes |
|------|---------|
| Database migration | Add `version` column |
| `src/types/index.ts` | Add `version` to `FeedbackItem` |
| `src/types/database.ts` | Add `version` to table types |
| `src/hooks/useFeedback.ts` | Add `useUpdateFeedbackVersion` mutation |
| `src/hooks/useChangelog.ts` | New hook for changelog data |
| `src/pages/FeedbackDetail.tsx` | Add version input for admins |
| `src/pages/AppFeedback.tsx` | Sort completed to bottom, add changelog link |
| `src/pages/Changelog.tsx` | New changelog page |
| `src/components/FeedbackCard.tsx` | Grey out completed items |
| `src/App.tsx` | Add changelog route |
| `src/lib/i18n.ts` | Add translations |

---

## Visual Preview

### FeedbackCard (completed item)
```text
+------------------------------------------+
| [23] [Feature] [Completed]     opacity:60%
|      Dark mode support                   |
|      Add dark mode to the app...         |
+------------------------------------------+
```

### Changelog Page
```text
Changelog - MyApp

v2.1.0
  [Feature] New dashboard layout
  [Bug] Fixed login redirect

v2.0.0  
  [Feature] Dark mode support
  [Feature] Multi-language support
  [Bug] Fixed voting race condition
```

### Version Input (Admin only, on FeedbackDetail)
```text
+-------------------+  +--------+
| 1.2.0             |  |  Save  |
+-------------------+  +--------+
```
