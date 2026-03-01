import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RECAPTCHA_SECRET_KEY = Deno.env.get("RECAPTCHA_SECRET_KEY");
const RECAPTCHA_MIN_SCORE = Number(Deno.env.get("RECAPTCHA_MIN_SCORE") ?? "0.5");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!RECAPTCHA_SECRET_KEY) {
  throw new Error("Missing RECAPTCHA_SECRET_KEY environment variable");
}

if (Number.isNaN(RECAPTCHA_MIN_SCORE) || RECAPTCHA_MIN_SCORE < 0 || RECAPTCHA_MIN_SCORE > 1) {
  throw new Error("RECAPTCHA_MIN_SCORE must be a number between 0 and 1");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyCommentRequest {
  feedback_id: string;
  content: string;
  commenter_email: string;
  notify_on_reply: boolean;
  recaptcha_token: string;
}

async function verifyRecaptcha(token: string): Promise<{ success: boolean; score: number }> {
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`,
  });

  const data = await response.json();
  return {
    success: data.success,
    score: data.score || 0,
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feedback_id, content, commenter_email, notify_on_reply, recaptcha_token }: VerifyCommentRequest = await req.json();

    // Validate required fields
    if (!feedback_id || !content?.trim() || !commenter_email?.trim() || !recaptcha_token) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(commenter_email.trim())) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate content length
    if (content.trim().length > 5000) {
      return new Response(
        JSON.stringify({ error: "Comment too long (max 5000 characters)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify reCAPTCHA
    const recaptchaResult = await verifyRecaptcha(recaptcha_token);

    if (!recaptchaResult.success || recaptchaResult.score < RECAPTCHA_MIN_SCORE) {
      console.log("reCAPTCHA failed:", recaptchaResult);
      return new Response(
        JSON.stringify({ error: "Verification failed", code: "CAPTCHA_FAILED" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("reCAPTCHA passed with score:", recaptchaResult.score);

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Insert the comment
    const { data, error } = await supabase
      .from("comments")
      .insert({
        feedback_id,
        content: content.trim(),
        is_admin: false,
        commenter_email: commenter_email.trim(),
        notify_on_reply,
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to save comment" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Comment saved:", data.id);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in verify-comment function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
