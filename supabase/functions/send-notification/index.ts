import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { buildNotificationEmail, type NotificationRequest } from "./emails.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const NOTIFICATION_FROM_EMAIL = Deno.env.get("NOTIFICATION_FROM_EMAIL");
const NOTIFICATION_FROM_NAME = Deno.env.get("NOTIFICATION_FROM_NAME") ?? "Feature Vote";
const ADMIN_NOTIFICATION_EMAIL = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL");

if (!RESEND_API_KEY) {
  throw new Error("Missing RESEND_API_KEY environment variable");
}

if (!NOTIFICATION_FROM_EMAIL) {
  throw new Error("Missing NOTIFICATION_FROM_EMAIL environment variable");
}

if (!ADMIN_NOTIFICATION_EMAIL) {
  throw new Error("Missing ADMIN_NOTIFICATION_EMAIL environment variable");
}

if (!APP_BASE_URL) {
  throw new Error("Missing APP_BASE_URL environment variable");
}

const NOTIFICATION_FROM = `${NOTIFICATION_FROM_NAME} <${NOTIFICATION_FROM_EMAIL}>`;

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const notification: NotificationRequest = await req.json();
    const email = buildNotificationEmail(notification, {
      baseUrl: APP_BASE_URL,
      adminEmail: ADMIN_NOTIFICATION_EMAIL,
    });

    if (!email) {
      // No notification needed
      return new Response(JSON.stringify({ message: "No notification sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const emailResponse = await sendEmail({ from: NOTIFICATION_FROM, ...email });

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
