import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function sendEmail(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
}



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
      emailResponse = await sendEmail({
        from: "Feature Vote <noreply@featurevoting.tobibechtold.dev>",
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

      emailResponse = await sendEmail({
        from: "Feature Vote <noreply@featurevoting.tobibechtold.dev>",
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
      emailResponse = await sendEmail({
        from: "Feature Vote <noreply@featurevoting.tobibechtold.dev>",
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
