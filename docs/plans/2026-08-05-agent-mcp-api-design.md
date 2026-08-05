# Agent MCP API Design

## Goal

Give AI agents (Claude Code in app repos, cloud/hosted agents) structured read access to the feedback tool's data so that:

- an agent told "implement everything planned for v1.3" can fetch every bug and feature assigned to that version, with full descriptions, without the user re-explaining each item
- an agent can scan all open feedback to flag likely duplicates or bugs that are already fixed

Access is read-only for now, authenticated with admin-generated API tokens, and designed so write tools can be added later without an auth redesign.

## Current Context

- Frontend: React/Vite SPA with an admin area at `src/pages/Admin.tsx` and auth via `src/hooks/useAuth.ts`.
- Backend: Supabase Postgres with RLS. `feedback` is publicly readable (`Anyone can view feedback`), as are `comments`, `feedback_attachments`, `apps`, and the release tables (`release_groups`, `release_group_platforms`, `feedback_release_targets`) used by public pages.
- Releases are modeled as release groups: `release_groups` (app + semver + title/notes) with per-platform rows in `release_group_platforms` (platform, version, status `planned`/`released`, `released_at`) and feedback assignments in `feedback_release_targets` (feedback + release group + platform). `feedback.version` mirrors the assigned semver.
- Edge functions `send-notification` and `verify-comment` already exist under `supabase/functions/` and deploy via `supabase functions deploy`.
- There is no API surface designed for agents and no API token concept.

## Product Decisions

- The API is a remote MCP server (streamable HTTP), hosted as a Supabase Edge Function, so both Claude Code (`claude mcp add --transport http ...`) and claude.ai/cloud agents (custom connector) can use the same URL.
- All MCP requests require a bearer token, even though the underlying data is public. This identifies callers, allows revocation, and makes later write support a pure addition.
- Tokens are created and revoked by logged-in admins in the feature voting tool's own admin UI.
- Duplicate/already-fixed detection is agent reasoning, not an API feature. The API only guarantees complete data (full descriptions, statuses, versions).

## Architecture

### 1. API tokens

New migration (append-only) creating `public.api_tokens`:

| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk | `gen_random_uuid()` |
| `name` | text not null | admin-chosen label, e.g. "claude-code laptop" |
| `token_hash` | text not null unique | SHA-256 hex of the plaintext token |
| `created_by` | uuid not null | references `auth.users` |
| `created_at` | timestamptz | default `now()` |
| `last_used_at` | timestamptz null | updated on successful auth |
| `revoked_at` | timestamptz null | non-null means revoked |

RLS: enabled; select/insert/update only for admins via `public.has_role(auth.uid(), 'admin')`. No public or anon access. No delete policy — tokens are revoked, not deleted, so `last_used_at` history survives.

Token creation via a `SECURITY DEFINER` RPC `public.create_api_token(p_name text) returns text`:

- raises an exception unless `has_role(auth.uid(), 'admin')`
- generates plaintext `fvt_` + 32 random bytes (pgcrypto `gen_random_bytes`, hex-encoded)
- inserts the row with the SHA-256 hash and `created_by = auth.uid()`
- returns the plaintext exactly once; it is never stored or shown again

Revocation is a plain `update ... set revoked_at = now()` through the admin RLS policy.

### 2. MCP server edge function

New function `supabase/functions/mcp-server/`:

- Uses the official MCP TypeScript SDK (`npm:@modelcontextprotocol/sdk`) with the streamable HTTP transport in stateless mode: each POST is handled independently, matching edge function execution.
- `verify_jwt = false` for this function in `supabase/config.toml`; it performs its own bearer auth.
- Auth flow per request: read `Authorization: Bearer fvt_...`, SHA-256 the token, look up a row with matching `token_hash` and `revoked_at is null` using the service-role client. Missing/invalid/revoked token returns 401 with a JSON-RPC error body. On success, fire a best-effort `last_used_at = now()` update (failures ignored).
- Data queries use the anon-key client so RLS still applies. The service-role client is used only for the `api_tokens` lookup.

Tools (all read-only):

| tool | input | returns |
| --- | --- | --- |
| `list_apps` | none | all apps: id, name, slug, description, platforms |
| `get_version_plan` | `app` (slug), `version` (semver text) | the matching `release_groups` row (semver, title, notes), its per-platform state from `release_group_platforms` (platform, version, status, released_at), and every feedback item assigned via `feedback_release_targets`: id, type, title, full description, status, vote count, platform, version, created_at, plus the target platforms per item |
| `list_feedback` | `app` (slug), optional `status`, optional `type` | matching feedback items with the same fields as above, newest first |
| `get_feedback` | `id` (uuid) | one feedback item plus its comments (content, is_admin, created_at) and attachment image URLs |

Privacy: tool outputs never include `feedback.submitter_email`, `feedback.notify_on_updates`, `comments.commenter_email`, or `comments.notify_on_reply`, even though those columns are technically publicly readable.

Error behavior: unknown app slug, unknown version, or unknown feedback id return an MCP tool error with an explicit message (e.g. "No app with slug 'foo'. Use list_apps to see valid slugs."), never a silently empty result. Invalid `status`/`type` values are rejected by input schema enums matching the DB check constraints.

Code layout inside the function follows the existing edge functions: `index.ts` for HTTP/transport wiring, with tool handlers and token hashing in a separate pure module so logic is testable without Deno.

### 3. Admin UI

New "API Tokens" section on `src/pages/Admin.tsx`:

- table of tokens: name, created date, last used, active/revoked state
- "Create token" dialog: name input, calls `create_api_token` RPC, then shows the plaintext token once with a copy button and a note that it cannot be shown again
- revoke button per active token with a confirmation dialog

Data logic lives in a new hook `src/hooks/useApiTokens.ts` (TanStack Query: list query, create mutation, revoke mutation), keeping `Admin.tsx` presentational per the architecture rules. `src/types/database.ts` gains the `api_tokens` table and `create_api_token` function types.

### 4. Agent connection

- Claude Code: `claude mcp add --transport http feature-voting https://<project-ref>.supabase.co/functions/v1/mcp-server --header "Authorization: Bearer fvt_..."`
- claude.ai / cloud agents: same URL as a custom connector with the same bearer header.
- New `docs/agent-api.md` documents the connection commands, each tool's inputs/outputs, and token management.

## Future Work (explicitly out of scope now)

- Write tools (`update_status`, close-duplicate, commenting) behind the same tokens, gated by a `scopes` column added to `api_tokens` at that point.
- Rate limiting per token.

## Testing

- Pure modules for the edge function (tool input validation, response shaping, token hashing) are covered by Vitest tests, mirroring how existing hook logic is tested. The Vitest `include` pattern is extended to cover `supabase/functions/**/*.test.ts`; pure modules use no Deno-specific APIs so they run under Node.
- `src/hooks/useApiTokens.ts` gets hook tests following the existing `useReleases.*.test.ts` patterns; the create-token dialog gets a component test asserting the token is displayed once with the warning.
- The migration's admin-only enforcement (RLS + RPC exception for non-admins) is verified by inspection against existing policy patterns; no automated Postgres tests exist in this repo today and none are introduced.
- Manual verification: deploy the function, create a token in the admin UI, connect Claude Code, and run each tool against real data.
