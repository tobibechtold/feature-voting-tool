

# Email Notifications Implementation

## Prerequisites
You need to add the `RESEND_API_KEY` secret to your Supabase project before the edge function will work.

---

## Files to Create/Update

### 1. Edge Function: `supabase/functions/send-notification/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationRequest {
  type: "new_feedback" | "status_change" | "admin_comment";
  feedback: {
    id: string;
    type: "feature" | "bug";
    title: string;
    status?: string;
    submitter_email?: string | null;
    notify_on_updates?: boolean;
  };
  appName: string;
  appSlug: string;
  comment?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, feedback, appName, appSlug, comment }: NotificationRequest = await req.json();
    const feedbackUrl = `https://featurevoting.tobibechtold.dev/app/${appSlug}/feedback/${feedback.id}`;
    const feedbackTypeLabel = feedback.type === "feature" ? "Feature Request" : "Bug Report";

    let emailResponse;

    if (type === "new_feedback") {
      // Always notify admin about new feedback
      emailResponse = await resend.emails.send({
        from: "Feature Vote <noreply@tobibechtold.dev>",
        to: ["support@tobibechtold.dev"],
        subject: `New ${feedbackTypeLabel}: ${feedback.title}`,
        html: `
          <h2>New ${feedbackTypeLabel} for ${appName}</h2>
          <p><strong>Title:</strong> ${feedback.title}</p>
          ${feedback.submitter_email ? `<p><strong>Submitter Email:</strong> ${feedback.submitter_email}</p>` : ""}
          <p><a href="${feedbackUrl}">View Feedback</a></p>
        `,
      });
    } else if (type === "status_change" && feedback.notify_on_updates && feedback.submitter_email) {
      // Notify user about status change (only if they opted in)
      const statusLabels: Record<string, string> = {
        open: "Open",
        planned: "Planned",
        progress: "In Progress",
        completed: "Completed",
      };
      const statusLabel = statusLabels[feedback.status || "open"] || feedback.status;

      emailResponse = await resend.emails.send({
        from: "Feature Vote <noreply@tobibechtold.dev>",
        to: [feedback.submitter_email],
        subject: `Your ${feedbackTypeLabel.toLowerCase()} is now ${statusLabel}`,
        html: `
          <h2>Status Update</h2>
          <p>Your ${feedbackTypeLabel.toLowerCase()} "<strong>${feedback.title}</strong>" has been updated.</p>
          <p><strong>New Status:</strong> ${statusLabel}</p>
          <p><a href="${feedbackUrl}">View Details</a></p>
        `,
      });
    } else if (type === "admin_comment" && feedback.notify_on_updates && feedback.submitter_email) {
      // Notify user about admin comment (only if they opted in)
      emailResponse = await resend.emails.send({
        from: "Feature Vote <noreply@tobibechtold.dev>",
        to: [feedback.submitter_email],
        subject: `Admin replied to your ${feedbackTypeLabel.toLowerCase()}`,
        html: `
          <h2>New Reply</h2>
          <p>An admin has replied to your ${feedbackTypeLabel.toLowerCase()} "<strong>${feedback.title}</strong>".</p>
          ${comment ? `<blockquote style="border-left: 3px solid #ccc; padding-left: 12px; margin: 16px 0;">${comment}</blockquote>` : ""}
          <p><a href="${feedbackUrl}">View Conversation</a></p>
        `,
      });
    } else {
      // No notification needed
      return new Response(JSON.stringify({ message: "No notification sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
```

### 2. Edge Function Config: `supabase/config.toml`

```toml
[functions.send-notification]
verify_jwt = false
```

---

### 3. Update Types: `src/types/database.ts`

Add to the `feedback` table types:
- **Row**: `submitter_email: string | null`, `notify_on_updates: boolean`
- **Insert**: `submitter_email?: string | null`, `notify_on_updates?: boolean`
- **Update**: `submitter_email?: string | null`, `notify_on_updates?: boolean`

### 4. Update Types: `src/types/index.ts`

Add to `FeedbackItem` interface:
```typescript
submitter_email?: string | null;
notify_on_updates?: boolean;
```

---

### 5. Update Translations: `src/lib/i18n.ts`

Add these keys to both `en` and `de`:

**English:**
```typescript
emailOptional: 'Email (optional)',
emailPlaceholder: 'your@email.com',
notifyOnUpdates: 'Notify me about status changes and replies',
submitterEmail: 'Submitter Email',
```

**German:**
```typescript
emailOptional: 'E-Mail (optional)',
emailPlaceholder: 'deine@email.de',
notifyOnUpdates: 'Bei Statusänderungen und Antworten benachrichtigen',
submitterEmail: 'E-Mail des Einreichers',
```

---

### 6. Update `src/components/CreateFeedbackDialog.tsx`

- Add `email` state (string, default empty)
- Add `notifyOnUpdates` state (boolean, default true)
- Add email input field after description
- Add checkbox (only visible when email is entered)
- Update `onSubmit` prop signature: `email?: string`, `notifyOnUpdates?: boolean`
- Validate email format when provided

---

### 7. Update `src/hooks/useFeedback.ts`

**`useCreateFeedback`:**
- Accept `submitter_email` and `notify_on_updates` in mutation input
- After successful creation, call edge function with `type: "new_feedback"`

**`useUpdateFeedbackStatus`:**
- After status update, call edge function with `type: "status_change"`

---

### 8. Update `src/hooks/useComments.ts`

**`useCreateComment`:**
- After admin comment creation, fetch parent feedback
- If `is_admin` and feedback has email + notify_on_updates, call edge function with `type: "admin_comment"`

---

### 9. Update `src/pages/AppFeedback.tsx`

Update `handleCreateFeedback` to pass email and notifyOnUpdates:
```typescript
const handleCreateFeedback = async (data: { 
  title: string; 
  description: string; 
  type: FeedbackType;
  email?: string;
  notifyOnUpdates?: boolean;
}) => {
  // ... pass to mutation
};
```

---

### 10. Update `src/pages/FeedbackDetail.tsx`

When admin is viewing and `submitter_email` exists, show it below the description as a `mailto` link.

---

## Notification Flow Summary

| Event | Admin Email | User Email |
|-------|-------------|------------|
| New feedback | Always sent to support@tobibechtold.dev | Never |
| Status change | Never | Only if `notify_on_updates = true` |
| Admin comment | Never | Only if `notify_on_updates = true` |

---

## Next Step

Please provide your **RESEND_API_KEY** so I can add it to your secrets and implement all these changes.

