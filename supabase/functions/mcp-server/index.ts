import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { StreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/streamableHttp.js";
import { toFetchResponse, toReqRes } from "npm:fetch-to-node@^2.1.0";
import { z } from "npm:zod@^3.24.0";
import { extractBearerToken, sha256Hex } from "./auth.ts";
import {
  addComment,
  getFeedback,
  getVersionPlan,
  listApps,
  listFeedback,
  updateStatus,
  type ToolOutcome,
} from "./tools.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FEEDBACK_STATUSES = ["open", "planned", "progress", "completed", "wont_do"] as const;
const FEEDBACK_TYPES = ["feature", "bug"] as const;

async function sendNotificationPayload(payload: unknown): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`send-notification failed: ${response.status}`);
  }
}

function toToolResult(outcome: ToolOutcome) {
  if (!outcome.ok) {
    return { content: [{ type: "text" as const, text: outcome.error }], isError: true };
  }
  return { content: [{ type: "text" as const, text: JSON.stringify(outcome.data, null, 2) }] };
}

function buildServer(
  dataClient: ReturnType<typeof createClient>,
  serviceClient: ReturnType<typeof createClient>
): McpServer {
  const server = new McpServer({ name: "feature-voting-tool", version: "1.0.0" });

  server.registerTool(
    "list_apps",
    {
      description: "List all apps in the feedback tool with their slugs and platforms. Use the slug as the 'app' argument for other tools.",
      inputSchema: {},
    },
    async () => toToolResult(await listApps(dataClient))
  );

  server.registerTool(
    "get_version_plan",
    {
      description: "Get everything planned or released for one version of an app: release title/notes, per-platform release status, and every bug/feature assigned to the version with full descriptions.",
      inputSchema: {
        app: z.string().describe("App slug (see list_apps)"),
        version: z.string().describe("Semver of the release, e.g. '1.3.0'"),
      },
    },
    async ({ app, version }: { app: string; version: string }) =>
      toToolResult(await getVersionPlan(dataClient, app, version))
  );

  server.registerTool(
    "list_feedback",
    {
      description: "List feedback items (bugs and feature requests) for an app with full descriptions, newest first. Useful for scanning for duplicates or already-fixed bugs.",
      inputSchema: {
        app: z.string().describe("App slug (see list_apps)"),
        status: z.enum(FEEDBACK_STATUSES).optional().describe("Filter by status"),
        type: z.enum(FEEDBACK_TYPES).optional().describe("Filter by type"),
      },
    },
    async ({ app, status, type }: { app: string; status?: string; type?: string }) =>
      toToolResult(await listFeedback(dataClient, app, { status, type }))
  );

  server.registerTool(
    "get_feedback",
    {
      description: "Get one feedback item by id, including its comments and attachment image URLs.",
      inputSchema: {
        id: z.string().uuid().describe("Feedback item id"),
      },
    },
    async ({ id }: { id: string }) => toToolResult(await getFeedback(dataClient, id))
  );

  server.registerTool(
    "update_status",
    {
      description: "Change the status of a feedback item. Sends the same status-change email to opted-in submitters as the admin UI. Returns the updated item and whether a notification was sent.",
      inputSchema: {
        id: z.string().uuid().describe("Feedback item id"),
        status: z.enum(FEEDBACK_STATUSES).describe("New status"),
      },
    },
    async ({ id, status }: { id: string; status: string }) =>
      toToolResult(await updateStatus(serviceClient, id, status, sendNotificationPayload))
  );

  server.registerTool(
    "add_comment",
    {
      description: "Post an admin comment on a feedback item (e.g. explain a fix or ask the reporter a question). Sends the same emails to opted-in submitters/commenters as admin comments from the UI.",
      inputSchema: {
        id: z.string().uuid().describe("Feedback item id"),
        content: z.string().describe("Comment text (max 5000 characters)"),
      },
    },
    async ({ id, content }: { id: string; content: string }) =>
      toToolResult(await addComment(serviceClient, id, content, sendNotificationPayload))
  );

  return server;
}

function unauthorized(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: provide a valid API token as 'Authorization: Bearer fvt_...'" },
      id: null,
    }),
    { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token || !token.startsWith("fvt_")) return unauthorized();

    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const tokenHash = await sha256Hex(token);
    const { data: tokenRow, error: tokenError } = await service
      .from("api_tokens")
      .select("id")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (tokenError || !tokenRow) return unauthorized();

    try {
      await service
        .from("api_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);
    } catch (_err) {
      // Best effort only; auth already succeeded.
    }

    // Parse the body BEFORE toReqRes so the request stream is not consumed
    // twice; handleRequest accepts the pre-parsed body as its third argument.
    const body = await req.json();
    const { req: nodeReq, res: nodeRes } = toReqRes(req);

    const dataClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const server = buildServer(dataClient, service);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    await transport.handleRequest(nodeReq, nodeRes, body);

    const response = await toFetchResponse(nodeRes);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    console.error("Error in mcp-server function:", error);
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
