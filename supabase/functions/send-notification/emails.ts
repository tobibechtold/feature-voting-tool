// Pure email builder for send-notification. No Deno imports so Vitest can load it.
import { formatItemKey } from "../_shared/itemKey.ts";

export interface NotificationRequest {
  type: "new_feedback" | "status_change" | "admin_comment" | "admin_reply_to_comment";
  feedback: {
    id: string;
    type: "feature" | "bug";
    title: string;
    number?: number;
    status?: string;
    submitter_email?: string | null;
    notify_on_updates?: boolean;
  };
  appName: string;
  appSlug: string;
  appKey?: string;
  comment?: string;
  commenterEmail?: string;
}

export interface BuiltEmail {
  to: string[];
  subject: string;
  html: string;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  planned: "Planned",
  progress: "In Progress",
  completed: "Completed",
};

export function buildNotificationEmail(
  req: NotificationRequest,
  opts: { baseUrl: string; adminEmail: string },
): BuiltEmail | null {
  const { type, feedback, appName, appSlug, appKey, comment, commenterEmail } = req;
  const key =
    appKey && typeof feedback.number === "number"
      ? formatItemKey(appKey, feedback.number)
      : null;
  const feedbackUrl = `${opts.baseUrl.replace(/\/$/, "")}/app/${appSlug}/${key ?? feedback.id}`;
  const feedbackTypeLabel = feedback.type === "feature" ? "Feature Request" : "Bug Report";
  const typeLower = feedbackTypeLabel.toLowerCase();
  const titleText = key ? `${key}: ${feedback.title}` : feedback.title;
  const keySuffix = key ? ` ${key}` : "";

  if (type === "new_feedback") {
    return {
      to: [opts.adminEmail],
      subject: `${key ? `[${key}] ` : ""}New ${feedbackTypeLabel}: ${feedback.title}`,
      html: `
          <h2>New ${feedbackTypeLabel} for ${appName}</h2>
          <p><strong>Title:</strong> ${titleText}</p>
          ${feedback.submitter_email ? `<p><strong>Submitter Email:</strong> ${feedback.submitter_email}</p>` : ""}
          <p><a href="${feedbackUrl}">View Feedback</a></p>
        `,
    };
  }

  if (type === "status_change" && feedback.notify_on_updates && feedback.submitter_email) {
    const statusLabel = STATUS_LABELS[feedback.status || "open"] || feedback.status;
    return {
      to: [feedback.submitter_email],
      subject: `Your ${typeLower}${keySuffix} is now ${statusLabel}`,
      html: `
          <h2>Status Update</h2>
          <p>Your ${typeLower} "<strong>${titleText}</strong>" has been updated.</p>
          <p><strong>New Status:</strong> ${statusLabel}</p>
          <p><a href="${feedbackUrl}">View Details</a></p>
        `,
    };
  }

  if (type === "admin_comment" && feedback.notify_on_updates && feedback.submitter_email) {
    return {
      to: [feedback.submitter_email],
      subject: `Admin replied to your ${typeLower}${keySuffix}`,
      html: `
          <h2>New Reply</h2>
          <p>An admin has replied to your ${typeLower} "<strong>${titleText}</strong>".</p>
          ${comment ? `<blockquote style="border-left: 3px solid #ccc; padding-left: 12px; margin: 16px 0;">${comment}</blockquote>` : ""}
          <p><a href="${feedbackUrl}">View Conversation</a></p>
        `,
    };
  }

  if (type === "admin_reply_to_comment" && commenterEmail) {
    return {
      to: [commenterEmail],
      subject: `Admin replied on${keySuffix} "${feedback.title}"`,
      html: `
          <h2>New Reply</h2>
          <p>An admin has replied on the ${typeLower} "<strong>${titleText}</strong>" where you commented.</p>
          ${comment ? `<blockquote style="border-left: 3px solid #ccc; padding-left: 12px; margin: 16px 0;">${comment}</blockquote>` : ""}
          <p><a href="${feedbackUrl}">View Conversation</a></p>
        `,
    };
  }

  return null;
}
