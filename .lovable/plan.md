
# Fix Admin Login Redirect Issue

## Problem Analysis

After a successful login, users are being redirected back to the login page. This is caused by a **race condition** in the authentication flow:

1. User submits login credentials on `/login`
2. `signIn()` completes successfully
3. `navigate('/admin')` is called immediately
4. Admin page mounts and reads `isAdmin` which is still `false`
5. Admin page redirects to `/login` before the role check completes

The issue is that the `signIn` function in `useAuth.ts` only waits for Supabase authentication to complete, but doesn't wait for the admin role check that happens asynchronously in `onAuthStateChange`.

---

## Solution

Modify the `signIn` function in `useAuth.ts` to wait for the admin role check to complete after successful authentication. This ensures that when navigation to `/admin` happens, the `isAdmin` state is already set correctly.

---

## Changes Required

### File: `src/hooks/useAuth.ts`

**Current behavior:**
- `signIn` only returns after Supabase auth completes
- Admin role check happens asynchronously via `onAuthStateChange` (fire-and-forget)

**New behavior:**
- After successful authentication, explicitly wait for the admin role check
- Return the result including whether the user is an admin

```typescript
// Updated signIn function
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  // If login succeeded, wait for the admin role check
  if (!error && data.user) {
    const adminStatus = await checkAdminRole(data.user.id);
    setIsAdmin(adminStatus);
  }
  
  return { error };
};
```

This also requires moving the `checkAdminRole` helper function outside the `useEffect` so it can be called from `signIn`.

---

## Summary

| What | Change |
|------|--------|
| Problem | Race condition: navigation happens before `isAdmin` is set |
| Root cause | `signIn` doesn't wait for role check |
| Fix | Make `signIn` explicitly await the admin role check after auth |
| Files changed | `src/hooks/useAuth.ts` |

---

## Technical Details

The refactored `useAuth.ts` will:
1. Extract `checkAdminRole` to a stable reference (using `useCallback` or defined outside effect)
2. Have `signIn` call this function directly and await it
3. Set `isAdmin` state before returning from `signIn`
4. Keep the `onAuthStateChange` listener for handling session restoration and sign-out events
