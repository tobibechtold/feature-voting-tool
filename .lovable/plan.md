

# Fix Upvoting 409 Conflict Error

## Problem
When you try to upvote feedback, you're getting a **409 Conflict** error. This happens because:

1. The app tries to insert a duplicate vote into the database
2. The database has a unique constraint that prevents the same user from voting twice on the same feedback
3. The client-side "already voted" check can be stale or hasn't loaded yet

## Solution
Add a database check before inserting a vote to ensure the vote doesn't already exist. This prevents the 409 error even if the client-side state is out of sync.

---

## Changes Required

### File: `src/hooks/useFeedback.ts`

Update the `useVote` mutation to:
1. First check if a vote already exists in the database
2. Only insert if no existing vote is found
3. Handle the case gracefully if already voted

```text
Current flow:
  Click Vote -> Insert vote -> 409 Error (if duplicate)

New flow:
  Click Vote -> Check if vote exists -> If not, insert vote -> Success
                                     -> If yes, skip (no error)
```

**Code changes:**

```typescript
export function useVote() {
  const queryClient = useQueryClient();
  const voterId = getVoterId();
  
  return useMutation({
    mutationFn: async (feedbackId: string) => {
      // Check if already voted (fresh DB validation)
      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('feedback_id', feedbackId)
        .eq('voter_id', voterId)
        .maybeSingle();

      if (existingVote) {
        // Already voted - skip silently (not an error)
        return;
      }

      // Insert vote
      const { error: voteError } = await supabase
        .from('votes')
        .insert({ feedback_id: feedbackId, voter_id: voterId } as never);
      
      if (voteError) throw voteError;

      // Increment vote count
      const { data: feedback, error: fetchError } = await supabase
        .from('feedback')
        .select('vote_count')
        .eq('id', feedbackId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const feedbackData = feedback as { vote_count: number };

      const { error: updateError } = await supabase
        .from('feedback')
        .update({ vote_count: feedbackData.vote_count + 1 } as never)
        .eq('id', feedbackId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['votes'] });
    },
  });
}
```

---

## Summary

| File | Change |
|------|--------|
| `src/hooks/useFeedback.ts` | Add database check for existing vote before inserting |

This fix ensures that even if a user clicks the vote button multiple times, or if the client-side voted state is stale, the app will gracefully handle it without throwing errors.

